# Session Changelog — 28 Mar 2026

All changes made during this development session across 30 files (917 insertions, 317 deletions).

---

## 1. Real-Time Order Tracking & Socket Fixes

### OrderQRCard (`src/components/common/OrderQRCard.tsx`)
- Polls order status every 8 seconds via `orderService.getOrderById()` while modal is open
- Subscribes to Redux `activeOrders` + `orders` for instant status reflection
- Auto-closes on **any** status change (not just its own order) so the full-screen popup can render
- Dispatches both `fetchMyOrders()` + `fetchMyActiveOrders()` on close to refresh all screens
- Listens for `ORDER_STATUS_POPUP_EVENT` via `DeviceEventEmitter`

### Socket Handler (`src/services/socketService.ts`)
- Moved `fetchMyActiveOrders()` dispatch **before** dedup check — FCM can no longer block the Redux refetch
- Now dispatches both `fetchMyOrders()` + `fetchMyActiveOrders()` on every `order:status_changed` event
- Notification titles use food item names instead of order IDs
- Notification body includes pickup token: `"• Pickup ID: 8799"`
- Added `pickupToken` to `OrderUpdatePayload` interface

### FCM Handler (`src/services/notificationService.ts`)
- Also dispatches `fetchMyOrders()` + `fetchMyActiveOrders()` for order status changes
- Creates a **local Notifee notification** for order status changes (previously only emitted popup event)
- Notification text uses food items + pickup token
- Redux notification data now includes `pickupToken` and `itemNames`

### Orders Slice (`src/store/slices/ordersSlice.ts`)
- `fetchMyActiveOrders.fulfilled` now **cross-updates** matching orders in the `orders` array
- Ensures OrdersScreen (which reads `orders`, not `activeOrders`) reflects real-time changes

### iOS Notification Fix (`src/services/notificationService.ts`)
- Added `ios.foregroundPresentationOptions: { alert: true, badge: true, sound: true }` to all three Notifee display functions
- Added `interruptionLevel: 'timeSensitive'` on order-critical notifications
- **Root cause**: Notifee silently swallowed notifications on iOS foreground without these options

### DashboardScreen Sync (`src/screens/student/DashboardScreen.tsx`)
- Added `useEffect` to sync `successOrder` local state with Redux `activeOrders`

### CaptainEatScreen / CaptainEatOrdersScreen
- Same `successOrder` / `selectedOrder` sync with Redux

---

## 2. Notification Content Overhaul

### Notification Titles & Bodies
- **Before**: `"Order #ORD-20260327-0018"` / `"Your order is being prepared — Belgian Chocolate Shake"`
- **After**: `"Belgian Chocolate Shake, Blue Diamond Mojito"` / `"Your Belgian Chocolate Shake is being prepared! • Pickup ID: 8799"`

### OrderStatusPopup (`src/components/common/OrderStatusPopup.tsx`)
- Shows food item names as headline instead of `"Order #8743"`
- Shows pickup token in translucent pill below the message
- Status-specific messages reference food items
- **Replaced `<Modal>` with absolutely positioned `<View>`** (zIndex 9999) — no longer blocks touches on iOS
- Added `StatusBar.setBarStyle('light-content')` on mount

### In-App Notification List
- `NotificationsModal.tsx` + `NotificationsScreen.tsx`: added blue **"Pickup ID: XXXX"** row with QR icon below each order notification

### Events (`src/constants/events.ts`)
- Added `LOGIN_SUCCESS_EVENT` constant

---

## 3. Login & Auth UX

### Auto-Send OTP (`src/screens/shared/LoginScreen.tsx`)
- When phone number reaches country's `maxLen` (10 digits for India), OTP sends automatically
- Keyboard dismisses on auto-send
- Guarded against double submission with `submittingRef`

