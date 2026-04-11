# CampusOne iOS — Security Implementation Checklist
**App:** CampusOne | **Bundle ID:** `com.mec.campusone`  
**Current Version:** 1.2.1 (Build 22)  
**Prepared:** 2026-04-11  
**Audience:** iOS Developer implementing parity with the Android build

---

## How to Use This Document

This checklist covers every security feature implemented across the last five versions of the Android app (v1.0.x → v1.2.1). For each item:

- **SHARED** — the fix lives in shared React Native TypeScript code (`src/`) and is already active on iOS automatically. Verify it compiles and runs correctly on iOS.
- **iOS-SPECIFIC** — the Android fix used Android-only config (e.g. `network_security_config.xml`, `proguard-rules.pro`). You must implement the iOS equivalent separately.
- **PENDING** — not yet implemented on either platform. Implement on iOS first, then backport.

Mark each item `[x]` when verified or implemented.

---

## Version History Reference

| Version | Build | Key Security Work |
|---------|-------|-------------------|
| v1.0.x  | 1–10  | JWT auth, Keychain token storage, HTTPS-only (ATS), basic CORS |
| v1.1.x  | 11–16 | Socket.IO JWT enforcement, rate limiting, error sanitization, CSRF |
| v1.1.5  | 17    | Force logout validation, OTP session security, password hashing (bcrypt 12 rounds) |
| v1.2.0  | 18–20 | SSL certificate pinning (Android), root/jailbreak detection, device ID consolidation, API key hardening |
| v1.2.1  | 21–22 | QR code TTL, raw error message removal, NoSQL injection, ObjectId validation, search sanitization, discount bounds, rate limit on token refresh, session cache TTL |

---

## Part 1 — Network Security

### 1.1 SSL Certificate Pinning
**Type: iOS-SPECIFIC** | **Android file:** `android/app/src/main/res/xml/network_security_config.xml`

Android pins the public key of `campusoneapi.madrascollege.ac.in` to prevent MITM attacks on campus WiFi. iOS has no equivalent XML file — pinning must be configured natively.

**Current Android pins (SHA-256, SPKI):**
```
Leaf:         cLKLGCyyKgF0uAIv2SNjy4KXsPOEzL+rbJ97M3OFLUk=
Intermediate: AlSQhgtJirc8ahLyekmtX+Iw+v46yPYRLJt9Cq1GlB0=  (Let's Encrypt R13)
```

**iOS implementation options (choose one):**

**Option A — TrustKit (recommended)**
```ruby
# Podfile
pod 'TrustKit'
```
```swift
// AppDelegate.swift (or AppDelegate.mm for Objective-C)
import TrustKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(_ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {

    let trustKitConfig: [String: Any] = [
      kTSKSwizzleNetworkDelegates: true,
      kTSKPinnedDomains: [
        "campusoneapi.madrascollege.ac.in": [
          kTSKIncludeSubdomains: false,
          kTSKEnforcePinning: true,
          kTSKPublicKeyHashes: [
            "cLKLGCyyKgF0uAIv2SNjy4KXsPOEzL+rbJ97M3OFLUk=",  // Leaf
            "AlSQhgtJirc8ahLyekmtX+Iw+v46yPYRLJt9Cq1GlB0="   // Let's Encrypt R13 backup
          ]
        ]
      ]
    ]
    TrustKit.initSharedInstance(withConfiguration: trustKitConfig)
    return true
  }
}
```

**Option B — react-native-ssl-pinning**
```bash
npm install react-native-ssl-pinning
```
Then replace Axios with the pinned version in `src/services/api.ts` for iOS.

**Pin renewal reminder:** Let's Encrypt certs expire every 90 days. Always update BOTH the Android XML and iOS TrustKit config simultaneously. Keep 2 pins (leaf + intermediate). Failing to update before cert renewal locks all iOS users out.

**How to get current pins:**
```bash
openssl s_client -servername campusoneapi.madrascollege.ac.in \
  -connect campusoneapi.madrascollege.ac.in:443 2>/dev/null \
  | openssl x509 -noout -pubkey \
  | openssl pkey -pubin -outform der \
  | openssl dgst -sha256 -binary | base64
```

**Checklist:**
- [ ] TrustKit (or equivalent) installed and configured in AppDelegate
- [ ] Both pins (leaf + R13 backup) added
- [ ] Debug builds use `kTSKEnforcePinning: false` or separate scheme
- [ ] Pin renewal calendar reminder set (every 80 days)
- [ ] Tested: app connects to API on physical device
- [ ] Tested: app rejects a proxy certificate (e.g. Charles Proxy — should fail to connect)

