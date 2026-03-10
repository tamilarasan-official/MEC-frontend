# CampusOne Mobile App - Bug Analysis Report

**Roles Covered:** Student, Captain, Owner
**Platform:** React Native (Expo) Mobile App
**Date:** 2026-03-05

---

## Bug #1: App Logs Out Every Time the App is Closed
**Role:** ALL (Student, Captain, Owner)
**Screen:** Login Page
**Severity:** HIGH

### Root Cause Analysis
- **File:** `src/navigation/RootNavigator.tsx` (lines 53-68)
- **File:** `src/services/api.ts` (lines 67-88)
- Auth state is stored only in Redux (in-memory). On app restart, `RootNavigator` checks for a stored token via `AsyncStorage.getItem('@madrasone_access_token')` and calls `refreshUserData()`.
- **Problem:** If the access token is expired and the refresh token call fails (network issue, server error, or token expired), `clearTokens()` is called (api.ts line 79) and `resetAuth` is dispatched (line 83), which logs the user out completely.
- The token refresh endpoint may be returning errors or the refresh token lifetime on the backend may be too short.

### Fix Required
1. **Backend:** Ensure refresh tokens have a long expiry (e.g., 30+ days).
2. **Frontend (`src/services/api.ts`):** Add retry logic on token refresh failure before clearing tokens. Consider storing user data in AsyncStorage so the app doesn't lose session on transient network errors.
3. **Frontend (`src/navigation/RootNavigator.tsx`):** The `catch` block at line 61 silently swallows the error. Add a retry or show a "session expired" message instead of silently logging out.

---

## Bug #2: Wallet Top-Up - Payment Failed on Top Up
**Role:** Student, Captain, Owner
**Screen:** Wallet Top-up Page
**Severity:** HIGH

### Root Cause Analysis
- **File:** `src/components/student/TopUpModal.tsx` (lines 44-89)
- **File:** `src/services/walletService.ts` → `createRazorpayOrder()` and `verifyRazorpayPayment()`
- The Razorpay payment flow:
  1. `createRazorpayOrder(amount)` → backend creates order
  2. `RazorpayCheckout.open(options)` → opens payment gateway
  3. `verifyRazorpayPayment()` → verifies signature
- **Possible causes:**
  - Razorpay API key (`orderData.keyId`) may be invalid/expired on the backend.
  - The backend `createRazorpayOrder` endpoint may be failing (check server logs).
  - The `verifyRazorpayPayment` endpoint may be rejecting valid payments.
  - The error message at line 85 is generic: `'Payment failed. Please try again.'`

### Fix Required
1. **Backend:** Verify Razorpay API keys are valid and the order creation endpoint works.
2. **Frontend (`TopUpModal.tsx` line 81-86):** Improve error handling to show specific Razorpay error codes. The `PAYMENT_CANCELLED` check at line 82 is good, but other errors need better categorization.
3. **Add logging** to capture the exact Razorpay error response for debugging.

---

## Bug #3 & #4: Wallet Top-Up / Add to Cart - Glitching on Closing (with and without input)
**Role:** Student, Captain, Owner
**Screen:** Wallet Top-up Page
**Severity:** MEDIUM

### Root Cause Analysis
- **File:** `src/components/student/TopUpModal.tsx` (lines 34-41, 91-96, 98-101)
- The modal uses `Animated.spring` for slide-in animation (line 39) but has **no slide-out animation**. When `handleClose()` is called, it immediately sets state and calls `onClose()`.
- **Problem:** The `backdrop` TouchableOpacity (line 101) and the close button (line 120) both call `handleClose()` which immediately hides the modal without any exit animation, causing a visual "glitch" (abrupt disappear).
- Additionally, the `slideAnim` is created with `useMemo(() => new Animated.Value(600), [])` which means it's only initialized once. When the modal re-opens, `slideAnim.setValue(600)` at line 38 causes a visual jump.
- The keyboard dismissal on close is not handled, which can cause layout glitch when the keyboard is visible and modal closes simultaneously.

### Fix Required
1. **Add slide-out animation** before calling `onClose()`:
   ```typescript
   const handleClose = () => {
     Keyboard.dismiss();
     Animated.timing(slideAnim, {
       toValue: 600,
       duration: 250,
       useNativeDriver: true,
     }).start(() => {
       setAmount('');
       setError('');
       setSuccess(false);
       onClose();
     });
   };
   ```
2. **Add `Keyboard.dismiss()`** before closing to prevent keyboard/layout conflicts.
3. **Ensure state reset** happens after animation completes, not before.

---

## Bug #5: Cannot Remove Profile Photo / Set to Default
**Role:** Student, Captain, Owner
**Screen:** Profile & Settings Page
**Severity:** LOW

