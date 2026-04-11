# CampusOne v1.2.0 — Changelog for iOS Developer

> **Date:** 2026-04-08
> **Android branch:** `Android-tamil` (latest commit: `fde1fd9`)
> **Backend branch:** `main` (latest commit: `896df9a`)
> **Web frontend branch:** `main` (latest commit: `1537dd7`)
> **Version:** 1.2.0 (versionCode 21)

---

## Summary

v1.2.0 adds **App Maintenance Mode** — a full-screen purple overlay that blocks the app with animated entrance, auto-retry polling, and estimated time remaining. Also includes **FCM token re-registration on app resume** to fix silent push failures after force logouts, **device-specific logout token cleanup**, **swipe card reset on reject modal dismiss**, **QR card auto-dismiss fixes** for Dashboard and Stationery screens, and a **TopUp keyboard fix**.

---

## What's New in v1.2.0 (April 8, 2026)

### New Features

1. **App Maintenance Mode** — Full-screen purple overlay when backend is under maintenance, with animated entrance, "Check Again" button, auto-retry every 30 seconds, and estimated time remaining
2. **FCM Token Re-registration on App Resume** — Restores FCM tokens wiped by server-side cleanup (logout, cron, force logout), ensuring push notifications work reliably

### Bug Fixes

1. **Push notifications silently failing after force logout** — FCM token not re-registered on app resume; now calls `refreshTokenRegistration()` on every foreground return
2. **Logout removed all device tokens** — Logout now sends `deviceId` so the server removes only this device's token, not all tokens for the user
3. **Swipe card stuck open when reject modal cancelled** — Captain and Owner swipeable item cards now reset position when the reject modal is dismissed or cancelled
4. **QR card not auto-dismissing** — Applied auto-dismiss on `completed`/`cancelled` status to `DashboardScreen` and `StationeryScreen` (previously only in `OrdersScreen`)
5. **TopUp keyboard covering amount input** — Changed `keyboardBehavior` from `"interactive"` to `"extend"` and added `onFocus` snap to full height
6. **Wallet balance shown in Stationery Analytics** — Removed the wallet balance card from `StationeryAnalyticsScreen` (not relevant to stationery owners)

---

## Detailed Changes

---

### 1. App Maintenance Mode

**New files:**
- `src/screens/shared/MaintenanceScreen.tsx` — Full-screen purple overlay
- `src/services/maintenanceService.ts` — Polls `GET /api/v1/app/maintenance-status`

**Modified files:**
- `src/services/api.ts` — Detects 503 response, emits `MAINTENANCE_MODE_DETECTED` event

**MaintenanceScreen features:**
- Purple overlay (`backgroundColor: #7c3aed`), `zIndex: 99999` — non-dismissible
- Staggered entrance animations (icon spring, text fade-in sequence)
- Pulsing ring animation behind the icon
- Shows `info.message` from backend response
- Time estimate computed from `startedAt` + `estimatedDuration` (hours) → "Estimated Xh Ym remaining" or "Should be back very soon"
- "Check Again" button with loading spinner (3-second debounce)
- Auto-retry `setInterval` every 30 seconds
- "Auto-checking every 30 seconds" hint text

**maintenanceService API call:**
```
GET /api/v1/app/maintenance-status
Headers: X-App-Key: <APP_API_KEY from .env>
No auth required (public endpoint)
```

**Response shape used:**
```typescript
interface MaintenanceInfo {
  maintenanceEnabled: boolean;
  message: string;
  estimatedDuration: number; // hours
  startedAt: string | null;
}
```

**503 detection in api.ts:**
- Intercepts any API response with status 503
- Emits `DeviceEventEmitter.emit('MAINTENANCE_MODE_DETECTED')`
- RootNavigator listens to this event to show the maintenance screen

---

### 2. FCM Token Re-registration on App Resume

**File:** `src/services/notificationService.ts`

New exported function:
```typescript
export async function refreshTokenRegistration(userId: string): Promise<void> {
  try {
    const token = await getToken(getMessaging());
    if (token) await registerTokenWithBackend(token, userId);
  } catch { /* non-critical */ }
}
```

**File:** `src/navigation/RootNavigator.tsx`

Called on every app foreground resume (after socket reconnect):
```typescript
refreshTokenRegistration(user.id);
```

**Why:** After a server-side force logout, the backend removes FCM tokens from the user document. When the same user logs back in on their device, the token is no longer registered. This call re-posts the existing token on every app resume so push notifications are always active.

