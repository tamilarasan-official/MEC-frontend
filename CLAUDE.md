# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CampusOne is a multi-role campus services mobile app for Madras Engineering College (MEC). Built with React Native 0.83.1 (bare workflow, not Expo managed). The app handles food ordering, wallet payments (Razorpay), QR code scanning, and real-time order tracking across three mobile user roles: **Student**, **Captain** (food prep staff), and **Owner** (shop owner). Two additional roles (Accountant, Superadmin) exist but are web-only.

## Commands

```bash
npm start              # Start Metro bundler
npm run android        # Build and run on Android
npm run ios            # Build and run on iOS
npm run lint           # ESLint
npm test               # Jest tests

# Production builds
cd android && ./gradlew assembleRelease    # Android APK
```

## Architecture

### Component Tree (App.tsx)
```
GestureHandlerRootView → Redux Provider → ThemeProvider → SafeAreaProvider → ErrorBoundary → NavigationContainer → RootNavigator
```

### State Management — Redux Toolkit (`src/store/`)
Five slices: `auth`, `cart`, `orders`, `menu`, `user`. Typed hooks `useAppDispatch` and `useAppSelector` are exported from `src/store/index.ts`. Serializable check is disabled.

### Navigation — Role-Based Routing (`src/navigation/RootNavigator.tsx`)
`RootNavigator` checks AsyncStorage for a stored token on mount, calls `refreshUserData()`, then routes to:
- `AuthStack` (Login → OTP → Register) if unauthenticated
- `StudentTabs` / `CaptainTabs` / `OwnerTabs` based on `user.role`

### API Layer (`src/services/api.ts`)
Axios instance pointing to `https://campusoneapi.madrascollege.ac.in/api/v1`. Has request interceptor for Bearer tokens and response interceptor that auto-refreshes on 401 (with queue for concurrent requests). On refresh failure, dispatches `resetAuth` to force logout.

### Services (`src/services/`)
- `authService` — OTP-based login/register, token management
- `walletService` — Balance, transactions, Razorpay top-up, avatar upload, adhoc payments
- `orderService` — CRUD for food/laundry/stationery orders, QR verification
- `menuService` — Shops, menu items, categories
- `socketService` — Socket.io for real-time order status updates
- `notificationService` — Firebase Cloud Messaging + Notifee for push notifications
- `analyticsService` — Owner revenue/sales data

### Key Patterns
- **Theming:** `src/theme/ThemeContext.tsx` provides `colors` and `mode` (light/dark/system). All screens use `createStyles(colors)` factory pattern with `useMemo`.
- **Screen components:** Each screen is self-contained with inline styles via `StyleSheet.create`. No shared style files.
- **Modals as components:** Top-up, wallet, cart, profile dropdowns are modal components controlled by `visible`/`onClose` props.
- **Token storage keys:** `@madrasone_access_token`, `@madrasone_refresh_token` in AsyncStorage.
- **Image URLs:** `src/utils/imageUrl.ts` has `resolveImageUrl()` and `resolveAvatarUrl()` to construct full URLs from relative paths using `API_ORIGIN`.

### Types (`src/types/index.ts`)
All shared TypeScript types and navigation param lists are in a single file. Key types: `User`, `Order`, `FoodItem`, `Shop`, `Transaction`, `UserRole`, `OrderStatus`.

### Background Handlers (`index.js`)
Firebase messaging and Notifee background handlers are registered before `AppRegistry.registerComponent`. These handle push notifications when the app is backgrounded/killed.

## Role-Specific Screen Organization

```
src/screens/
├── shared/          # LoginScreen, OTPScreen, RegisterScreen
├── student/         # DashboardScreen, WalletScreen, OrdersScreen, ScannerScreen, ProfileScreen, etc.
├── captain/         # CaptainHomeScreen, CaptainPrepListScreen, CaptainEatScreen, CaptainScannerScreen, etc.
├── owner/           # OwnerHomeScreen, OwnerMenuScreen, OwnerAnalyticsScreen, etc.
└── stationery_owner/

src/components/
├── common/          # Icon, ScreenWrapper, ErrorBoundary, OrderQRCard, ScannedOrderModal
├── student/         # TopUpModal, WalletModal, CartBottomSheet, SearchModal, QRPaymentConfirmModal
├── captain/         # CaptainProfileDropdown
└── owner/           # CreateQRPaymentModal, QRPaymentDisplayModal, OwnerWalletModal, OwnerHeader
```

## Payment Flow (Razorpay)
1. Frontend calls `walletService.createRazorpayOrder(amount)` → backend returns `orderId` + `keyId`
2. `RazorpayCheckout.open(options)` opens native payment gateway
3. On success, `walletService.verifyRazorpayPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature })` verifies with backend
4. Error code `PAYMENT_CANCELLED` indicates user-initiated cancellation

## QR Code System (`src/utils/qrDecode.ts`)
Two QR types: **Order QR** (contains order ID for pickup verification) and **Payment QR** (contains payment ID, amount, shop info for adhoc payments). Scanner uses `react-native-vision-camera`.

## Backend API
Base URL configured in `src/services/api.ts` as `API_ORIGIN`. Change this single value to switch between dev/staging/production environments.