### Auto-Verify OTP (`src/screens/shared/OTPScreen.tsx`)
- When user manually types the 6th digit, verification triggers after 300ms delay
- Keyboard dismisses before verify
- Separate from SMS auto-read flow (won't double-fire)
- For new users: only auto-verifies if name is already filled

### Login Success Animation (`src/navigation/RootNavigator.tsx`)
- Full-screen green (`#10b981`) overlay with staggered animations:
  - Checkmark icon (spring scale 0→1)
  - "Login Successful" (fade in 300ms)
  - User's name (28px, 900 weight, fade in 500ms)
  - Role badge pill (fade in 500ms)
  - "Welcome to CampusOne" (fade in 700ms)
  - "Start using it and you'll never stop!" (fade in 900ms)
- Rendered in **RootNavigator** (survives Auth→Main navigation swap)
- OTPScreen + RegisterScreen emit `LOGIN_SUCCESS_EVENT` via `DeviceEventEmitter`
- Auto-dismisses after 3 seconds

---

## 4. Navigation & Stability Fixes

### Touch-Blocking Fix
- `OrderStatusPopup`: replaced `<Modal>` with absolute `<View>` — no longer creates a native window that blocks all touches for 5 seconds
- `OrderQRCard`: removed 150ms setTimeout delay, closes immediately on status change

### Navigation Bugs
- `CartScreen`: fixed fragile `navigation.getParent()?.navigate('Orders')` → `navigation.navigate('Orders')`
- `OwnerTabs`: fixed dynamic Tab.Screen name (`Home`/`StationeryDashboard` → consistent `"Dashboard"`)
- `types/index.ts`: updated `OwnerTabParamList` to match

### Stale Data
- `OrdersScreen`: added 15-second polling interval while screen is focused (cleans up on blur)
- Socket + FCM handlers both dispatch `fetchMyOrders()` alongside `fetchMyActiveOrders()`

### Polling Memory Leaks
- `CaptainHomeScreen` + `OwnerHomeScreen`: moved polling from `useEffect` to `useFocusEffect` — intervals only run while screen is visible, prevents duplicate intervals on AppState transitions

### Animation Leak
- `CaptainScannerScreen`: `Animated.loop` stored in ref, properly stopped when modal closes or component unmounts

---

## 5. Keyboard & Accessibility

### Keyboard Handling
- `keyboardDismissMode="on-drag"` on: DashboardScreen FlatList, SearchModal FlatList, WalletScreen FlatList, ProfileScreen ScrollView
- `tabBarHideOnKeyboard: true` on: StudentTabs, CaptainTabs, OwnerTabs

### StatusBar
- `OrderStatusPopup`: light-content on mount, restores on dismiss
- `OrderAnimation`: light-content on mount, restores on dismiss

### Accessibility
- `CaptainHomeScreen`: added labels to confirm modal Cancel/Action buttons, partial pickup dismiss
- `OwnerHomeScreen`: same confirm modal accessibility labels
- `CartScreen`: fixed inconsistent image placeholder color → `#3b82f6`

---

## 6. UI Design Changes

### Student Tab Bar (`StudentTabs.tsx`)
- Floating design: no border, soft shadow
- Smaller icons (20px), rounded pill highlight on active tab
- Cleaner icon set: `receipt` for Orders, `scan` for Scanner
- Compact 10px labels with letter-spacing
- Tab bar hides on keyboard

### Dashboard Active Orders (`DashboardScreen.tsx`)
- Horizontal swipeable carousel replacing stacked cards
- Animated pulsing ring icon (dashed circle + wave pulse, color matches status)
- Page indicator dots (active dot wider + blue), tracks scroll position
- Tap opens QR drawer directly

### Orders Empty State (`OrdersScreen.tsx`)
- Animated entrance (fade + slide up)
- Pulsing icon (dashed outer ring + inner circle, bag icon)
- "Start Ordering" button with bouncing arrow animation
- "Orders are tracked in real-time" hint
- "Order History" button: smaller inline text link

### Sign Out Popup (`ProfileDropdown.tsx`)
- Double-circle icon (outer ring + inner circle)
- Larger icon area (64px), darker red (#dc2626)
- Removed card border, rounder corners (24px)
- Bolder typography (800/700 weights)

### Delete Account Popup (`ProfileScreen.tsx`)
- Larger icon (64px) with ring border
- Extra-large balance display (32px, 900 weight)
- Rounder card (28px), no border, deeper shadow
- Darker red delete button (#dc2626)

### Top Up Wallet Drawer (`TopUpModal.tsx`)
- Rounder sheet corners (28px)
- Centered amount input (22px, 700 weight)
- Bigger quick amount buttons (13px, 700 weight)
- Blue submit button (#3b82f6) instead of dark navy
- Bolder title (22px, 900 weight)

### Order Success Animation (`OrderAnimation.tsx`)
- Fixed laggy "Money Deducted" toast
- Smooth cubic easing instead of bouncy spring
- Added opacity fade-in (0→1 over 250ms)
- Staggered timing: icon → content (250ms) → toast (500ms)

### Search Modal (`SearchModal.tsx`)
- `keyboardDismissMode="on-drag"`
- Increased bottom padding (40→80px)

---

## Files Modified (30)

| File | Changes |
|------|---------|
| `src/components/common/OrderAnimation.tsx` | Toast animation fix, StatusBar |
| `src/components/common/OrderQRCard.tsx` | Polling, auto-close, Redux sync |
| `src/components/common/OrderStatusPopup.tsx` | Modal→View, food items, pickup token |
| `src/components/student/NotificationsModal.tsx` | Pickup ID row |
| `src/components/student/ProfileDropdown.tsx` | Sign out popup redesign |
| `src/components/student/SearchModal.tsx` | Keyboard dismiss, padding |
| `src/components/student/TopUpModal.tsx` | Drawer UI polish |
| `src/constants/events.ts` | LOGIN_SUCCESS_EVENT |
| `src/navigation/RootNavigator.tsx` | Login animation, popup data |
| `src/navigation/tabs/CaptainTabs.tsx` | tabBarHideOnKeyboard |
| `src/navigation/tabs/OwnerTabs.tsx` | tabBarHideOnKeyboard, fixed screen name |
| `src/navigation/tabs/StudentTabs.tsx` | Tab bar redesign |
| `src/screens/captain/CaptainEatOrdersScreen.tsx` | selectedOrder sync |
| `src/screens/captain/CaptainEatScreen.tsx` | successOrder sync |
| `src/screens/captain/CaptainHomeScreen.tsx` | Polling fix, accessibility |
| `src/screens/captain/CaptainScannerScreen.tsx` | Animation leak fix |
| `src/screens/owner/OwnerHomeScreen.tsx` | Polling fix, accessibility |
| `src/screens/shared/LoginScreen.tsx` | Auto-send OTP |
| `src/screens/shared/OTPScreen.tsx` | Auto-verify OTP, login event |
| `src/screens/shared/RegisterScreen.tsx` | Login success event |
| `src/screens/student/CartScreen.tsx` | Navigation fix, placeholder color |
| `src/screens/student/DashboardScreen.tsx` | Carousel, pulsing ring, sync |
| `src/screens/student/NotificationsScreen.tsx` | Pickup ID row |
| `src/screens/student/OrdersScreen.tsx` | Empty state, polling, history btn |
| `src/screens/student/ProfileScreen.tsx` | Delete popup polish, keyboard |
| `src/screens/student/WalletScreen.tsx` | Keyboard dismiss |
| `src/services/notificationService.ts` | iOS fix, food items, refetch |
| `src/services/socketService.ts` | Food items, refetch, dedup fix |
| `src/store/slices/ordersSlice.ts` | Cross-update orders |
| `src/types/index.ts` | OwnerTabParamList update |