---

### 3. Device-Specific Logout FCM Cleanup

**File:** `src/store/slices/authSlice.ts`

**Before:**
```typescript
await api.post('/auth/logout');
```

**After:**
```typescript
const deviceId = await getDeviceId();
await api.post('/auth/logout', { deviceId });
```

**Why:** Previously, logout removed ALL FCM tokens for the user across all devices. If re-registration fails after logout, the user gets no push notifications. Now only this device's token is removed.

---

### 4. Swipe Card Reset on Reject Modal Dismiss

**Files:** `src/screens/captain/CaptainHomeScreen.tsx`, `src/screens/owner/OwnerHomeScreen.tsx`

**Problem:** When a captain/owner swiped a card to reject an item, the card flew off-screen to trigger the reject modal. If they tapped "CANCEL" or tapped outside the modal, the card stayed off-screen (stuck in swiped-out position) instead of snapping back.

**Fix:** Added `resetSwipeRef` to capture the card's reset callback:
```typescript
const resetSwipeRef = useRef<(() => void) | null>(null);

// onRejectItem now receives a resetSwipe callback
onRejectItem={(orderId, itemIndex, itemName, refundAmount, resetSwipe) => {
  resetSwipeRef.current = resetSwipe || null;
  setRejectModal({ ... });
}}
```

Modal close/cancel now calls `resetSwipeRef.current?.()` before clearing the ref — snaps the card back.

`SwipeableItemCard` signature updated:
```typescript
onRejectItem: (orderId, itemIndex, itemName, refundAmount, resetSwipe?: () => void) => void
```

---

### 5. QR Card Auto-Dismiss Fixes

**Files:** `src/screens/student/DashboardScreen.tsx`, `src/screens/student/StationeryScreen.tsx`

Applied the same fix as `OrdersScreen.tsx` (from v1.1.8) to two additional screens.

**Logic:**
```typescript
if (fresh.status === 'completed' || fresh.status === 'cancelled') {
  setSuccessOrder(null);  // DashboardScreen
  setSplitOrders(null);   // DashboardScreen
  setCreatedOrder(null);  // StationeryScreen
} else {
  setSuccessOrder(fresh); // update normally
}
```

Previously the QR card modal would stay open with a stale order after completion.

---

### 6. TopUp Modal Keyboard Fix

**File:** `src/components/student/TopUpModal.tsx`

**Changes:**
- `keyboardBehavior="interactive"` → `keyboardBehavior="extend"` — avoids layout jump when keyboard appears
- Added `onFocus={() => bottomSheetRef.current?.snapToIndex(1)}` on amount `TextInput` — snaps sheet to full height (95%) when user taps the input, ensuring the input and Razorpay button are fully visible above the keyboard

---

### 7. Stationery Analytics Cleanup

**File:** `src/screens/stationery_owner/StationeryAnalyticsScreen.tsx`

Removed the "Wallet Balance" section from the stationery owner analytics screen:
- Removed `balance` from Redux selector
- Removed the green wallet balance card from the UI

**Why:** Stationery owners don't use a wallet the same way as students; showing wallet balance in analytics is misleading and not actionable.

---

## All Files Changed (v1.2.0)

### Mobile Frontend — Android-tamil (3 new, 12 modified)

| File | Type | Changes |
|------|------|---------|
| `src/screens/shared/MaintenanceScreen.tsx` | **NEW** | Full-screen maintenance overlay with animations |
| `src/services/maintenanceService.ts` | **NEW** | Public endpoint check for maintenance status |
| `FRONTEND_CHANGELOG.md` | **NEW** | Internal changelog documentation |
| `android/app/build.gradle` | Modified | versionCode bumped to 21 |
| `package.json` | Modified | version bumped to 1.2.0 |
| `src/services/api.ts` | Modified | 503 → `MAINTENANCE_MODE_DETECTED` event |
| `src/services/notificationService.ts` | Modified | Added `refreshTokenRegistration()` export |
| `src/navigation/RootNavigator.tsx` | Modified | Calls `refreshTokenRegistration` on app resume |
| `src/store/slices/authSlice.ts` | Modified | Logout sends `deviceId` for targeted token removal |
| `src/screens/captain/CaptainHomeScreen.tsx` | Modified | Swipe card reset on reject modal dismiss/cancel |
| `src/screens/owner/OwnerHomeScreen.tsx` | Modified | Swipe card reset on reject modal dismiss/cancel |
| `src/screens/student/DashboardScreen.tsx` | Modified | QR card auto-dismiss on completed/cancelled |
| `src/screens/student/StationeryScreen.tsx` | Modified | QR card auto-dismiss on completed/cancelled |
| `src/components/student/TopUpModal.tsx` | Modified | keyboard extend mode + snapToIndex on focus |
| `src/screens/stationery_owner/StationeryAnalyticsScreen.tsx` | Modified | Removed wallet balance card |

