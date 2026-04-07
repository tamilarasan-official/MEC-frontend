# CampusOne Frontend - Comprehensive Changelog & iOS Handoff Guide

> **Generated:** 2026-03-30 | **Branch:** `Android-tamil` | **Latest Commit:** `451ce77`
> **React Native:** 0.83.1 (bare workflow) | **Package:** `com.mec.campusone`

---

## Table of Contents

1. [Latest Changes (Last 24 Hours)](#latest-changes-last-24-hours)
2. [Complete Commit History](#complete-commit-history)
3. [Version History](#version-history)
4. [New Files Created (Latest Commit)](#new-files-created-latest-commit)
5. [All Screen & Component Changes (Latest Commit)](#all-screen--component-changes-latest-commit)
6. [API Endpoints Reference](#api-endpoints-reference)
7. [iOS-Specific Action Items](#ios-specific-action-items)
8. [App Architecture Overview](#app-architecture-overview)

---

## Latest Changes (Last 24 Hours)

### Commit `451ce77` — 2026-03-30 03:39 IST

**"feat: transaction PIN system, secure screens, order reliability fixes"**

**45 files changed** | **+3,964 additions** | **-648 deletions**

#### Summary of All Changes

| Category | Files Changed | What Changed |
|----------|--------------|--------------|
| New Screens | 4 files | SetupPINScreen, TransactionPINScreen, StationeryAnalyticsScreen, StationeryHistoryScreen |
| New Components | 1 file | PINVerifyModal (bottom sheet PIN entry) |
| New Utils | 1 file | useSecureScreen hook |
| Android Native | 3 files | SecureScreenModule, SecureScreenPackage, MainApplication registration |
| Navigation | 5 files | RootNavigator, StudentHomeStack, CaptainTabs, OwnerTabs, StudentTabs |
| Student Screens | 5 files | Dashboard, Orders, Scanner, Profile, Wallet |
| Captain Screens | 3 files | CaptainHome (major rewrite), EatOrders, CaptainOrders |
| Owner Screens | 2 files | OwnerHome (major rewrite), StationeryHome |
| Components | 10 files | CartBottomSheet, QRPaymentConfirmModal, OrderAnimation, OrderQRCard, OrderStatusPopup, QRPaymentDisplayModal, ProfileDropdown, CaptainProfileDropdown, NotificationsModal, TopUpModal, SearchModal |
| Services | 4 files | api.ts, authService, notificationService, socketService |
| Store/State | 2 files | ordersSlice, userSlice |
| Types | 1 file | index.ts (User.isPinSetup, TransactionPIN nav params) |
| Theme/Constants | 2 files | colors.ts (partially_ready color), events.ts (FORCE_LOGOUT_EVENT) |
| QR Utils | 1 file | qrDecode.ts (compact QR format) |

---

## New Files Created (Latest Commit)

### 1. `src/screens/shared/SetupPINScreen.tsx` (241 lines)

**Purpose:** Full-screen overlay forced on users who haven't set up a transaction PIN (`user.isPinSetup === false`). Blocks app until PIN is set.

- **Props:** `{ onComplete: () => void }`
- **Flow:** Enter 4-digit PIN → Confirm PIN → API call → Done
- **API:** `POST /auth/setup-pin` with `{ pin: string }`
- **UI:** Purple gradient (#8b5cf6), custom 3x4 numeric keypad, PIN dot indicators, shake animation on mismatch
- **Security:** `useSecureScreen()` hook (FLAG_SECURE on Android)
- **Haptics:** `mediumHaptic()` on digit press, `successHaptic()` on success
- **Rendered from:** `RootNavigator.tsx` as overlay when `user.isPinSetup === false`

### 2. `src/screens/shared/TransactionPINScreen.tsx` (835 lines)

**Purpose:** Manage transaction PIN — Change or Reset (forgot) via OTP.

- **Props:** `{ navigation?: any; onClose?: () => void }` — works as both stack screen and modal
- **State Machine:**
  ```
  Mode: 'menu' | 'change' | 'forgot'

  Change flow:  current → new → confirm
  Forgot flow:  send OTP → enter OTP → new PIN → confirm PIN
  ```
- **APIs Used:**
  - `PUT /auth/change-pin` — `{ currentPin, newPin }`
  - `POST /auth/send-otp` — `{ phone }` → returns `sessionId`
  - `POST /auth/reset-pin` — `{ newPin, otp, sessionId }`
- **PIN length:** 4 digits | **OTP length:** 6 digits
- **Features:** Lockout (3 fails = 30s), 60s cooldown after change, success modal with checkmark
- **Registered in:** StudentHomeStack, CaptainTabs (eat mode), OwnerTabs (eat mode)

### 3. `src/components/common/PINVerifyModal.tsx` (466 lines)

**Purpose:** Bottom-sheet modal to verify PIN before any payment (cart order or QR payment).

- **Props:**
  ```typescript
  {
    visible: boolean;
    amount: number;      // displayed in modal
    title: string;       // displayed in modal
    onVerified: () => void;  // called on correct PIN
    onCancel: () => void;    // called on dismiss
  }
  ```
- **API:** `POST /auth/verify-pin` with `{ pin: string }`
- **Lockout:** Detects HTTP 429 / `PIN_LOCKED` / `PIN_COOLDOWN` error codes. Parses seconds from message, shows countdown.
- **UI:** Animated slide-up bottom sheet, backdrop tap to dismiss, transaction info (title + amount), 4 PIN circles, custom keypad, error/lockout states
- **Used by:** `CartBottomSheet.tsx`, `QRPaymentConfirmModal.tsx`
- **Note:** "Forgot PIN?" link was intentionally removed

### 4. `src/utils/useSecureScreen.ts` (17 lines)

**Purpose:** Prevents screenshots/screen recording on sensitive screens.

```typescript
// Android: calls NativeModules.SecureScreen.enable() / disable()
// iOS: currently a no-op — iOS developer must implement equivalent
```

- **Used on:** SetupPINScreen, TransactionPINScreen, PINVerifyModal, WalletScreen, ScannerScreen, OrderQRCard, QRPaymentDisplayModal

### 5. `src/screens/stationery_owner/StationeryAnalyticsScreen.tsx` (356 lines)

**Purpose:** Analytics dashboard for non-food (stationery) shop owners.

- **Data:** `fetchQRPayments()` from userSlice
- **Features:** Revenue card with time filters (today/week/month/all), payment count, 7-day bar chart, top 5 customers, recent transactions, wallet balance
- **UI:** ScrollView with pull-to-refresh, filter pills

### 6. `src/screens/stationery_owner/StationeryHistoryScreen.tsx` (376 lines)

**Purpose:** Payment history for stationery owners with calendar picker.

- **Features:** Quick filter tabs (Today/Week/Month/All/Date), custom calendar month view with transaction dots, transaction list as FlatList, total amount summary

### 7. Android Native — `SecureScreenModule.kt` + `SecureScreenPackage.kt`

```kotlin
// SecureScreenModule.kt — adds/clears FLAG_SECURE on the activity window
// SecureScreenPackage.kt — standard ReactPackage registration
// MainApplication.kt — registers SecureScreenPackage in packages list
```

**iOS equivalent needed** — see [iOS Action Items](#ios-specific-action-items)

---

## All Screen & Component Changes (Latest Commit)

### Navigation Changes

| File | Change |
|------|--------|
| **RootNavigator.tsx** (+306 lines) | PIN Setup gate (blocks app until PIN set), LoginSuccessOverlay (3s green welcome), ForceLogoutOverlay (session ended on other device), popup queue system (replaces single popup), force update listener (426 status), camera permission pre-request |
| **StudentHomeStack.tsx** | Added `TransactionPIN` screen |
| **CaptainTabs.tsx** | Added hidden `TransactionPIN` tab in eat mode, tab bar shadow style, `tabBarHideOnKeyboard` |
| **OwnerTabs.tsx** | Added hidden `TransactionPIN` tab in eat mode, added `StationeryAnalytics` tab for non-food shops, `StationeryHistoryScreen` for non-food History tab |
| **StudentTabs.tsx** | Icon sizes 22→20, Orders icon `clipboard`→`receipt`, Scanner icon `qr-code`→`scan`, pill size 56x32→44x30, tab bar height 56→60, border→shadow style |

### Student Screens

| Screen | Changes |
|--------|---------|
| **DashboardScreen** (+164 lines) | Active orders now horizontal paginating carousel (snap-to, dot indicators). New `OrderPulseIcon` animated component. Tapping carousel card shows QR. `partially_ready` color → purple. `keyboardDismissMode="on-drag"` |
| **OrdersScreen** (+111 lines) | New `AnimatedEmptyState` with fade-in, pulsing icon, "Start Ordering" button with bouncing arrow. `partially_ready` → purple |
| **ScannerScreen** (+121 lines) | Zoom controls (default 3x, +/- buttons, pinch-to-zoom). "Move closer" hint after 3s. `useSecureScreen()`. Camera permission requests even if `denied` |
| **ProfileScreen** (+31 lines) | Added "Transaction PIN" menu item (navigates to `TransactionPIN`). `keyboardDismissMode="on-drag"` |
| **WalletScreen** (+3 lines) | Added `useSecureScreen()`. `keyboardDismissMode="on-drag"` |

### Captain Screens

| Screen | Changes |
|--------|---------|
| **CaptainHomeScreen** (+633 lines) | **Major rewrite.** New `SwipeableOrderCard` with PanResponder gestures: swipe right = accept/ready/deliver, swipe left = reject. Per-item checkboxes for batch marking ready. Compact card design (smaller images, inline header). Green tick strip on ready orders. `partially_ready` → purple. Silent refresh on error |
| **CaptainEatOrdersScreen** | `partially_ready` color → purple |
| **CaptainOrdersScreen** | `partially_ready` → purple. Silent refresh on status update error |

### Owner Screens

| Screen | Changes |
|--------|---------|
| **OwnerHomeScreen** (+319 lines) | Same compact card redesign as CaptainHome. Tick strip for ready orders. `partially_ready` → purple. Silent refresh on error |
| **StationeryHomeScreen** (+53 lines) | Only shows active (unpaid) QR payments. Auto-dismiss QR when paid. AppState listener for background resume. Number coercion safety. Light theme color fixes |

### Components

| Component | Changes |
|-----------|---------|
| **CartBottomSheet** | PIN verification gate: shows `PINVerifyModal` before pay if `user.isPinSetup`. New `showPinModal` state, `handlePayPress()` |
| **QRPaymentConfirmModal** | Same PIN gate. Title fallback `'Payment'` → `'QR Payment'` |
| **OrderStatusPopup** | New props: `pickupToken`, `itemNames`. Changed from `<Modal>` to absolute-positioned `<View>` (z-index 9999). Dynamic messages using item names. Pickup token pill display. Auto-dismiss 5s→3s. `StatusBar` light-content |
| **OrderQRCard** | `useSecureScreen()`. QR code: `ecl="M"`, app logo overlay (28px), border radius 8 |
| **OrderAnimation** | Money toast fades in (new `toastOpacity`). `StatusBar` light-content on mount. Toast position adjusted |
| **QRPaymentDisplayModal** | `useSecureScreen()`. Compact QR data: `{ t:'qp', p:id, a:amt, s:shop }` (~50 chars). QR size 200→240, logo overlay |
| **CaptainProfileDropdown** | Added "Transaction PIN" menu item (eat mode only, icon: `keypad-outline`, color: `#f59e0b`). Opens TransactionPINScreen in modal |
| **ProfileDropdown** | Sign-out dialog polish: larger radius, heavier fonts, dashed border icon |
| **NotificationsModal** | Pickup token display in order notifications |
| **SearchModal** | `keyboardDismissMode="on-drag"` |
| **TopUpModal** | Style polish: larger radius, centered input, bolder fonts |

### Services

| Service | Changes |
|---------|---------|
| **api.ts** | `X-App-Version` header on all requests. 426 status → emits `FORCE_UPDATE_REQUIRED`. `getOrCreateDeviceId` exported |
| **authService.ts** | Login uses persistent Keychain device ID (not `mobile-${Date.now()}`). `platform` sends actual `Platform.OS` |
| **notificationService.ts** | Force logout via FCM (`type: 'force_logout'` → emits `FORCE_LOGOUT_EVENT`). Payment dedup key simplified |
| **socketService.ts** | `pickupToken` in OrderUpdatePayload. Popup enriched with `pickupToken`+`itemNames`. `force_logout` socket listener. Payment dedup simplified |

### Store/State

| Slice | Changes |
|-------|---------|
| **ordersSlice.ts** | **Critical fix:** `createOrder` thunk split into 2 try/catch blocks. API failure → reject. Mapping failure → return minimal success (never false "Order Failed"). `fetchMyOrders` accepts `serviceType` param |
| **userSlice.ts** | `fetchQRPayments` debug logging. `createQRPayment.fulfilled` merges default values |

### Types

| Change | Details |
|--------|---------|
| **User interface** | Added `isPinSetup?: boolean` |
| **CaptainTabParamList** | Added `TransactionPIN: undefined` |
| **OwnerTabParamList** | Added `TransactionPIN: undefined` |

### Theme/Constants

| File | Change |
|------|--------|
| **colors.ts** | `partially_ready` color: `#3b82f6` (blue) → `#8b5cf6` (purple) |
| **events.ts** | Added `FORCE_LOGOUT_EVENT = 'FORCE_LOGOUT'` |
| **qrDecode.ts** | New compact QR format: `{ t:'qp', p, a, s }`. Null safety added |

---

## Complete Commit History

| # | Hash | Date | Message | Key Changes |
|---|------|------|---------|-------------|
| 1 | `66acb9b` | Feb 4 | Initial commit | React Native 0.83.1 scaffold |
| 2 | `2d007d5` | Feb 4 | Update README | Project docs |
| 3 | `b211e75` | Feb 16 | All screens and APIs integrated | Full app MVP — 5 roles, all screens, Redux, services, Socket.io |
| 4 | `f24316c` | Feb 19 | "rishi" | UI overhaul, scanner, notifications, dark mode, profile, Razorpay types |
| 5 | `4adf39f` | Mar 1 | Full app update | **Biggest commit.** Notification dedup, QR payments, stationery owner, captain eat mode, removed accountant/superadmin |
| 6 | `328c512` | Mar 1 | Firebase config (iOS) | `GoogleService-Info.plist`, SPM Firebase deps, background notification mode |
| 7 | `769df84` | Mar 4 | OTP registration, Android prod config | OTP register flow, haptics, imageUrl utils, Android package → `com.mec.campusone` |
| 8 | `0a6ca58` | Mar 5 | iOS project setup | iOS build fix scripts, Podfile configs, guides |
| 9 | `13f4a29` | Mar 5 | Firebase messaging, iOS restructure | **Project renamed** `frontend` → `CampusOne`. New xcworkspace, xcodeproj, entitlements, Podfile.lock |
| 10 | `86622f1` | Mar 5 | iOS app icons | Icon generation scripts and guides |
| 11 | `698cf53` | Mar 5 | iOS compliance | Photo library permission, encryption declaration, change audit |
| 12 | `6ef201e` | Mar 6 | 17 bug fixes, v1.0.1 | Keychain tokens, 401 retry queue, session timeout, production API URL |
| 13 | `8b38778` | Mar 10 | Screens update, version check | Version check service, UpdatePromptModal, owner analytics expansion |
| 14 | `c82d346` | Mar 11 | Username login, auth refactor | UsernameLoginScreen for staff, captain settings rewrite, iOS cleanup |
| 15 | `f005671` | Mar 12 | Phone not found error fix | 1-line fix: show "No account found" on login |
| 16 | `3d43bb0` | Mar 12 | Account deletion, v1.0.5 | Account deletion (Apple requirement), login OTP fix, socket fixes |
| 17 | `ec553af` | Mar 22 | Unified OTP login/register | Single OTP screen for login+register, SMS Retriever, PaymentResultModal, TransactionDetailScreen |
| 18 | `e18b603` | Mar 24 | Stability, item tracking, v1.1.3 | **Critical stability.** Polling 5s→30s, socket zombie fix, item-level order status, ChangePasswordScreen, scanner flash, theme toggle |
| 19 | `f2febdf` | Mar 24 | 10 bug fixes | EatScanner tab, keyboard flicker, camera permission, phone paste, notification dedup |
| 20 | `631a7ca` | Mar 25 | Frontend updates | StationeryAnalyticsScreen, OrderHistory expansion, Android splash theme |
| 21 | `4725b9b` | Mar 27 | partially_ready, real-time QR | `partially_ready` status, real-time QR modal updates, popup queue, hot reload, reject modal |
| 22 | `451ce77` | Mar 30 | **Transaction PIN, secure screens** | PIN system (setup/verify/change/forgot), secure screen, order reliability fix, stationery analytics/history |

---

## Version History

| Version | versionCode | Commit | Date | Highlights |
|---------|-------------|--------|------|------------|
| 1.0.0 | 1 | `b211e75` | Feb 16 | Initial release |
| 1.0.1 | 2 | `6ef201e` | Mar 6 | 17 bug fixes, Keychain tokens, production config |
| 1.0.5 | 6 | `3d43bb0` | Mar 12 | Account deletion, login fixes |
| 1.1.3 | — | `e18b603` | Mar 24 | Stability, item-level tracking, polling fix |

---

## API Endpoints Reference

### Transaction PIN APIs (New)

| Endpoint | Method | Body | Response | Notes |
|----------|--------|------|----------|-------|
| `/auth/setup-pin` | POST | `{ pin: string }` | `{ success: true }` | 4-digit numeric PIN. First-time only |
| `/auth/verify-pin` | POST | `{ pin: string }` | `{ success: true }` | 3 attempts → 30s lockout. Returns 429/PIN_LOCKED/PIN_COOLDOWN |
| `/auth/change-pin` | PUT | `{ currentPin, newPin }` | `{ success: true }` | 60s cooldown after change |
| `/auth/send-otp` | POST | `{ phone: string }` | `{ sessionId: string }` | For forgot PIN flow |
| `/auth/reset-pin` | POST | `{ newPin, otp, sessionId }` | `{ success: true }` | 6-digit OTP |

### Order API (Modified)

| Endpoint | Method | Body | Change |
|----------|--------|------|--------|
| `/orders` | POST | `{ shopId, items, mode? }` | Response mapping now has fallback — never shows false "Order Failed" |
| `/orders/my` | GET | `?serviceType=food` | Now accepts `serviceType` query param |

### Other APIs Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/auth/login` | POST | Now sends persistent deviceId + actual platform |
| All endpoints | * | Now include `X-App-Version` header |
| Any → 426 | — | Triggers force update flow |

---

## iOS-Specific Action Items

### Must Implement (No Android Equivalent Exists)

1. **Secure Screen Native Module**
   - Android has `SecureScreenModule.kt` using `FLAG_SECURE`
   - iOS needs: Create a native module that uses `UIScreen.main.isCaptured` observation or a hidden `secureTextEntry` field overlay to prevent screenshots
   - **Affected screens:** PIN setup, PIN verify, PIN change, Wallet, Scanner, OrderQRCard, QRPaymentDisplay

2. **OTP Auto-Fill**
   - Android uses SMS Retriever API via `react-native-otp-verify`
   - iOS: Set `textContentType="oneTimeCode"` on OTP TextInput — iOS auto-suggests from SMS natively

### Must Verify (Cross-Platform but May Differ)

3. **Force Logout**
   - Comes via both WebSocket (`force_logout` event) and FCM push (`type: 'force_logout'`)
   - Uses `DeviceEventEmitter` — verify this works on iOS

4. **Force Update (426 Status)**
   - App detects HTTP 426, shows update modal
   - Must link to **App Store** URL on iOS (Android links to Play Store)

5. **Camera Permission Flow**
   - Scanner now requests permission even if `denied` (shows settings redirect)
   - Camera reactivates on return from Settings
   - Test iOS `Settings.openURL()` flow

6. **App Resume Data Refresh**
   - Uses AppState listener to refetch orders/wallet/notifications on foreground
   - Critical for iOS where app may be suspended

### Already Handled (Cross-Platform)

7. **Keychain Token Storage** — `react-native-keychain` works on both platforms
8. **PIN Screens** — All React Native, fully cross-platform
9. **QR Scanning** — `react-native-vision-camera` with zoom/pinch
10. **Push Notifications** — Firebase configured in commit `328c512` and `13f4a29`

### iOS Project Notes

- **Open:** `ios/CampusOne.xcworkspace` (NOT the old `frontend.xcodeproj`)
- **Entitlements:** `ios/frontend/frontend.entitlements` (push notification capability)
- **Firebase:** SPM for FirebaseCore+Messaging, Pods for RN dependencies
- **App Store Compliance:** Account deletion present, photo library permission declared, encryption compliance set (`ITSAppUsesNonExemptEncryption: NO`), privacy manifest exists

---

## App Architecture Overview

### Component Tree
```
App.tsx
└── GestureHandlerRootView
    └── Redux Provider
        └── ThemeProvider (light/dark/system)
            └── SafeAreaProvider
                └── ErrorBoundary
                    └── NavigationContainer
                        └── RootNavigator
                            ├── SetupPINScreen (overlay if !isPinSetup)
                            ├── LoginSuccessOverlay (3s on login)
                            ├── ForceLogoutOverlay (other device login)
                            ├── ForceUpdateModal (426 status)
                            ├── OrderStatusPopup (queue)
                            │
                            ├── AuthStack (unauthenticated)
                            │   ├── Login
                            │   ├── OTP
                            │   └── Register
                            │
                            ├── StudentTabs
                            │   ├── StudentHomeStack
                            │   │   ├── Dashboard
                            │   │   ├── Menu, Cart, Stationery, Offers
                            │   │   ├── OrderHistory, Leaderboard
                            │   │   ├── Profile, Notifications, NotificationSettings
                            │   │   ├── PrivacySecurity, HelpSupport
                            │   │   ├── Wallet, TransactionDetail
                            │   │   ├── ChangePassword
                            │   │   └── TransactionPIN ← NEW
                            │   ├── Orders
                            │   ├── Scanner
                            │   └── Wallet (hidden: TransactionDetail)
                            │
                            ├── CaptainTabs
                            │   ├── [eat mode]
                            │   │   ├── EatFood (CaptainEatScreen)
                            │   │   ├── EatOrders
                            │   │   ├── EatScanner
                            │   │   ├── Wallet (hidden)
                            │   │   ├── TransactionDetail (hidden)
                            │   │   └── TransactionPIN (hidden) ← NEW
                            │   └── [work mode]
                            │       ├── Home, PrepList, History
                            │       └── Scanner FAB overlay
                            │
                            └── OwnerTabs
                                ├── [eat mode] — same as captain eat
                                │   └── TransactionPIN (hidden) ← NEW
                                └── [work mode]
                                    ├── Home, PrepList/Menu, History
                                    ├── Analytics (food) / StationeryAnalytics (non-food)
                                    └── Scanner FAB overlay
```

### Payment Flow (with PIN)
```
User taps "Pay" → handlePayPress()
  ├── if user.isPinSetup === true
  │     └── Show PINVerifyModal
  │           ├── POST /auth/verify-pin
  │           ├── On success → onVerified() → handlePay()
  │           └── On lockout → show countdown
  └── if user.isPinSetup === false
        └── handlePay() directly

handlePay()
  ├── dispatch(createOrder({ shopId, items }))
  │     ├── Step 1: POST /orders  ← if THIS fails → show "Order Failed" (correct)
  │     └── Step 2: Map response  ← if THIS fails → return minimal success (never false failure)
  ├── On success → clearCart → animateClose → OrderAnimation (success)
  └── On reject  → animateClose → OrderAnimation (failure)
```

### Socket Events (Real-Time)

| Event | Direction | Payload | Action |
|-------|-----------|---------|--------|
| `orderUpdate` | Server→Client | `{ orderId, status, items, pickupToken }` | Redux patch + popup queue |
| `newOrder` | Server→Client | `{ order }` | Refresh shop orders |
| `force_logout` | Server→Client | — | Emit FORCE_LOGOUT_EVENT → overlay |
| `payment:received` | Server→Client | `{ paymentRequestId, paidCount }` | Refresh QR payments + notification |
| `wallet:updated` | Server→Client | `{ balance }` | Refresh wallet |

---

*This document covers all frontend changes from the Android-tamil branch. The iOS developer should use this as the reference for feature parity.*