### Root Cause Analysis
- **File:** `src/screens/student/ProfileScreen.tsx` (lines 50-72, 98-115)
- The avatar area only has an upload handler (`handleAvatarUpload`). There is **no option to remove the avatar** or reset to default (initial letter).
- The `TouchableOpacity` wrapping the avatar (line 98) only triggers `handleAvatarUpload` which opens the image library.
- **Missing:** No "Remove Photo" option, no long-press menu, no action sheet to choose between "Upload" and "Remove".

### Fix Required
1. **Replace the single `onPress`** with an ActionSheet/Alert that shows options:
   - "Upload New Photo"
   - "Remove Photo" (resets to default initial)
   - "Cancel"
2. **Add a `removeAvatar` API call** in `walletService.ts` (or create a new endpoint on the backend).
3. **On remove:** Dispatch `setUser({ ...user, avatarUrl: null })` to reset to the letter initial fallback.

---

## Bug #6: "Something Went Wrong" Error After Ordering from Eat Mode (Captain)
**Role:** Captain
**Screen:** After Order Placing - EAT MODE
**Severity:** HIGH

### Root Cause Analysis
- **File:** `src/screens/captain/CaptainEatScreen.tsx` (lines 400-414)
- The `CartBottomSheet` component handles order placement. On success, it calls `onOrderSuccess(order)` (line 403) and on failure, `onOrderFailure(errorMessage)` (line 409).
- **File:** `src/components/student/CartBottomSheet.tsx` - This is a shared component used by both student and captain.
- **Problem:** The CartBottomSheet uses `orderService.createOrder()` which may be using student-specific logic that doesn't account for captain role. The order creation may fail because:
  - Captain's `shopId` or role isn't being sent correctly.
  - The backend may reject orders from captains eating at their own shop.
  - The `onOrderFailure` callback shows a generic error animation.

### Fix Required
1. **Check `CartBottomSheet.tsx`** for the order creation payload - ensure it sends the correct role/context for captain eat orders.
2. **Backend:** Verify that captains are allowed to place eat orders and the API handles the captain role correctly.
3. **Improve error message** from generic "Something went wrong" to the actual server error message.

---

## Bug #9: Order ID Elements (Instant, Ready for Pickup) Overlapping
**Role:** Student
**Screen:** My Orders Screen
**Severity:** MEDIUM

### Root Cause Analysis
- **File:** `src/screens/student/OrdersScreen.tsx` (lines 138-155)
- The order header has the order ID and inline badges in a `flexDirection: 'row'` layout (line 140):
  ```jsx
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
    <Text style={styles.orderId} numberOfLines={1}>#{order.id}</Text>
    {order.isReadyServe && (
      <View style={{ backgroundColor: '...', borderRadius: 6, paddingHorizontal: 6, ... }}>
        <Text style={{ fontSize: 10, fontWeight: '700', color: '#f97316' }}>INSTANT</Text>
      </View>
    )}
  </View>
  ```
- **Problem:** The order ID text (`#{order.id}`) can be long (MongoDB ObjectID = 24 chars). Combined with the "INSTANT" badge, they overflow the container. The `numberOfLines={1}` on the order ID doesn't have `flex: 1` or `flexShrink: 1`, so it doesn't shrink to make room for the badge.
- The status badge on the right side (`Ready for Pickup`) also competes for horizontal space (line 151-154).

### Fix Required
1. **Add `flex: 1` and `flexShrink: 1`** to the order ID text so it truncates properly:
   ```jsx
   <Text style={[styles.orderId, { flex: 1, flexShrink: 1 }]} numberOfLines={1}>
     #{order.id}
   </Text>
   ```
2. **Limit the displayed order ID** to last 6-8 characters: `#{order.id.slice(-8)}`
3. **Add `flexShrink: 0`** to the INSTANT badge so it doesn't get compressed.

---

## Bug #12: Adding a New Item Throws Validation Error (Owner)
**Role:** Shop Owner
**Screen:** Item's Page
**Severity:** HIGH

### Root Cause Analysis
- **File:** `src/screens/owner/OwnerMenuScreen.tsx`
- The `createMenuItem` action dispatches to the backend. The form collects: name, price, category, description, image, isVeg, isInstant.
- **Possible causes:**
  - Required fields may not be validated on the frontend before submission.
  - The image upload may be failing (FormData formatting issue).
  - The backend validation may require fields not being sent (e.g., `shopId` not auto-attached).
  - Category may not match backend enum values.

### Fix Required
1. **Add frontend validation** before API call - check all required fields (name, price, category).
2. **Check the backend** for exact validation rules and ensure the form sends all required fields.
3. **Show specific validation error messages** from the backend response instead of a generic error.

---

## Bug #15: Bad Gateway Error When Closing Payment Gateway
**Role:** Student, Captain, Owner
**Screen:** Home Screen
**Severity:** MEDIUM