---

### 1.2 App Transport Security (ATS)
**Type: SHARED (iOS config already exists)**  
**File:** `ios/frontend/Info.plist` lines 31–37

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <false/>              <!-- GOOD — no HTTP allowed -->
    <key>NSAllowsLocalNetworking</key>
    <true/>               <!-- Allows localhost for dev only -->
</dict>
```

**Checklist:**
- [ ] `NSAllowsArbitraryLoads` confirmed `false` in Info.plist
- [ ] No `NSExceptionDomains` added that bypass HTTPS for the API domain
- [ ] `NSAllowsLocalNetworking: true` is acceptable (dev builds only)
- [ ] Release build verified — no HTTP traffic to production API

---

### 1.3 HTTPS Enforcement
**Type: SHARED** | `src/services/api.ts` line 7

```typescript
export const API_ORIGIN = 'https://campusoneapi.madrascollege.ac.in';
```

All API calls use HTTPS. ATS enforces this at OS level on iOS.

**Checklist:**
- [ ] `API_ORIGIN` starts with `https://` — confirmed
- [ ] No HTTP fallback anywhere in the codebase

---

## Part 2 — Authentication & Token Security

### 2.1 Token Storage — iOS Keychain
**Type: SHARED** | `src/services/api.ts` lines 40–78  
**Library:** `react-native-keychain`

Tokens are stored in the iOS Keychain (the most secure storage iOS provides — hardware-backed on devices with Secure Enclave). This was changed from AsyncStorage in v1.2.0.

```typescript
// Access tokens stored under service: 'com.campusone.tokens'
// Device ID stored under service:     'com.campusone.deviceid'
// Activity tracking:                  'com.campusone.activity'
```

**iOS-specific note:** Keychain items on iOS persist across app reinstalls by default. Verify your Keychain accessibility setting:

```swift
// Recommended: kSecAttrAccessibleAfterFirstUnlock
// NOT: kSecAttrAccessibleAlways (no protection when device is locked)
// react-native-keychain default is kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly — GOOD
```

**Checklist:**
- [ ] `react-native-keychain` pod installed (`pod install` run after adding)
- [ ] Tokens never stored in AsyncStorage or NSUserDefaults
- [ ] Keychain accessibility is `AfterFirstUnlock` or stricter
- [ ] Keychain items cleared on logout (`clearTokens()` called)
- [ ] Tested: tokens survive app restart but are cleared on logout
- [ ] Tested: tokens are NOT accessible via iTunes backup (set `thisDeviceOnly` to prevent)

---

### 2.2 Device ID — Cryptographically Random, Keychain-Backed
**Type: SHARED** | `src/services/api.ts` lines 117–128

In v1.2.0, `Math.random()` device ID was replaced with UUID v4 (`react-native-uuid`) stored in Keychain. This gives each device a stable, cryptographically random identifier used for rate limiting and session management.

```typescript
export async function getOrCreateDeviceId(): Promise<string> {
  const stored = await Keychain.getGenericPassword({ service: KEYCHAIN_DEVICE_ID_SERVICE });
  if (stored) return stored.password;
  const id = (uuid.v4() as string).replace(/-/g, '');
  await Keychain.setGenericPassword('device', id, { service: KEYCHAIN_DEVICE_ID_SERVICE });
  return id;
}
```

**Checklist:**
- [ ] `react-native-uuid` package installed
- [ ] Device ID is generated once and persisted in Keychain
- [ ] `X-Device-Id` header is sent on every API request
- [ ] Device ID is NOT regenerated on every app launch
- [ ] No fallback to `Math.random()` or UUID v1

---

### 2.3 API Key — No Hardcoded Fallback
**Type: SHARED** | `src/services/api.ts` lines 17–19, `src/services/versionService.ts` lines 15–18

In v1.2.0, the hardcoded fallback API key was removed. The app now fails hard at startup if `APP_API_KEY` is not set in `.env`.

```typescript
const APP_API_KEY = Config.APP_API_KEY as string;
if (!APP_API_KEY) {
  throw new Error('[Security] APP_API_KEY is not configured. Set APP_API_KEY in your .env file.');
}
```

**iOS implementation:** `react-native-config` reads from `.env` on iOS via a build-time script phase. The same `.env` file serves both platforms.

