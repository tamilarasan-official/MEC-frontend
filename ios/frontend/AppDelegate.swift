import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import FirebaseCore
import UserNotifications
#if canImport(TrustKit)
import TrustKit
#endif

@main
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {
  var window: UIWindow?
  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    AppDelegate.configureTrustKit()
    FirebaseApp.configure()
    UNUserNotificationCenter.current().delegate = self
    AppDelegate.registerNotificationCategories()
    application.registerForRemoteNotifications()

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    return true
  }

  // MARK: SSL Certificate Pinning (TrustKit)
  //
  // iOS counterpart to android/app/src/main/res/xml/network_security_config.xml.
  // Pins the SPKI SHA-256 of campusoneapi.madrascollege.ac.in so a MITM attack
  // on campus WiFi (with a rogue CA) cannot intercept API traffic.
  //
  // Safe defaults — will NOT break existing traffic:
  //   - #if canImport(TrustKit): compiles even before `pod install`.
  //     Until the pod is installed, this function is a no-op.
  //   - kTSKEnforcePinning: false (report-only). TrustKit logs pin failures
  //     but does NOT block traffic. Flip to `true` in release only AFTER
  //     validating on a real device (both pins must be current).
  //   - #if DEBUG early-return: pinning never runs in debug builds, so
  //     Charles/Proxyman and simulator test flows are unaffected.
  //
  // PIN ROTATION: Let's Encrypt renews every ~90 days. Set a calendar reminder
  // for every 80 days. Update BOTH the Android XML and the pins below in the
  // same commit — Android-only or iOS-only updates will lock half your users
  // out when the cert rolls.
  //
  // Regenerate pins with:
  //   openssl s_client -servername campusoneapi.madrascollege.ac.in \
  //     -connect campusoneapi.madrascollege.ac.in:443 2>/dev/null \
  //     | openssl x509 -noout -pubkey \
  //     | openssl pkey -pubin -outform der \
  //     | openssl dgst -sha256 -binary | base64
  private static func configureTrustKit() {
    #if DEBUG
      // Skip pinning entirely in debug builds — developers need to proxy traffic
      return
    #else
    #if canImport(TrustKit)
      let trustKitConfig: [String: Any] = [
        kTSKSwizzleNetworkDelegates: true,
        kTSKPinnedDomains: [
          "campusoneapi.madrascollege.ac.in": [
            kTSKIncludeSubdomains: false,
            // Report-only: log pin mismatches but do NOT block traffic.
            // Flip to `true` once you've confirmed a release build hits the
            // API successfully and both pins are valid.
            kTSKEnforcePinning: false,
            kTSKDisableDefaultReportUri: true,
            kTSKPublicKeyHashes: [
              // Leaf cert — regenerate on every Let's Encrypt renewal
              "cLKLGCyyKgF0uAIv2SNjy4KXsPOEzL+rbJ97M3OFLUk=",
              // Let's Encrypt R13 intermediate — more stable backup pin
              "AlSQhgtJirc8ahLyekmtX+Iw+v46yPYRLJt9Cq1GlB0="
            ]
          ]
        ]
      ]
      TrustKit.initSharedInstance(withConfiguration: trustKitConfig)
    #endif
    #endif
  }

  // MARK: Notification Categories (iOS equivalent of Android notifee channels)
  //
  // Matches src/services/notificationService.ts channel identifiers:
  //   CHANNEL_ORDER_READY    = 'order_ready'
  //   CHANNEL_ORDER_UPDATES  = 'order_updates'
  //   CHANNEL_WALLET         = 'wallet'
  //   CHANNEL_GENERAL        = 'general'
  //
  // Additive: registering categories does NOT force any notification to use them.
  // The backend opts in by setting aps.category in the push payload. Notifications
  // sent without a category continue to display normally with system defaults —
  // so existing push flows are unaffected.
  //
  // Custom sound: if the backend sends aps.sound = "notification_sound.wav" for
  // order-ready pushes, iOS will play ios/frontend/notification_sound.wav from the
  // bundle. If the file isn't in the Xcode target's Copy Bundle Resources phase,
  // iOS silently falls back to the default sound — no crash, no regression.
  private static func registerNotificationCategories() {
    let orderReady = UNNotificationCategory(
      identifier: "order_ready",
      actions: [],
      intentIdentifiers: [],
      options: [.customDismissAction]
    )
    let orderUpdates = UNNotificationCategory(
      identifier: "order_updates",
      actions: [],
      intentIdentifiers: [],
      options: []
    )
    let wallet = UNNotificationCategory(
      identifier: "wallet",
      actions: [],
      intentIdentifiers: [],
      options: []
    )
    let general = UNNotificationCategory(
      identifier: "general",
      actions: [],
      intentIdentifiers: [],
      options: []
    )
    UNUserNotificationCenter.current().setNotificationCategories([
      orderReady, orderUpdates, wallet, general
    ])
  }

  func application(_ application: UIApplication,
                   didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    // Firebase proxy (enabled in Info.plist) handles APNs token forwarding automatically
  }

  // MARK: UNUserNotificationCenterDelegate

  // Show notifications even when app is in foreground
  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    completionHandler([.banner, .sound, .badge])
  }

  // Handle notification tap
  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    completionHandler()
  }

  // MARK: UISceneSession Lifecycle

  func application(
    _ application: UIApplication,
    configurationForConnecting connectingSceneSession: UISceneSession,
    options: UIScene.ConnectionOptions
  ) -> UISceneConfiguration {
    let config = UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    config.delegateClass = SceneDelegate.self
    return config
  }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  // Privacy blur overlay — hides sensitive UI (wallet, QR, PIN, payment screens)
  // from the iOS app-switcher snapshot. Added on sceneWillResignActive so it's
  // already in place when iOS captures the switcher thumbnail, and removed on
  // sceneDidBecomeActive so it never blocks user touches. Idempotent via the
  // nil-check guard — safe against duplicate lifecycle calls. This is the iOS
  // counterpart to Android's FLAG_SECURE (SecureScreenModule.kt); however,
  // unlike FLAG_SECURE which prevents screenshots outright, iOS only hides the
  // app-switcher snapshot — full-screen screenshots are still possible (there
  // is no iOS API to disable them app-wide).
  private var privacyBlurView: UIVisualEffectView?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else { return }
    let window = UIWindow(windowScene: windowScene)
    self.window = window

    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = appDelegate.reactNativeFactory else { return }

    // Ensure legacy AppDelegate.window is set for libraries that rely on it (like react-native-razorpay)
    appDelegate.window = window

    factory.startReactNative(
      withModuleName: "frontend",
      in: window,
      launchOptions: nil
    )
  }

  func sceneWillResignActive(_ scene: UIScene) {
    guard let window = self.window else { return }
    guard privacyBlurView == nil else { return }
    let blur = UIVisualEffectView(effect: UIBlurEffect(style: .systemThickMaterial))
    blur.frame = window.bounds
    blur.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    blur.isUserInteractionEnabled = false
    blur.tag = 1001
    window.addSubview(blur)
    window.bringSubviewToFront(blur)
    privacyBlurView = blur
  }

  func sceneDidBecomeActive(_ scene: UIScene) {
    privacyBlurView?.removeFromSuperview()
    privacyBlurView = nil
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