### Root Cause Analysis
- **File:** `src/components/student/TopUpModal.tsx` (lines 81-88)
- **File:** `src/components/student/QRPaymentConfirmModal.tsx`
- When the user closes the Razorpay gateway mid-payment, Razorpay throws an error. The catch block at line 81 checks for `PAYMENT_CANCELLED` code, but other gateway errors (like a bad gateway from Razorpay's server) aren't handled properly.
- **Problem:** If Razorpay's gateway itself has an issue, the error object may not have the expected structure, causing the app to show a raw "bad gateway" error or crash.

### Fix Required
1. **Improve error handling** in the Razorpay catch block:
   ```typescript
   catch (e: any) {
     if (e?.code === 'PAYMENT_CANCELLED' || e?.description?.includes('cancelled')) {
       setError('Payment cancelled');
     } else if (e?.code === 'BAD_REQUEST_ERROR' || e?.description?.includes('gateway')) {
       setError('Payment gateway is currently unavailable. Please try again later.');
     } else {
       setError('Payment could not be completed. Please try again.');
     }
   }
   ```
2. **Navigate back to home** or reset state cleanly after gateway errors.

---

## Bug #24: Captain QR Scan Issue on Website
**Role:** Captain
**Screen:** QR Scanner
**Severity:** MEDIUM

### Root Cause Analysis
- **File:** `src/screens/captain/CaptainScannerScreen.tsx` (lines 60-79)
- **File:** `src/utils/qrDecode.ts` → `decodeQrData()`
- The QR scanner uses `react-native-vision-camera` which is mobile-only. On web, this component won't work.
- **Problem:** The `decodeQrData()` function may not handle all QR formats correctly. If the QR code format has changed or the order ID extraction fails, it shows "Invalid QR code."
- The `handleCodeScanned` at line 60 only processes the first code in the array and has a simple valid/invalid check.

### Fix Required
1. **Check `qrDecode.ts`** to ensure all QR formats are supported.
2. **Add better error messages** to indicate why a QR code is invalid.
3. **For web:** This is a mobile-only feature; QR scanning on web would require a different library.

---

## Summary Table

| Bug # | Description | Severity | Root Cause | Effort |
|-------|-------------|----------|------------|--------|
| 1 | Auto logout on app close | HIGH | Token refresh failure clears session | Medium |
| 2 | Payment failed on top-up | HIGH | Razorpay config or backend issue | Medium |
| 3 | TopUp modal glitch on close (with input) | MEDIUM | No exit animation + keyboard conflict | Low |
| 4 | TopUp modal glitch on close | MEDIUM | No exit animation on modal dismiss | Low |
| 5 | Cannot remove profile photo | LOW | No remove option in UI | Low |
| 6 | Error after captain eat order | HIGH | CartBottomSheet may not handle captain role | Medium |
| 9 | Order ID + badges overlapping | MEDIUM | Missing flex shrink on order ID text | Low |
| 12 | Validation error adding item (Owner) | HIGH | Missing frontend validation / backend field mismatch | Medium |
| 15 | Bad gateway on closing payment | MEDIUM | Unhandled Razorpay error codes | Low |
| 24 | Captain QR scan issues | MEDIUM | QR decode format handling | Low |

---

## Recommended Fix Priority

### P0 - Fix Immediately
1. **Bug #1** - Auto logout (affects ALL users, core usability)
2. **Bug #2** - Payment failure (revenue-blocking)
3. **Bug #6** - Captain eat mode error (blocks captain ordering)

### P1 - Fix Soon
4. **Bug #12** - Owner can't add items (blocks shop management)
5. **Bug #9** - Overlapping order elements (visual, easy fix)
6. **Bug #3/#4** - Modal glitch (polish, easy fix)

### P2 - Fix Later
7. **Bug #15** - Bad gateway error handling (edge case)
8. **Bug #5** - Remove profile photo (feature enhancement)
9. **Bug #24** - QR scan improvements (needs investigation)

---

## Files to Modify

| File | Bugs Addressed |
|------|---------------|
| `src/services/api.ts` | #1 |
| `src/navigation/RootNavigator.tsx` | #1 |
| `src/components/student/TopUpModal.tsx` | #2, #3, #4, #15 |
| `src/screens/student/ProfileScreen.tsx` | #5 |
| `src/screens/captain/CaptainEatScreen.tsx` | #6 |
| `src/components/student/CartBottomSheet.tsx` | #6 |
| `src/screens/student/OrdersScreen.tsx` | #9 |
| `src/screens/owner/OwnerMenuScreen.tsx` | #12 |
| `src/utils/qrDecode.ts` | #24 |
| `src/screens/captain/CaptainScannerScreen.tsx` | #24 |