**Checklist:**
- [ ] `react-native-config` is installed and the iOS build script phase is added to Xcode
- [ ] `.env` file has `APP_API_KEY=<real-value>` (not empty, not placeholder)
- [ ] Build fails or throws at startup if `APP_API_KEY` is missing — tested
- [ ] `APP_API_KEY` is sent as `X-App-Key` header on every request — confirmed in interceptor
- [ ] `.env` is NOT committed to git (in `.gitignore`)
- [ ] Different `APP_API_KEY` values for debug vs release builds (via `.env.production`)

---

### 2.4 JWT Token Refresh — Rate Limited
**Type: SHARED** | `src/services/api.ts` lines 183–210  
**Backend fix (v1.2.1):** `auth.routes.ts` — `authRateLimiter` added to `POST /auth/refresh`

The token refresh endpoint now has rate limiting on the backend (10 requests per 15 minutes per IP). The mobile client already has retry logic with backoff.

```typescript
// At most TOKEN_REFRESH_MAX_RETRIES = 2 retries
// TOKEN_REFRESH_RETRY_DELAY_MS = 1500ms between retries
// On 401/403 — no retry (token is genuinely invalid → logout)
```

**Checklist:**
- [ ] Token refresh is called automatically on 401 responses (response interceptor active)
- [ ] Retry logic caps at 2 retries
- [ ] On refresh failure (401/403), user is logged out gracefully
- [ ] No infinite retry loop possible
- [ ] Concurrent 401 requests are queued (not each triggering a separate refresh)

---

### 2.5 Session Inactivity — 3-Day Timeout
**Type: SHARED** | `src/services/api.ts` line 24

```typescript
const SESSION_MAX_INACTIVE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
```

Activity is tracked in Keychain (`com.campusone.activity`). On each API call, `updateLastActivity()` stamps the current time. On app launch, if idle > 3 days, the session is force-expired.

**Note:** 3 days is the current limit. A future version should reduce this to 30 minutes with biometric re-auth.

**Checklist:**
- [ ] `isSessionExpired()` called on app launch before any authenticated requests
- [ ] Activity timestamp updated on each API call
- [ ] Expired session triggers clean logout (tokens cleared, user redirected to login)
- [ ] Tested: simulate 3-day gap → app prompts re-login

---

## Part 3 — App Integrity & Runtime Security

### 3.1 Jailbreak Detection
**Type: SHARED** | `src/utils/securityCheck.ts`  
**Library:** `react-native-device-info`

`DeviceInfo.isRooted()` detects jailbreak on iOS by checking for:
- Cydia.app presence
- `/etc/apt` directory
- `/bin/bash` outside sandbox
- Ability to write outside sandbox

```typescript
export function shouldBlockApp(result: SecurityCheckResult): boolean {
  if (__DEV__) return false; // Never block in dev builds
  if (!isPackageNameValid(result.packageName)) return true; // Repackaged IPA
  if (result.isRooted) return true; // Jailbroken device
  return false;
}
```

**Checklist:**
- [ ] `react-native-device-info` pod installed
- [ ] `runSecurityChecks()` called on app mount (in `App.tsx`)
- [ ] Jailbroken devices shown non-dismissible alert and blocked
- [ ] Block is NOT triggered in development/simulator builds (`__DEV__` guard confirmed)
- [ ] Tested on real jailbroken device (or simulate by mocking `isRooted()` returning true)
- [ ] Tested on iOS Simulator — should show "emulator warning" but NOT block

---

### 3.2 Bundle ID Validation (Repackaging Detection)
**Type: SHARED** | `src/utils/securityCheck.ts` lines 19, 83–85

```typescript
const EXPECTED_PACKAGE_NAME = 'com.mec.campusone';

export function isPackageNameValid(packageName: string): boolean {
  return packageName === EXPECTED_PACKAGE_NAME;
}
```

On iOS, `DeviceInfo.getBundleId()` returns the `CFBundleIdentifier` from Info.plist. If someone repackages the IPA with a different bundle ID, the app blocks at launch.

**iOS bundle ID confirmed in:**
- `ios/frontend/Info.plist` → `$(PRODUCT_BUNDLE_IDENTIFIER)` → `com.mec.campusone`
- `ios/frontend/GoogleService-Info.plist` → `BUNDLE_ID: com.mec.campusone`

**Checklist:**
- [ ] `CFBundleIdentifier` in Xcode project is `com.mec.campusone` (Production) and `com.mec.campusone.debug` (Debug only if applicable)
- [ ] `EXPECTED_PACKAGE_NAME` in `securityCheck.ts` matches exactly
- [ ] App blocks on launch if bundle ID doesn't match (tested by changing ID temporarily)

---

### 3.3 Emulator Detection
**Type: SHARED** | `src/utils/securityCheck.ts` lines 59–65

