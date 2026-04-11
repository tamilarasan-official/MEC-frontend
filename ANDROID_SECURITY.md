# CampusOne Android — Security Documentation

**App:** CampusOne (`com.mec.campusone`)
**Version:** 1.2.2 (versionCode 23)
**Date:** April 2026

---

## 1. SSL Certificate Pinning

**File:** `android/app/src/main/res/xml/network_security_config.xml`

Prevents Man-in-the-Middle (MITM) attacks on campus Wi-Fi by refusing connections to the API server unless the certificate matches a known public key hash.

| Setting | Value |
|---------|-------|
| Domain | `campusoneapi.madrascollege.ac.in` |
| Digest | SHA-256 |
| Cleartext traffic | Disabled (`cleartextTrafficPermitted="false"`) |
| Pin count | 2 (leaf + intermediate CA backup) |

**Current pins (generated 2026-04-11):**
```
cLKLGCyyKgF0uAIv2SNjy4KXsPOEzL+rbJ97M3OFLUk=   ← Leaf certificate
AlSQhgtJirc8ahLyekmtX+Iw+v46yPYRLJt9Cq1GlB0=   ← Let's Encrypt R13 intermediate (backup)
```

**Debug builds:** Pin enforcement is disabled via `<debug-overrides>` so developers can test without worrying about cert rotation. Pinning only enforces in release builds.

> **IMPORTANT — Pin Rotation:**
> Let's Encrypt certs renew every ~90 days. Always keep 2 pins minimum.
> If you only have the leaf pin and the cert renews, all users on old APKs
> will be permanently locked out until they update.
>
> To regenerate the leaf pin:
> ```bash
> openssl s_client -servername campusoneapi.madrascollege.ac.in \
>   -connect campusoneapi.madrascollege.ac.in:443 2>/dev/null \
>   | openssl x509 -noout -pubkey \
>   | openssl pkey -pubin -outform der \
>   | openssl dgst -sha256 -binary | base64
> ```

---

## 2. Token Storage — Encrypted Keychain

**File:** `src/services/api.ts`

JWT access and refresh tokens are stored in the Android Keystore-backed Keychain — **never in AsyncStorage or plain storage**.

| Service key | Contents |
|-------------|----------|
| `com.campusone.tokens` | `{ accessToken, refreshToken }` — JSON, encrypted |
| `com.campusone.activity` | Last active timestamp — for inactivity timeout |
| `com.campusone.deviceid` | Stable device UUID — for per-device rate limiting |

**Token lifecycle:**
- Access token TTL: **15 minutes** (set by backend)
- Refresh token TTL: **7 days** (set by backend)
- Session inactivity timeout: **3 days** — app force-logs out if unused for 3 days
- On logout: both token Keychain entries are wiped with `resetGenericPassword`

---

## 3. API Key Protection

**File:** `src/services/api.ts`, `.env`

Every API request includes an `X-App-Key` header with a secret key loaded from the `.env` file at build time via `react-native-config`. The key is baked into the release APK as a `BuildConfig` field.

- The app throws a fatal error at startup if `APP_API_KEY` is not set — prevents running with a missing key
- The key is never hardcoded in source — only in `.env` which is excluded from version control

---

## 4. Device ID Header

**File:** `src/services/api.ts`

Every request includes `X-Device-Id` — a stable UUID generated on first launch and stored in Keychain. The backend uses this for per-device rate limiting, which is more accurate than IP-based limiting on campus NAT networks.

---

## 5. Session Inactivity Enforcement

**File:** `src/services/api.ts`

If the app has not been used for **3 days**, the next API call detects the stale activity timestamp and forces logout — clearing all tokens from Keychain. This limits the damage window if a device is lost or stolen.

---

## 6. Code Obfuscation & Minification (R8/ProGuard)

**Files:** `android/app/build.gradle`, `android/app/proguard-rules.pro`

Release builds run R8 (Google's ProGuard replacement) with:
- **minifyEnabled** — removes unused code, obfuscates class/method names
- **shrinkResources** — removes unused resource files

ProGuard keep rules are defined for all third-party libraries to prevent R8 from stripping required classes. A critical rule preserves `BuildConfig` fields (used by `react-native-config` via reflection to deliver the API key):

```proguard
-keep class com.mec.campusone.BuildConfig { *; }
-keepclassmembers class com.mec.campusone.BuildConfig {
    public static <fields>;
}
```

---

## 7. Hermes JS Engine

**File:** `android/gradle.properties` (`hermesEnabled=true`)

The app uses Hermes — Meta's optimised JS engine for React Native. Hermes pre-compiles JS to bytecode at build time, which:
- Makes reverse-engineering the JS bundle significantly harder than plain JS
- Reduces startup time and memory usage

---

## 8. Cleartext Traffic

**File:** `android/app/build.gradle`

```groovy
manifestPlaceholders = [usesCleartextTraffic: "false"]   // release
manifestPlaceholders = [usesCleartextTraffic: "true"]    // debug only
```

Plain HTTP is blocked in release builds at the Android OS level. All traffic must go over HTTPS.

---

## 9. Automatic Token Refresh

**File:** `src/services/api.ts`

The Axios response interceptor silently refreshes the access token on 401 responses — no user action needed. Concurrent requests during a refresh are queued and replayed after the new token arrives. If refresh also fails, the user is force-logged out and all tokens are cleared.

The Socket.IO client also refreshes the token before each reconnection attempt to prevent expired-token socket failures.

---

## 10. Force Logout (Single-Device Enforcement)

**File:** `src/services/socketService.ts`

The backend emits a `force_logout` socket event when a new login occurs on a different device. The app listens for this event and immediately clears all tokens and navigates to the login screen — preventing simultaneous sessions on multiple devices.

---

## Security Checklist — Before Each Play Store Release

- [ ] SSL pins are current (check cert expiry — Let's Encrypt renews every ~90 days)
- [ ] `.env` has `APP_API_KEY` set (build will crash on launch without it)
- [ ] `gradle.properties` has `MYAPP_RELEASE_STORE_PASSWORD` and `MYAPP_RELEASE_KEY_PASSWORD` filled
- [ ] `versionCode` incremented from last Play Store upload
- [ ] `minifyEnabled = true` and `shrinkResources = true` in `build.gradle` (never ship a debug build)
- [ ] Build with `./gradlew bundleRelease` (AAB preferred over APK for Play Store)
- [ ] `NODE_ENV=production` set on the backend server before deploying

---

## Files Reference

| File | Purpose |
|------|---------|
| `android/app/src/main/res/xml/network_security_config.xml` | SSL certificate pins |
| `android/app/proguard-rules.pro` | R8 keep rules |
| `android/app/build.gradle` | Build config, signing, minification |
| `android/gradle.properties` | SDK versions, Hermes flag, keystore paths |
| `src/services/api.ts` | Token storage, device ID, API key, session timeout |
| `src/services/socketService.ts` | Socket auth, token refresh on reconnect, force logout |
| `.env` | `APP_API_KEY` — not committed to git |