---

## iOS Implementation Notes for v1.2.0

### Maintenance Mode
- `MaintenanceScreen` uses React Native `Animated` — works identically on iOS
- `DeviceEventEmitter` works on iOS — same pattern
- `maintenanceService` uses plain `axios` — no platform differences
- `StatusBar.setBarStyle('light-content')` — works on iOS
- No iOS-specific changes needed; the overlay approach is platform-agnostic

### FCM Token Re-registration
- `getToken(getMessaging())` works on iOS (APNs → FCM mapping)
- Same `refreshTokenRegistration(userId)` call applies
- iOS: ensure `initializeNotifications()` does NOT return early if display permission denied (FCM tokens work without display permission on iOS too)

### Swipe Reset
- `useRef` callback pattern is React Native — identical on iOS
- `Animated.timing` reset works on iOS

### Keyboard Behavior
- `keyboardBehavior="extend"` on `@gorhom/bottom-sheet` works on iOS
- `snapToIndex(1)` on focus — works identically
- iOS may additionally need `keyboardDismissMode="on-drag"` — test on iOS

---

## New API Endpoints (v1.2.0)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/v1/app/maintenance-status` | None (public) | Check if app is in maintenance mode |

**Response:**
```json
{
  "success": true,
  "data": {
    "maintenanceEnabled": true,
    "message": "We're upgrading the system. Back shortly!",
    "estimatedDuration": 2,
    "startedAt": "2026-04-08T10:00:00.000Z"
  }
}
```

---

## Environment Variables (v1.2.0)

```env
APP_API_KEY=272183449088151d1938eca9e9de6cd2cb7a7001ad073cc050352117c1b52ca3
# (already in .env — used by maintenanceService for X-App-Key header)
```

No new environment variables required.

---

---

# CampusOne v1.1.8 — Changelog for iOS Developer

> **Date:** 2026-03-31 (v1.1.7 initial) / 2026-04-05 (v1.1.8 updated)
> **Android branch:** `Android-tamil` (latest commit: `aaf3788`)
> **Backend branch:** `main` (latest commit: `896df9a`)
> **Web frontend branch:** `main` (latest commit: `1537dd7`)
> **Version:** 1.1.8 (versionCode 19)

---

## Summary

v1.1.8 builds on v1.1.7 with **Instagram-style swipeable bottom sheets** for all modals, **live location tracking** for superadmin, **push notification management dashboard**, **critical FCM token lifecycle fixes**, **per-item status display** on orders, **swipe-to-dismiss notifications**, **eat-mode notification fixes**, and **8 reported bug fixes**.

---

## What's New in v1.1.8 (April 4-5, 2026)

### New Features

1. **Instagram-Style Swipeable Bottom Sheets** — Cart, Wallet, TopUp, and Notifications modals
2. **Live Location Tracking** — Superadmin can see all mobile app users on a real-time map
3. **Push Notification Management Dashboard** — Superadmin can broadcast notifications with role targeting
4. **Per-Item Status on My Orders & Order History** — Shows accepted/rejected/delivered per item with refund breakdown
5. **Swipe-to-Dismiss Notifications** — Individual notification cards can be swiped left to delete
6. **Profile Photo Locked by Admin** — Shows lock badge and "managed by admin" text

### Bug Fixes

1. **FCM token registration failing for 245/246 students** — Token registration was blocked by denied notification display permission
2. **Eat-mode users not receiving push notifications** — Socket handler didn't detect own orders when mode switched
3. **Cleared notifications returning on app reopen** — Local clear didn't tell backend; re-fetch brought them back
4. **Cart pay button hidden at 60% snap point** — Footer was inside scroll content instead of pinned
5. **TopUp modal cursor in center** — Removed `textAlign: center` from amount input
6. **"Start Ordering" navigated to wrong screen** — Now always goes to Dashboard
7. **QR card stayed open after delivery** — Now auto-dismisses on completed/cancelled
8. **Wallet modal header overlapping balance card** — Header was a plain View sibling to BottomSheetView
9. **Force logout didn't clean FCM tokens** — Old device kept receiving push indefinitely
10. **Profile/Settings page crash** — Styles referenced `colors` instead of `c` in createStyles function