```typescript
async function checkEmulator(): Promise<boolean> {
  return await DeviceInfo.isEmulator();
}
```

iOS Simulator is detected. Policy: show a warning in production builds, do not block (simulators are used for testing in TestFlight).

**Checklist:**
- [ ] `shouldWarnUser()` shows a non-blocking alert on Simulator in production builds
- [ ] Warning does NOT block TestFlight testers using Simulator
- [ ] No warning shown in `__DEV__` builds

---

### 3.4 Security Checks Called at App Launch
**Type: SHARED** | `App.tsx`

The security check runs once on app mount:
```typescript
useEffect(() => {
  runSecurityChecks().then(result => {
    if (shouldBlockApp(result)) {
      Alert.alert('Security Warning', 'This device is not supported.', [], { cancelable: false });
    }
  });
}, []);
```

**Checklist:**
- [ ] `runSecurityChecks()` is called in `App.tsx` on mount
- [ ] Non-dismissible alert shown on blocked devices
- [ ] Security checks complete before any auth/navigation logic runs

---

## Part 4 — QR Code Security

### 4.1 QR Code TTL — 10-Minute Expiry
**Type: SHARED** | `src/utils/qrDecode.ts` lines 77–87

In v1.2.1, QR codes now expire after 10 minutes to prevent replay attacks.

```typescript
const QR_TTL_MS = 10 * 60 * 1000; // 10 minutes

function isQrExpired(parsed: Record<string, unknown>): boolean {
  if (typeof parsed.ts !== 'number') return false; // Backward compat
  return (Date.now() - parsed.ts) > QR_TTL_MS;
}
```

If the backend includes a `ts` (Unix millisecond timestamp) in the QR payload, the app rejects it if older than 10 minutes.

**Checklist:**
- [ ] `decodeQrData()` rejects expired QR codes (returns `null`)
- [ ] Tested: scan a QR older than 10 minutes → scanner shows error
- [ ] Tested: scan a fresh QR → scanner proceeds normally
- [ ] Both URL format and base64 format QRs have TTL checked

---

### 4.2 QR Payment Data Validation
**Type: SHARED** | `src/utils/qrDecode.ts` lines 25–58

Payment QRs are validated for required fields before processing:
- `type === 'shop_qr_payment'`
- `paymentId` is a string
- `amount` is a number

**Checklist:**
- [ ] `decodeQrPaymentData()` returns null for malformed QR data
- [ ] Scanner screen handles null gracefully (shows error, does not crash)

---

## Part 5 — Data Input Security

### 5.1 ObjectId Validation on API URL Parameters
**Type: SHARED** | `src/utils/validateId.ts` (new file, v1.2.1)

All service methods that use IDs in URL paths now validate the ID is a valid 24-character MongoDB ObjectId before making the HTTP request.

```typescript
// src/utils/validateId.ts
const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

export function assertObjectId(id: unknown, label = 'ID'): asserts id is string {
  if (!isValidObjectId(id)) {
    throw new Error(`Invalid ${label}: must be a 24-character hex string`);
  }
}
```

**Applied to (24 locations):**
- `menuService.ts` — shopId, itemId, categoryId (10 methods)
- `orderService.ts` — orderId (4 methods)
- `walletService.ts` — paymentId, transactionId, notificationId (4 methods)

**Checklist:**
- [ ] `src/utils/validateId.ts` exists and exports `isValidObjectId` and `assertObjectId`
- [ ] All service methods listed above throw before making API request if ID is invalid
- [ ] Tested: pass a non-ObjectId string to `orderService.getOrderById()` → throws immediately, no network request

---

### 5.2 Search Term Sanitization
**Type: SHARED** | `src/services/menuService.ts` line 17 (v1.2.1)

```typescript
if (search) {
  const sanitized = search.trim().slice(0, 100); // 100 char max
  if (sanitized) params.search = sanitized;
}
```

Search queries are trimmed and capped at 100 characters before being sent as URL query params. This limits how much user data ends up in server access logs.

**Checklist:**
- [ ] Search input in `SearchModal` / menu search is capped before API call
- [ ] Empty-after-trim search does not send the param at all

---

### 5.3 Discount Percentage Bounds Check
**Type: SHARED** | `src/store/slices/menuSlice.ts` lines 219–222 (v1.2.1)

```typescript
if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 100) {
  return rejectWithValue('Discount must be between 1% and 100%.');
}
```

Owner discount input is validated in both the UI (`OwnerMenuScreen.tsx`) and in the Redux thunk before the API call.

