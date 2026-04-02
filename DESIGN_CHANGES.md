# Frontend Design Changes — 28 Mar 2026

UI/UX-only changes made during this session. No backend or API logic — purely visual and interaction design.

---

## 1. Student Tab Bar

**File**: `src/navigation/tabs/StudentTabs.tsx`

| Property | Before | After |
|----------|--------|-------|
| Top border | 1px solid border line | No border, soft shadow (`shadowOpacity: 0.06`) |
| Icon size | 22px | 20px |
| Active indicator | 56x32 pill, 15% accent | 44x30 pill, 9% accent |
| Icons | `home`, `clipboard`, `qr-code` | `home`, `receipt`, `scan` |
| Labels | 11px, 600 weight, default tab bar | 10px, 600 weight, letter-spacing 0.3, custom render |
| Tab bar height | 56px + safe area | 60px + safe area |
| Keyboard | Stays visible | Hides on keyboard open |
| Top padding | 4px | 10px |

---

## 2. Dashboard Active Orders → Swipeable Carousel

**File**: `src/screens/student/DashboardScreen.tsx`

### Before
- Stacked vertical cards with static blue cube icon
- Multiple cards visible at once
- Tap navigates to Orders tab

### After
- **Horizontal swipeable carousel** (`FlatList` with `pagingEnabled`)
- Each card is full-width, snap-to-interval scrolling
- **Animated pulsing ring icon**: dashed circle border with wave pulse animation (scales 1→1.8x while fading out), color matches order status
- Inner dotted circle with solid color dot center
- **Page indicator dots** below carousel (active dot wider: 18px vs 6px, accent blue)
- Dots track active index from scroll position
- **Tap opens QR drawer** directly (not Orders tab)
- Status badge includes colored dot next to label
- Card style: card background with subtle shadow, no blue tint

---

## 3. Orders Screen Empty State

**File**: `src/screens/student/OrdersScreen.tsx`

### Before
- Static cube icon in 64x64 square
- "No active orders" / "Place an order to get started"
- No call-to-action

### After
- **Animated entrance**: fades in + slides up on mount (600ms)
- **Pulsing icon**: 96px dashed outer ring + 64px inner circle, bag icon in accent blue, gently pulsing scale (1→1.08)
- "No active orders" (18px, 800 weight)
- "Your orders will appear here once you place one from the menu" (14px, multiline)
- **"Start Ordering" button**: accent blue, 15px bold text + bouncing arrow (→) that nudges right repeatedly
- **Hint row**: "Orders are tracked in real-time" with flash icon (50% opacity)
- Navigates to Home tab on button press

### View Order History Button
- **Before**: Full-width card with border, 14px bold text, 18px icon
- **After**: Centered inline link, 12px 500-weight text, 14px icon, no background/border

---

## 4. Order Status Popup (Full-Screen)

**File**: `src/components/common/OrderStatusPopup.tsx`

### Before
- Used `<Modal>` (blocked all touches for 5 seconds on iOS)
- Showed `"Order #8743"` as headline
- No pickup token display
- Static status messages

### After
- **Absolutely positioned `<View>`** with zIndex 9999 (no touch blocking)
- **Food item names as headline**: "Belgian Chocolate Shake, Blue Diamond Mojito"
- **Pickup token pill**: translucent `rgba(255,255,255,0.18)` rounded container with large token number
- Dynamic messages: "Your Chicken Fried Rice is being prepared!"
- StatusBar switches to light-content

---

## 5. Order Success Animation (Money Deducted Toast)

**File**: `src/components/common/OrderAnimation.tsx`

| Property | Before | After |
|----------|--------|-------|
| Toast start position | 60px below | 100px below |
| Toast animation | Spring (bouncy, friction 6) | `Easing.out(cubic)` 350ms (smooth) |
| Toast opacity | Instant appear | Fade in 0→1 over 250ms |
| Content delay | 400ms | 250ms |
| Toast delay | 400ms (same as content) | 500ms (staggered after content) |
| StatusBar | Not handled | light-content on mount |

---

## 6. Sign Out Popup

**File**: `src/components/student/ProfileDropdown.tsx`