---

## Detailed Changes

---

### 1. Instagram-Style Swipeable Bottom Sheets

**Files:** `CartBottomSheet.tsx`, `WalletModal.tsx`, `TopUpModal.tsx`, `NotificationsModal.tsx`, `App.tsx`

All modals converted from React Native `Modal` to `@gorhom/bottom-sheet` `BottomSheetModal`:

| Component | Snap Points | Behavior |
|-----------|-------------|----------|
| **Cart** | `['60%', '95%']` | Half → full, pay button always pinned via `footerComponent` |
| **Wallet** | `['55%', '95%']` | Half → full, header inside content flow (no overlap) |
| **TopUp** | `['55%', '90%']` | Half → full, built-in keyboard handling via `keyboardBehavior="interactive"` |
| **Notifications** | `['55%', '95%']` | Half → full, `BottomSheetFlatList` for gesture-aware scrolling |

**Implementation details:**
- Added `BottomSheetModalProvider` in `App.tsx` (wraps entire app)
- `BottomSheetBackdrop` with tap-to-dismiss and 0.6 opacity
- `BottomSheetScrollView` / `BottomSheetFlatList` for gesture-aware scrolling
- Cart footer uses `footerComponent` prop — pay button **always visible** at both snap points
- Drag handle pill indicator at top of each sheet
- Same `visible/onClose` prop interface — no parent component changes needed
- TopUp modal: `enablePanDownToClose` disabled during payment (`loading` state) to prevent accidental dismiss

---

### 2. Live Location Tracking (Full Feature)

#### 2a. Backend — Location Module

**New files:**
- `src/modules/location/location.store.ts` — In-memory `Map<userId, LiveLocation>` store
- `src/modules/location/location.socket.ts` — Socket.IO event handlers
- `src/modules/location/location.routes.ts` — REST endpoint

**Modified files:**
- `src/config/constants.ts` — Added 4 socket event constants
- `src/server.ts` — Registered socket handlers, init/shutdown
- `src/app.ts` — Registered REST route

**Socket Events:**

| Direction | Event | Payload |
|-----------|-------|---------|
| Mobile → Backend | `location:update` | `{ latitude, longitude, accuracy }` |
| Mobile → Backend | `location:stop` | *(none)* |
| Backend → Web | `location:live` | `{ userId, name, role, phone, department, year, avatarUrl, latitude, longitude, accuracy, updatedAt }` |
| Backend → Web | `location:offline` | `{ userId }` |

**REST Endpoint:**

```
GET /api/v1/superadmin/live-locations
Auth: superadmin only
Returns: { success, data: LiveUser[], summary: { total, students, captains, owners } }
```

**In-Memory Store:**
- Upsert on each `location:update` event
- Auto-cleanup: removes entries older than 2 minutes (stale threshold), runs every 60 seconds
- User profile (name, role, department, year, avatarUrl) cached on socket for 5 minutes
- Broadcasts `location:offline` when stale entries are cleaned

**Superadmin Room:**
- Room name: `superadmin:locations`
- Superadmin sockets auto-join on connection

#### 2b. Mobile — Location Service & Permission Gate

**New files:**
- `src/services/locationService.ts` — GPS watcher + socket emit
- `src/components/common/LocationPermissionGate.tsx` — Full-screen permission blocker

**Modified files:**
- `android/app/src/main/AndroidManifest.xml` — Added `ACCESS_FINE_LOCATION` + `ACCESS_COARSE_LOCATION`
- `android/build.gradle` — Added `googlePlayServicesVersion = "21.3.0"`
- `package.json` — Added `react-native-geolocation-service` ^5.3.1
- `src/navigation/RootNavigator.tsx` — Permission check + tracking lifecycle

**Location Service API:**

```typescript
isLocationPermissionGranted(): Promise<boolean>
requestLocationPermission(): Promise<'granted' | 'denied' | 'never_ask_again'>
startLocationTracking(): void    // getCurrentPosition() + watchPosition()
stopLocationTracking(): void     // clearWatch() + emit location:stop
```

**Key behaviors:**
- `getCurrentPosition()` fires immediately for first fix (no waiting for movement)
- `watchPosition()` with `distanceFilter: 0`, `interval: 15000ms`, `fastestInterval: 10000ms`
- Emits to socket only if user moved 10+ meters (haversine check in `emitLocation()`)
- Stops GPS watch on app background, resumes on foreground
- Permission requested **4 seconds after auth** to avoid clashing with notification permission dialog