**Checklist:**
- [ ] Owner can set discounts 1–100% only
- [ ] Values of 0 or > 100 rejected with user-facing error message
- [ ] `NaN` and `Infinity` rejected
- [ ] Backend also validates `offerPrice` is positive

---

## Part 6 — Real-Time / Socket Security

### 6.1 Socket.IO — JWT Authentication Required
**Type: SHARED** | `src/services/socketService.ts`

Every socket connection sends the JWT in the auth handshake:
```typescript
socket = io(SOCKET_URL, {
  auth: { token },          // JWT sent on handshake
  transports: ['websocket', 'polling'],  // Polling fallback (v1.2.1)
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 3000,
  reconnectionDelayMax: 30000,
});
```

On reconnect, the token is refreshed proactively before the handshake.

**Checklist:**
- [ ] Socket connects with JWT in `auth.token`
- [ ] Token is refreshed before reconnect attempts (`reconnect_attempt` handler)
- [ ] Socket disconnects cleanly on logout (`disconnectSocket()` called)
- [ ] No data events emitted before socket confirms connection

---

### 6.2 Socket Polling Fallback (v1.2.1)
**Type: SHARED** | `src/services/socketService.ts` line 54

Changed from `['websocket']` to `['websocket', 'polling']`. This allows the connection to fall back to HTTP long-polling if WebSocket is blocked by a campus proxy or firewall.

**Checklist:**
- [ ] `transports: ['websocket', 'polling']` in socket config
- [ ] Tested on restrictive network (campus WiFi with WebSocket block) — connection still works via polling

---

### 6.3 Force Logout — Validation + Rate Limiting
**Type: SHARED** | `src/services/socketService.ts` lines 383–410 (v1.2.0)

Three-layer protection against a malicious `force_logout` socket event:

1. **Payload validation** — `reason` must be a non-empty string
2. **Timestamp freshness** — if `ts` is included, reject if older than 60 seconds
3. **Rate limiting** — only one force logout processed per 5 minutes

```typescript
// 1. Validate payload
if (!payload || typeof payload.reason !== 'string' || !payload.reason.trim()) return;

// 2. Check timestamp
if (payload.ts !== undefined && Math.abs(now - payload.ts) > 60_000) return;

// 3. Rate limit
if (now - lastForceLogoutTs < FORCE_LOGOUT_COOLDOWN_MS) return;
lastForceLogoutTs = now;
```

**Checklist:**
- [ ] `force_logout` handler validates payload before acting
- [ ] App handles force logout gracefully (clears tokens, navigates to login)
- [ ] Tested: send malformed `force_logout` → ignored
- [ ] Tested: send valid `force_logout` → user is logged out

---

## Part 7 — Push Notifications (FCM / APNs)

### 7.1 Firebase Cloud Messaging — iOS Setup
**Type: iOS-SPECIFIC**  
**File:** `ios/frontend/GoogleService-Info.plist` (bundle ID: `com.mec.campusone`)

iOS FCM requires APNs integration. Firebase uses APNs under the hood for iOS.

**Checklist:**
- [ ] `GoogleService-Info.plist` present in Xcode project (not just the filesystem)
- [ ] APNs key or certificate uploaded to Firebase Console (Project Settings → Apple apps)
- [ ] Push notification capability enabled in Xcode (Signing & Capabilities → Push Notifications)
- [ ] Background mode `remote-notification` enabled (confirmed in Info.plist)
- [ ] `FirebaseAppDelegateProxyEnabled: true` in Info.plist (confirmed)
- [ ] Tested: FCM token is registered with backend after login
- [ ] Tested: push notification received when app is in background
- [ ] Tested: push notification received when app is killed (cold start)

---

### 7.2 FCM Token Lifecycle
**Type: SHARED** | `src/services/notificationService.ts`

The app follows a strict token lifecycle:
- **On login:** Token registered with backend via `POST /auth/fcm-token`
- **On foreground:** Token re-registered via `refreshTokenRegistration()` (in case server cleaned it up)
- **On token refresh:** New token automatically registered via `onTokenRefresh` listener
- **On logout:** Token unregistered via `DELETE /auth/fcm-token`

**Checklist:**
- [ ] FCM token is registered after successful login
- [ ] `deviceId` (Keychain-based) is sent alongside the token for per-device tracking
- [ ] Token is unregistered on logout (token removed from server)
- [ ] Token refresh listener is set up (`setupTokenRefreshListener`)
- [ ] `cleanupNotifications()` called on logout (clears dedup set and unsubscribes listener)