| Property | Before | After |
|----------|--------|-------|
| Icon area | 56x56, single circle | 64x64 outer ring + 44x44 inner circle (double-circle depth) |
| Icon background | `rgba(239,68,68,0.12)` | Outer: `0.08` + dashed border `0.15`, Inner: `0.12` |
| Card border | 1px border | No border (cleaner) |
| Card radius | 20px | 24px |
| Card padding | 24px | 28px |
| Title | 18px, 700 weight | 20px, 800 weight |
| Message | 14px, full sentence | 13px, shorter copy |
| Button radius | 12px | 14px |
| Confirm color | `colors.error` | `#dc2626` (darker red) |
| Button text weight | 600 | 700 |

---

## 7. Delete Account Popup

**File**: `src/screens/student/ProfileScreen.tsx`

| Property | Before | After |
|----------|--------|-------|
| Card radius | 24px | 28px |
| Card padding | 24px | 28px |
| Card border | 1px border | No border |
| Shadow opacity | 0.3 | 0.35 |
| Icon size | 60x60 | 64x64 |
| Icon border | None | 2px ring border |
| Red icon bg | `rgba(0.12)` | `rgba(0.08)` with `rgba(0.18)` border |
| Title | 18px, 700 | 20px, 800 |
| Balance amount | 28px, 800 | 32px, 900 |
| Warning box radius | 14px | 16px |
| Button radius | 14px | 16px |
| Delete button | `#ef4444` | `#dc2626` |
| Button text weight | 600 | 700 |

---

## 8. Top Up Wallet Drawer

**File**: `src/components/student/TopUpModal.tsx`

| Property | Before | After |
|----------|--------|-------|
| Sheet radius | 24px | 28px |
| Sheet bottom padding | 36px | 40px |
| Handle width | 40px | 36px |
| Title | 20px, 800 weight | 22px, 900 weight |
| Balance card radius | 14px | 16px |
| Balance value | 20px, 800 | 22px, 900 |
| Amount input | Left-aligned, 20px, 600 weight, 1.5px border | **Centered**, 22px, 700 weight, 1px border |
| Input radius | 14px | 16px |
| Quick buttons gap | 8px | 10px |
| Quick button text | 12px, 600 | 13px, 700 |
| Quick button radius | 12px | 14px |
| Submit button | `#1e3a5f` (dark navy), 16px radius | `#3b82f6` (accent blue), 18px radius |
| Submit text | 15px, 700 | 16px, 800 |
| Help text | 11px | 12px + 4px top margin |

---

## 9. In-App Notifications

**Files**: `src/components/student/NotificationsModal.tsx`, `src/screens/student/NotificationsScreen.tsx`

### Added
- **Pickup ID row** below each order notification message
- Blue QR icon (12px) + "Pickup ID: 8799" text (12px, 700 weight, `#3b82f6`)
- Only shows for order-type notifications with a `pickupToken` in data

---

## 10. Search Modal

**File**: `src/components/student/SearchModal.tsx`

- Added `keyboardDismissMode="on-drag"` to results FlatList
- Bottom padding increased: 40px → 80px (breathing room below last result)

---

## 11. Login Success Animation

**File**: `src/navigation/RootNavigator.tsx`

### New Component: `LoginSuccessOverlay`
- Full-screen green (`#10b981`) overlay, zIndex 9999
- Staggered animations:
  - **Checkmark icon**: 120x120 semi-transparent circle, 80px icon, spring scale 0→1
  - **"Login Successful"**: 22px, 700 weight, fade in at 300ms
  - **User's name**: 28px, 900 weight, centered, fade in at 500ms
  - **Role badge**: translucent pill (`rgba(255,255,255,0.2)`), 14px 600 weight, fade in at 500ms
  - **"Welcome to CampusOne"**: 16px, 85% white, fade in at 700ms
  - **"Start using it and you'll never stop!"**: 14px, 60% white, fade in at 900ms
- Auto-dismisses after 3 seconds
- StatusBar light-content during display

---

## 12. Keyboard Handling (Global)

| Screen/Component | Change |
|-----------------|--------|
| DashboardScreen FlatList | Added `keyboardDismissMode="on-drag"` |
| SearchModal FlatList | Added `keyboardDismissMode="on-drag"` |
| WalletScreen FlatList | Added `keyboardDismissMode="on-drag"` |
| ProfileScreen ScrollView | Added `keyboardDismissMode="on-drag"` |
| StudentTabs | Added `tabBarHideOnKeyboard: true` |
| CaptainTabs (both modes) | Added `tabBarHideOnKeyboard: true` |
| OwnerTabs (both modes) | Added `tabBarHideOnKeyboard: true` |