**Permission Gate:**
- Full-screen dark overlay (`zIndex: 99998`)
- Two states: `denied` (re-request button) / `never_ask_again` (open Settings button)
- Re-checks permission on every foreground resume

**iOS equivalent needed:**
- `NSLocationWhenInUseUsageDescription` in Info.plist
- Use `CoreLocation` with `requestWhenInUseAuthorization()`
- Same socket emit pattern: `socket.emit('location:update', { latitude, longitude, accuracy })`
- Same background/foreground lifecycle: stop on background, resume on foreground

#### 2c. Web Dashboard — Live Tracking Map

**New file:** `components/superadmin/superadmin-live-tracking.tsx`

**Features:**
- Leaflet map with OpenStreetMap tiles, centered on campus (13.0105, 80.2354)
- Layer switching: Street, Satellite (Esri/ArcGIS), Terrain (OpenTopoMap)
- Role-colored markers: blue=student, orange=captain, green=owner
- Click marker for popup: name, role, department, year, phone, last seen, accuracy
- Stats bar: online count by role
- Sidebar: search, role filters, scrollable user list
- Real-time via Socket.IO (`location:live` / `location:offline`)
- Initial load via REST (`GET /superadmin/live-locations`)

---

### 3. Push Notification Management Dashboard (Superadmin)

#### 3a. Backend — Push Module

**New files:**
- `src/modules/push/broadcast.model.ts` — Broadcast history model (90-day TTL auto-delete)
- `src/modules/push/push.routes.ts` — 3 endpoints