---

### 7.3 iOS Notification Permission Request
**Type: SHARED** | `src/services/notificationService.ts` lines 349–365

```typescript
if (Platform.OS === 'ios') {
  const authStatus = await requestPermission(getMessaging());
  const enabled =
    authStatus === FBAuthorizationStatus.AUTHORIZED ||
    authStatus === FBAuthorizationStatus.PROVISIONAL;
  if (!enabled) {
    // Don't return — still register FCM token for data-only messages
  }
}
```

Permission denial does NOT block FCM token registration. Data-only messages still work.

**Checklist:**
- [ ] iOS permission prompt appears on first launch
- [ ] App does not crash if permission is denied
- [ ] FCM token is still registered even without display permission (silent push works)
- [ ] Tested: deny permission → data-only messages still processed

---

### 7.4 Notification Deduplication
**Type: SHARED** | `src/services/notificationService.ts` lines 22–31

A shared in-memory deduplication set (`recentKeys`) prevents double-display when both Socket.IO and FCM deliver the same event simultaneously.

```typescript
const recentKeys = new Set<string>();
const DEDUP_TTL_MS = 5 * 60 * 1000; // 5-minute dedup window

export function isDuplicate(key: string): boolean {
  if (recentKeys.has(key)) return true;
  recentKeys.add(key);
  setTimeout(() => recentKeys.delete(key), DEDUP_TTL_MS);
  return false;
}
```

**Checklist:**
- [ ] Order status notifications not shown twice when socket + FCM both fire
- [ ] Wallet credit notifications not shown twice
- [ ] Dedup set cleared on logout (`cleanupNotifications()` calls `recentKeys.clear()`)

---

## Part 8 — Notification Channels (iOS UNNotificationCategory)

### 8.1 iOS Notification Categories
**Type: iOS-SPECIFIC**  
**Android equivalent:** `src/services/notificationService.ts` — `createChannels()` creates Android notification channels

On Android, four notification channels are created: `order_ready`, `order_updates`, `wallet`, `general`. iOS uses UNNotificationCategory and UNNotificationSound instead.

| Android Channel | iOS Equivalent | Priority |
|----------------|----------------|----------|
| `order_ready` | Default category + critical sound | High — use `.critical` sound if possible |
| `order_updates` | Default category + default sound | High |
| `wallet` | Default category | Default |
| `general` | Default category | Default |

**Checklist:**
- [ ] `createChannels()` in `notificationService.ts` is no-op on iOS (Platform.OS check) — confirm no crash
- [ ] Notifee notification display works on iOS (uses different APIs but same JS interface)
- [ ] `displayOrderStatusFullScreen()` — on iOS this maps to time-sensitive or critical notification
- [ ] Sound plays correctly on iOS for order-ready notifications
- [ ] Vibration works on iOS (haptic feedback)

---

## Part 9 — Sensitive Data Protection

### 9.1 No Raw Error Messages in UI (v1.2.1)
**Type: SHARED** | All Redux slice files

In v1.2.1, all `rejectWithValue(e.response?.data?.message)` patterns were replaced with static safe strings. Error details are only logged behind `__DEV__`.

**Affected slices:**
- `authSlice.ts` — login, OTP, register flows
- `ordersSlice.ts` — createOrder and 11 other thunks
- `userSlice.ts` — all 9 async thunks
- `menuSlice.ts` — setItemOffer now uses safe string

**Checklist:**
- [ ] On API error, UI shows a generic safe message (not a server error string)
- [ ] `console.error` only fires in `__DEV__` mode — confirmed by checking all catch blocks
- [ ] Tested: force an API 500 error → UI shows "Server error. Please try again later." (not internal details)

---

### 9.2 Production Console Log Guards
**Type: SHARED** | Throughout `src/`

All `console.log`, `console.warn`, `console.error` calls are wrapped in `if (__DEV__)` guards.

**Exception found (fix needed):** `src/navigation/RootNavigator.tsx` lines 377 and 382 have two unguarded `console.log` calls that log notification payload data in production.

```typescript
// Lines 377, 382 — NOT yet wrapped in __DEV__
console.log('[Notifications] Cold-start:', msg.data);
console.log('[Notifee] Cold-start:', initial.notification.data);
```

These logs expose `orderId`, `orderNumber`, `status`, and payment data to any tool that reads iOS system logs (Console.app, Xcode Organizer, crash reporting SDKs).

