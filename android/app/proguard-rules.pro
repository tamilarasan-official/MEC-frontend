# React Native
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-dontwarn com.facebook.**

# Firebase
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# Razorpay
-keep class com.razorpay.** { *; }
-dontwarn com.razorpay.**

# Socket.IO / OkHttp / Okio
-keep class io.socket.** { *; }
-keep class okhttp3.** { *; }
-keep class okio.** { *; }
-dontwarn io.socket.**
-dontwarn okhttp3.**
-dontwarn okio.**

# Notifee
-keep class io.invertase.notifee.** { *; }
-dontwarn io.invertase.notifee.**

# Vision Camera
-keep class com.mrousavy.camera.** { *; }
-dontwarn com.mrousavy.camera.**

# Worklets (used by Vision Camera for frame processing)
-keep class com.worklets.** { *; }
-dontwarn com.worklets.**
-keep class com.swmansion.worklets.** { *; }
-dontwarn com.swmansion.worklets.**

# React Native Reanimated
-keep class com.swmansion.reanimated.** { *; }
-dontwarn com.swmansion.reanimated.**

# React Native Gesture Handler
-keep class com.swmansion.gesturehandler.** { *; }
-dontwarn com.swmansion.gesturehandler.**

# Bottom Sheet
-keep class com.gorhom.bottomsheet.** { *; }

# Keep native methods
-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactProp <methods>;
}
-keepclassmembers class * {
    @com.facebook.proguard.annotations.DoNotStrip *;
    @com.facebook.common.internal.DoNotStrip *;
}

# SVG
-keep public class com.horcrux.svg.** { *; }

# MLKit Barcode Scanning (used by VisionCamera)
-keep class com.google.mlkit.** { *; }
-dontwarn com.google.mlkit.**

# AsyncStorage
-keep class com.reactnativecommunity.asyncstorage.** { *; }
-dontwarn com.reactnativecommunity.asyncstorage.**

# react-native-config (env vars — must not be stripped or Config.APP_API_KEY returns undefined)
# RNCConfigModuleImpl reads BuildConfig fields via reflection — R8 strips them without this rule
-keep class com.lugg.** { *; }
-dontwarn com.lugg.**
-keep class com.mec.campusone.BuildConfig { *; }
-keepclassmembers class com.mec.campusone.BuildConfig {
    public static <fields>;
}

# React Native Screens (used by React Navigation)
-keep class com.swmansion.rnscreens.** { *; }
-dontwarn com.swmansion.rnscreens.**

# Linear Gradient
-keep class com.BV.LinearGradient.** { *; }
-dontwarn com.BV.LinearGradient.**