**New API Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/superadmin/push/token-stats` | Token registration stats: by role, by platform, with/without token counts |
| `POST` | `/superadmin/push/broadcast` | Send push + in-app notification + socket broadcast with role targeting |
| `GET` | `/superadmin/push/history` | Last 50 broadcasts with delivery stats |

**Broadcast POST body:**
```json
{
  "title": "Campus closed tomorrow",
  "body": "Due to maintenance, campus will be closed.",
  "roles": ["student", "captain"]  // optional — omit for all users
}
```

**Broadcast response:**
```json
{
  "broadcastId": "...",
  "totalTargeted": 4,
  "totalDelivered": 3,
  "totalFailed": 1
}
```

#### 3b. Web Dashboard — Push Notifications Component

**New file:** `components/superadmin/superadmin-push-notifications.tsx`

**Features:**
- Token health stats: total users, push enabled, no token, total tokens
- Role breakdown with token counts (students: 1/246, captains: 1/3, etc.)
- Platform breakdown (Android/iOS)
- Compose form: title, message, role targeting (student/captain/owner checkboxes)
- Reachable user count preview
- Send button with loading/success/error feedback
- Broadcast history: title, body, target roles, delivered/failed counts, timestamps

---

### 4. FCM Token Lifecycle Fixes (CRITICAL)

**Problem discovered:** 245 out of 246 students had ZERO FCM tokens in the database. Push notifications were silently failing for almost everyone.

#### 4a. Root Cause: Token Registration Blocked by Permission

**File:** `notificationService.ts`

`initializeNotifications()` previously returned early if notification display permission was denied. This skipped FCM token registration entirely. FCM tokens work independently of display permission.

**Fix:** Removed the early return. Token registration now ALWAYS runs regardless of display permission. Added retry logic in catch block.

#### 4b. Stale Token Filter Too Aggressive

**File:** `push-notification.service.ts` (backend)

The filter `if (!t.lastUsedAt) return false` discarded tokens without a timestamp. Changed to `return true` — tokens without `lastUsedAt` are treated as fresh.

Fixed in TWO places: `sendOrderStatusPush()` and `sendGeneralPush()`.

#### 4c. Force Logout Didn't Clean FCM Tokens

**Files:** `RootNavigator.tsx` (frontend), `auth.service.ts` (backend), `auth.controller.ts` (backend)

| Scenario | Before | After |
|----------|--------|-------|
| User taps Logout | Frontend DELETE sometimes failed silently | Backend also cleans tokens server-side in logout handler |
| Force logout (another device) | Old device's token stayed in DB forever | Backend removes old device's tokens during login flow |
| Force logout frontend | `resetAuth()` only | Now calls `unregisterToken()` before clearing auth |

**Backend login flow now:**
1. Find old active sessions (different deviceId)
2. Mark old sessions inactive
3. Emit force_logout via Socket.IO + FCM
4. **NEW:** `$pull` FCM tokens matching old deviceIds from User document

Applied to BOTH login flows: `login()` and `loginByPhone()`.

#### 4d. Periodic Stale Token Cleanup

**File:** `server.ts`

New scheduled task runs every 6 hours (+ once at startup):
```typescript
User.updateMany({}, { $pull: { fcmTokens: { lastUsedAt: { $lt: 14_days_ago } } } })
```

---

### 5. Per-Item Status on My Orders Page

**File:** `OrdersScreen.tsx`

Previously, item status badges only showed for `partially_ready` and `partially_delivered` orders. Now shows for ALL orders:

| Item Status | Badge | Visual Treatment |
|-------------|-------|-----------------|
| `pending` | "Pending" (gray) | Normal |
| `preparing` | "Preparing" (yellow) | Normal |
| `ready` | "Ready" (green) | Normal |
| `delivered` | "Delivered" (green) | Normal |
| `rejected` | "Rejected" (red) | Name ~~strikethrough~~, image dimmed 40%, price hidden, green "Rs. X refunded" text |

**Total adjusted for refunds:**
```
Order Total     Rs. 258
Refunded       - Rs. 129
────────────────────────
Paid            Rs. 129
```

---

### 6. Per-Item Status on Order History Page

**File:** `OrderHistoryScreen.tsx`

Same treatment as My Orders:
- Per-item status badges: Delivered, Ready, Preparing, Pending, "Rejected & Refunded"
- Rejected items: ~~strikethrough~~, dimmed, refund text
- Total breakdown with refund deduction
- Smart fallback: defaults to `rejected` for cancelled orders, `delivered` for completed

---

### 7. Eat-Mode Users Not Receiving Notifications Fix

**Files:** `socketService.ts`, `RootNavigator.tsx`

**Root cause:** When a captain/owner placed an eat-mode order and switched to work mode, the socket handler checked `userMode === 'eat'` for popup display but ALWAYS set the dedup key. FCM arriving later was caught by dedup and skipped.

**Fix:**
- Added `user?: string` to `OrderUpdatePayload` (backend already sends user ID)
- Added `userId` parameter to `setupSocketListeners(dispatch, userRole, userMode, userId)`
- New logic: `isOwnOrder = payload.user === userId`
- Popup shown for: students OR eat-mode OR **user's own order** (any mode)
- Personal orders always fetch `fetchMyActiveOrders()` + wallet balance
- Staff in work mode still also refreshes shop orders

---

### 8. Swipe-to-Dismiss Notifications

**Files:** `NotificationsScreen.tsx`, `userSlice.ts`

- Added `removeNotification(id: string)` reducer
- Each card wrapped in `Swipeable` from `react-native-gesture-handler`
- Swipe left reveals red "Delete" action with animated scale
- Threshold: 60px
- Haptic feedback on dismiss
- **Backend sync:** Calls `walletService.deleteNotification(id)` on swipe-dismiss
- **Backend sync:** Calls `walletService.clearAllNotifications()` on "Clear All"
- Prevents cleared notifications from returning on app reopen

---

### 9. QR Card Auto-Dismiss on Delivery

**File:** `OrdersScreen.tsx`

Added check in the Redux sync `useEffect`: when `selectedOrder` status changes to `completed` or `cancelled`, calls `setSelectedOrder(null)` to auto-close the QR modal.

---

### 10. Profile Photo Managed by Admin

**File:** `ProfileScreen.tsx`

- Replaced `TouchableOpacity` avatar with non-tappable `View`
- Removed upload action sheet (`handleAvatarPress` no longer called)
- Added lock badge: small gray circle with lock icon at bottom-right of avatar
- Added "Profile photo is managed by admin" text below profile card
- Styles use `c.card` and `c.textMuted` (fixed crash from using `colors` instead of `c` in createStyles)

---

### 11. Removed Promotions from Notification Settings

**File:** `NotificationSettingsScreen.tsx`

Removed the `{ key: 'promotions', title: 'Promotions & Offers', ... }` entry from the settings array.

---

### 12. Wallet Modal Layout Fix

**File:** `WalletModal.tsx`

**Bug:** Header ("Wallet" / "Balance & transactions") was a plain `View` sibling to `BottomSheetView`. The bottom sheet's internal layout didn't account for the header height, causing the blue balance card to overlap it.

**Fix:** Moved header INSIDE the `BottomSheetView` (empty/loading state) and `BottomSheetFlatList` (via `ListHeaderComponent`). Everything is now in a single layout flow. Header padding adjusted: `paddingTop: 8`, `paddingBottom: 16`.

---

## All Files Changed (v1.1.8)

### Backend — mecfoodapp-backend (5 new, 5 modified)

| File | Changes |
|------|---------|
| `src/modules/location/location.store.ts` | **NEW** — In-memory location store with avatarUrl |
| `src/modules/location/location.socket.ts` | **NEW** — Socket event handlers |
| `src/modules/location/location.routes.ts` | **NEW** — REST endpoint (includes avatarUrl) |
| `src/modules/push/broadcast.model.ts` | **NEW** — Broadcast history model |
| `src/modules/push/push.routes.ts` | **NEW** — Token stats, broadcast, history endpoints |
| `src/config/constants.ts` | Added 4 location socket event constants |
| `src/server.ts` | Location socket + init + FCM stale cleanup (6h cron) |
| `src/app.ts` | Registered location + push routes |
| `src/services/push-notification.service.ts` | Stale token filter: keep tokens without `lastUsedAt` (2 places) |
| `src/modules/auth/auth.controller.ts` | Logout: server-side FCM token cleanup |
| `src/modules/auth/auth.service.ts` | Login: remove old device FCM tokens (both login flows) |

### Mobile Frontend — Android-tamil (2 new, 24 modified across 2 commits)

**Commit `84a4baf`** — feat: swipeable bottom sheets, live tracking, eat-mode fix, item status UI

| File | Changes |
|------|---------|
| `src/services/locationService.ts` | **NEW** — GPS watcher + socket emit |
| `src/components/common/LocationPermissionGate.tsx` | **NEW** — Permission blocker screen |
| `App.tsx` | Added `BottomSheetModalProvider` |
| `android/app/src/main/AndroidManifest.xml` | Added location permissions |
| `android/build.gradle` | Added `googlePlayServicesVersion` |
| `package.json` | Added `react-native-geolocation-service`, version 1.1.8 |
| `src/components/student/CartBottomSheet.tsx` | Converted to `BottomSheetModal` + `footerComponent` |
| `src/components/student/WalletModal.tsx` | Converted to `BottomSheetModal` |
| `src/components/student/TopUpModal.tsx` | Fixed cursor position |
| `src/navigation/RootNavigator.tsx` | Location permission, tracking, eat-mode fix |
| `src/screens/student/OrdersScreen.tsx` | Fixed navigation, per-item status, refund total |
| `src/screens/student/OrderHistoryScreen.tsx` | Per-item status, refund breakdown |
| `src/screens/student/NotificationsScreen.tsx` | Swipe-to-dismiss |
| `src/services/socketService.ts` | Added `userId` param, `isOwnOrder` check |
| `src/store/slices/userSlice.ts` | Added `removeNotification` reducer |

**Commit `aaf3788`** — fix: 8 bug fixes

| File | Changes |
|------|---------|
| `android/app/build.gradle` | versionCode 19 |
| `package.json` | version 1.1.8 |
| `src/components/student/NotificationsModal.tsx` | Converted to `BottomSheetModal` |
| `src/components/student/TopUpModal.tsx` | Converted to `BottomSheetModal` with keyboard handling |
| `src/components/student/WalletModal.tsx` | Fixed header overlap (moved into content flow) |
| `src/navigation/RootNavigator.tsx` | Force logout calls `unregisterToken()` |
| `src/screens/student/NotificationSettingsScreen.tsx` | Removed "Promotions & Offers" |
| `src/screens/student/NotificationsScreen.tsx` | Backend sync on clear/swipe-dismiss |
| `src/screens/student/OrdersScreen.tsx` | QR auto-dismiss on delivery |
| `src/screens/student/ProfileScreen.tsx` | Admin-managed photo lock + fixed crash |
| `src/services/notificationService.ts` | FCM token always registered + retry |

### Web Frontend — mecfoodapp-frontend (2 new, 6 modified across 5 commits)

| File | Changes |
|------|---------|
| `components/superadmin/superadmin-live-tracking.tsx` | **NEW** — Live tracking map |
| `components/superadmin/superadmin-push-notifications.tsx` | **NEW** — Push notification dashboard |
| `components/admin-layout/admin-sidebar.tsx` | Added Live Tracking + Push Notifications nav items |
| `app/dashboard/superadmin/page.tsx` | Added tracking + push tabs |
| `next.config.mjs` | CSP: added `unpkg.com`, tile server domains |
| `package.json` | Added leaflet, react-leaflet, @types/leaflet |
| `pnpm-lock.yaml` | Updated lockfile |

---

## iOS Implementation Notes

### Bottom Sheets
- Android uses `@gorhom/bottom-sheet` (React Native)
- iOS should use the same library — it supports iOS natively
- Snap points, backdrop, and gesture handling work identically on iOS
- `keyboardBehavior="interactive"` for TopUp modal

### Location Tracking
- Add `NSLocationWhenInUseUsageDescription` to Info.plist
- Message: "CampusOne needs your location while using the app for campus safety and services."
- Use same `react-native-geolocation-service` — it supports iOS via CoreLocation
- Same socket emit pattern: `socket.emit('location:update', { latitude, longitude, accuracy })`
- Request location permission 4 seconds after auth (avoid clashing with notification permission)
- Stop tracking on app background, resume on foreground

### FCM Token Registration
- Ensure `initializeNotifications()` does NOT return early if notification permission is denied
- FCM tokens work on iOS even without display permission (silent push)
- Call `unregisterToken()` in force logout handler
- iOS uses APNs token mapped to FCM — same backend endpoints

### Profile Photo
- Avatar is view-only (no upload action sheet)
- Show lock badge + "managed by admin" text
- `handleAvatarPress` and `handleAvatarUpload` functions still exist but are not called from JSX

### Notification Settings
- Remove "Promotions & Offers" entry from settings array
- Only keep: Order Updates, Wallet Alerts, Announcements

---

## New API Endpoints (Full List)

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| `POST` | `/orders/:id/items/:itemIndex/accept` | captain, owner | Accept a single item |
| `POST` | `/orders/:id/items/:itemIndex/reject` | captain, owner | Reject item (partial refund) |
| `PUT` | `/orders/:id/accept-all` | captain, owner | Accept all pending items |
| `PUT` | `/orders/:id/reject-all` | captain, owner | Reject all items (full refund) |
| `GET` | `/superadmin/live-locations` | superadmin | All active user locations |
| `GET` | `/superadmin/push/token-stats` | superadmin | FCM token registration stats |
| `POST` | `/superadmin/push/broadcast` | superadmin | Send push broadcast with targeting |
| `GET` | `/superadmin/push/history` | superadmin | Last 50 broadcast records |

---

## Environment Variables

```env
CLUSTER_WORKERS=1
MAX_TOPUP_PER_TXN=5000
MAX_TOPUP_PER_DAY=5000
MAX_WALLET_BALANCE=50000
# Firebase (required for push notifications)
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
```

No new environment variables for live location tracking or push dashboard (uses in-memory store + existing Firebase config).

---

## API Response Changes

### Order items:
```json
{
  "items": [
    {
      "name": "Chicken 65",
      "quantity": 1,
      "price": 129,
      "subtotal": 129,
      "itemStatus": "rejected",
      "rejectedAt": "2026-04-04T10:30:00Z",
      "refundAmount": 129
    }
  ]
}
```

### Socket order payload (includes userId for own-order detection):
```json
{
  "orderId": "...",
  "userId": "...",
  "orderNumber": "ORD-20260404-0005",
  "status": "preparing",
  "items": [
    { "name": "Chicken 65", "itemStatus": "preparing", "delivered": false }
  ]
}
```

### Live location payload:
```json
{
  "userId": "665a1b...",
  "name": "Arun Kumar",
  "role": "student",
  "phone": "9876543210",
  "department": "CSE",
  "year": 3,
  "avatarUrl": "/uploads/avatars/...",
  "latitude": 13.0105,
  "longitude": 80.2354,
  "accuracy": 12.5,
  "updatedAt": "2026-04-04T10:30:00.000Z"
}
```

### Token stats response:
```json
{
  "totalUsers": 255,
  "usersWithTokens": 4,
  "usersWithoutTokens": 251,
  "totalTokens": 4,
  "byRole": {
    "student": { "total": 246, "withToken": 1 },
    "captain": { "total": 3, "withToken": 1 },
    "owner": { "total": 4, "withToken": 2 }
  },
  "byPlatform": { "android": 4, "ios": 0 }
}
```

### User profile:
```json
{
  "role": "accountant",
  "userTag": "MEC ADMIN"
}
```