**Checklist:**
- [ ] Both `console.log` calls in `RootNavigator.tsx` lines 377 and 382 wrapped in `if (__DEV__)`
- [ ] Verified with Xcode Console: no sensitive data visible in release build logs
- [ ] No notification payload data visible in iOS crash reports (Sentry/Crashlytics)

---

### 9.3 Screenshot Prevention
**Type: PENDING — Not implemented on either platform**

Screens showing wallet balance, order details, and QR codes are visible in iOS app switcher and can be screenshotted freely.

**iOS implementation:**
```swift
// AppDelegate.swift — blur sensitive screens when app backgrounds
func applicationWillResignActive(_ application: UIApplication) {
  // Add blur overlay to window
  let blurEffect = UIBlurEffect(style: .regular)
  let blurView = UIVisualEffectView(effect: blurEffect)
  blurView.frame = window?.frame ?? .zero
  blurView.tag = 1001
  window?.addSubview(blurView)
}

func applicationDidBecomeActive(_ application: UIApplication) {
  window?.viewWithTag(1001)?.removeFromSuperview()
}
```

Or use `react-native-screen-capture-callback` for cross-platform.

**Checklist:**
- [ ] Wallet balance screen blurred in app switcher (iOS)
- [ ] QR code screen blurred in app switcher (iOS)
- [ ] Screenshot detection implemented (optional — alert user that screenshot was taken)

---

### 9.4 Clipboard Safety
**Type: PENDING**

QR codes, order numbers, and payment amounts may be copied to clipboard. iOS 14+ notifies users when apps read the clipboard, which can alarm users if done silently.

**Checklist:**
- [ ] App does not silently read clipboard on launch or resume
- [ ] If clipboard read is needed (e.g. paste QR code), it is done only on explicit user action
- [ ] No sensitive data (tokens, keys) written to clipboard

---

## Part 10 — iOS-Specific Build Configuration

### 10.1 Encryption Declaration
**Type: iOS-SPECIFIC** | `ios/frontend/Info.plist` line 88

```xml
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```

This is correct. The app uses only standard iOS HTTPS/TLS encryption (exempt from US export regulations). You do NOT use custom encryption algorithms.

**Checklist:**
- [ ] `ITSAppUsesNonExemptEncryption: false` confirmed in Info.plist
- [ ] No custom encryption libraries added (only HTTPS via standard iOS APIs)

---

### 10.2 Code Signing and Provisioning
**Type: iOS-SPECIFIC**

**Checklist:**
- [ ] Release build signed with Production certificate (not Development)
- [ ] Provisioning profile is Distribution (App Store or Ad Hoc)
- [ ] Bundle ID in provisioning profile matches `com.mec.campusone`
- [ ] Entitlements file includes Push Notifications capability
- [ ] Keychain Sharing entitlement added if using shared Keychain groups (not needed for this app)
- [ ] Bitcode disabled (React Native 0.83.1 does not support Bitcode)

---

### 10.3 Swift/Objective-C Code Security
**Type: iOS-SPECIFIC**

Android uses ProGuard for code obfuscation (`android/app/proguard-rules.pro`). iOS equivalent is Swift compiler optimizations.

**Checklist:**
- [ ] Release build uses `Fastest, Smallest [-Os]` optimization level
- [ ] Debug symbols (`dSYM`) are NOT included in the distributed IPA
- [ ] dSYM uploaded to crash reporting service separately (for symbolication)
- [ ] Logging libraries (NSLog, print) disabled in Release builds
- [ ] No `DEBUG` preprocessor macros defined in Release scheme

---

### 10.4 Supported Orientations
**Type: iOS config note** | `ios/frontend/Info.plist` lines 56–63

```xml
<key>UISupportedInterfaceOrientations</key>
<array>
    <string>UIInterfaceOrientationPortrait</string>
    <string>UIInterfaceOrientationLandscapeLeft</string>
    <string>UIInterfaceOrientationLandscapeRight</string>
    <string>UIInterfaceOrientationPortraitUpsideDown</string>
</array>
```

Landscape and upside-down are enabled. For a food ordering app, consider restricting to Portrait only to reduce UI surface area and simplify layout security.

**Checklist:**
- [ ] Confirm Landscape is intentionally supported (or restrict to Portrait)

---

## Part 11 — Biometric Re-Authentication (Pending Feature)

**Type: PENDING — Not yet implemented on Android or iOS**

Currently the app has no biometric gate when resuming from background. A stolen unlocked phone retains full app access for up to 3 days.

**Required behavior:**
- After 5+ minutes in background, require Face ID / Touch ID (iOS) or Fingerprint (Android)
- If biometric fails 3 times, fall back to app PIN or force logout
- Wallet and payment screens should always require biometric re-auth

**iOS implementation:**
```typescript
import ReactNativeBiometrics from 'react-native-biometrics';

const rnBiometrics = new ReactNativeBiometrics();

export async function requireBiometric(reason: string): Promise<boolean> {
  const { available, biometryType } = await rnBiometrics.isSensorAvailable();
  if (!available) return true; // No biometric — allow through (PIN fallback)

  const { success } = await rnBiometrics.simplePrompt({ promptMessage: reason });
  return success;
}
```

**Checklist:**
- [ ] `react-native-biometrics` installed (or `expo-local-authentication` equivalent)
- [ ] `NSFaceIDUsageDescription` added to `Info.plist` (required for Face ID)
- [ ] Biometric prompt shown after 5+ minutes background (AppState listener)
- [ ] Biometric prompt shown before wallet top-up and payment actions
- [ ] Tested: app resumes after 5 min → Face ID prompt appears
- [ ] Tested: Face ID failure 3x → graceful fallback

---

## Part 12 — Version Checking & Force Update

### 12.1 Version Check on Launch
**Type: SHARED** | `src/services/versionService.ts`

The app checks the backend for the minimum supported version on launch:
```typescript
const platform = Platform.OS === 'ios' ? 'ios' : 'android';
const response = await axios.get(
  `${API_ORIGIN}/api/v1/app/version-check?platform=${platform}`,
  { headers: { 'X-App-Key': APP_API_KEY } }
);
```

If the current version is below `minVersion`, a force update is shown. If below `latestVersion`, a soft update prompt appears.

**Checklist:**
- [ ] Backend version config has `ios` platform entry (separate from `android`)
- [ ] iOS `updateUrl` points to App Store link (not Play Store)
- [ ] Force update blocks app usage when triggered
- [ ] Soft update shows dismissible prompt
- [ ] Tested: set `minVersion` above current → force update screen appears

---

## Summary — Priority Order for iOS Implementation

### Must Do Before Release
| # | Item | Section | Risk if Skipped |
|---|------|---------|-----------------|
| 1 | SSL Certificate Pinning | 1.1 | MITM attacks on campus WiFi — all data interceptable |
| 2 | Jailbreak detection tested on iOS | 3.1 | Jailbroken devices bypass app security |
| 3 | APNs / FCM push configured | 7.1 | Orders go unnotified — critical UX + safety |
| 4 | Force logout handler working | 6.3 | Multi-device logout doesn't work on iOS |
| 5 | Fix console.log lines 377/382 | 9.2 | Notification data exposed in iOS logs |

### Do in First Sprint After Launch
| # | Item | Section |
|---|------|---------|
| 6 | Biometric re-auth on resume | 11 |
| 7 | Screenshot prevention | 9.3 |
| 8 | Reduce session timeout 3 days → 30 min | 2.5 |

### Ongoing Maintenance
| # | Item | Frequency |
|---|------|-----------|
| 9 | SSL pin renewal | Every 80 days (before cert renewal) |
| 10 | Firebase key rotation | On any suspected compromise |
| 11 | Security audit re-run | Every major version |

---

## Reference: Shared Security Files (No iOS Changes Needed)

These files contain security logic that is already platform-agnostic and runs identically on iOS:

| File | Security Feature |
|------|-----------------|
| `src/services/api.ts` | Token storage (Keychain), device ID, API key enforcement, token refresh |
| `src/services/socketService.ts` | JWT socket auth, force logout validation, polling fallback |
| `src/services/notificationService.ts` | FCM token lifecycle, deduplication |
| `src/utils/securityCheck.ts` | Jailbreak/root detection, bundle ID check |
| `src/utils/qrDecode.ts` | QR TTL validation, payload parsing |
| `src/utils/validateId.ts` | ObjectId validation on all API path params |
| `src/store/slices/authSlice.ts` | Safe error messages in auth flows |
| `src/store/slices/ordersSlice.ts` | Safe error messages in order flows |
| `src/store/slices/userSlice.ts` | Safe error messages in wallet/user flows |
| `src/store/slices/menuSlice.ts` | Discount bounds check in setItemOffer thunk |
| `src/services/menuService.ts` | Search sanitization, ObjectId assertion |
| `src/services/orderService.ts` | ObjectId assertion on all order path params |
| `src/services/walletService.ts` | ObjectId assertion on all wallet path params |

---

*Document prepared for CampusOne iOS Developer — Madras Engineering College*  
*Backend: campusoneapi.madrascollege.ac.in | App Bundle: com.mec.campusone*
