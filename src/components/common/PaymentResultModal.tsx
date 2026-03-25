import React, { useEffect, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  Animated, Dimensions, StatusBar, Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from './Icon';

const { width: SW, height: SH } = Dimensions.get('window');

const CONFETTI_COLORS = [
  '#a78bfa', '#818cf8', '#f472b6', '#facc15',
  '#34d399', '#60a5fa', '#fb923c', '#e879f9',
];
const CONFETTI_COUNT = 40;

interface Props {
  visible: boolean;
  type: 'success' | 'failed';
  amount: number;
  userName?: string;
  userPhone?: string;
  userAvatar?: string | null;
  onContinue: () => void;
  onRetry?: () => void;
}

function formatResultDate(): string {
  const d = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return `${months[d.getMonth()]} ${d.getDate()} ${d.getFullYear()} ${days[d.getDay()]}`;
}

// ─── Confetti particle sub-component ────────────────────────────────
function Confetti({ anim, pieces }: { anim: Animated.Value; pieces: ReturnType<typeof buildConfetti> }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((p, i) => {
        const start = p.delay;
        const end = Math.min(start + p.speed, 1);
        const tY = anim.interpolate({
          inputRange: [start, end],
          outputRange: [0, p.fall],
          extrapolate: 'clamp',
        });
        const tX = anim.interpolate({
          inputRange: [start, end],
          outputRange: [0, p.sway],
          extrapolate: 'clamp',
        });
        const rot = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [`${p.r0}deg`, `${p.r0 + p.rd}deg`],
        });
        const opacity = anim.interpolate({
          inputRange: [Math.max(end - 0.12, start), end],
          outputRange: [1, 0.35],
          extrapolate: 'clamp',
        });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: p.x,
              top: p.y,
              width: p.w,
              height: p.h,
              backgroundColor: p.color,
              borderRadius: 2,
              opacity,
              transform: [{ translateY: tY }, { translateX: tX }, { rotate: rot }],
            }}
          />
        );
      })}
    </View>
  );
}

function buildConfetti() {
  return Array.from({ length: CONFETTI_COUNT }, (_, i) => {
    const size = 5 + Math.random() * 9;
    const isWide = Math.random() > 0.5;
    return {
      x: Math.random() * (SW - 12),
      y: -15 - Math.random() * 40,
      w: isWide ? size * 1.5 : size,
      h: isWide ? size * 0.6 : size * 1.6,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay: Math.random() * 0.35,
      speed: 0.3 + Math.random() * 0.4,
      sway: (Math.random() - 0.5) * 80,
      fall: 80 + Math.random() * (SH * 0.35),
      r0: Math.random() * 360,
      rd: (Math.random() - 0.5) * 600,
    };
  });
}

// ─── Main component ─────────────────────────────────────────────────
export default function PaymentResultModal({
  visible, type, amount, userName, userPhone, userAvatar, onContinue, onRetry,
}: Props) {
  const isSuccess = type === 'success';

  // Animations
  const iconScale = useRef(new Animated.Value(0)).current;
  const contentOp = useRef(new Animated.Value(0)).current;
  const confettiAnim = useRef(new Animated.Value(0)).current;
  const dissolveOp = useRef(new Animated.Value(1)).current;
  const dissolveScale = useRef(new Animated.Value(1)).current;

  const confettiPieces = useMemo(buildConfetti, []);
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDismissingRef = useRef(false);

  const dismiss = isSuccess ? onContinue : (onRetry || onContinue);

  const animateDismiss = useRef(() => {
    if (isDismissingRef.current) return;
    isDismissingRef.current = true;
    if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    Animated.parallel([
      Animated.timing(dissolveOp, {
        toValue: 0, duration: 500, useNativeDriver: true,
      }),
      Animated.timing(dissolveScale, {
        toValue: 0.92, duration: 500, useNativeDriver: true,
      }),
      Animated.timing(iconScale, {
        toValue: 1.15, duration: 350, useNativeDriver: true,
      }),
    ]).start(() => dismiss());
  }).current;

  useEffect(() => {
    if (!visible) return;

    // Reset all — start fully transparent for smooth fade-in
    // (animationType="none" so we control the entrance ourselves)
    iconScale.setValue(0);
    contentOp.setValue(0);
    confettiAnim.setValue(0);
    dissolveOp.setValue(0);
    dissolveScale.setValue(0.92);
    isDismissingRef.current = false;

    // Fade the entire modal in (replaces animationType="fade")
    Animated.parallel([
      Animated.timing(dissolveOp, {
        toValue: 1, duration: 300, useNativeDriver: true,
      }),
      Animated.spring(dissolveScale, {
        toValue: 1, friction: 8, tension: 60, useNativeDriver: true,
      }),
    ]).start();

    // Icon bounce in
    Animated.spring(iconScale, {
      toValue: 1, friction: 4, tension: 80, delay: 100, useNativeDriver: true,
    }).start();

    // Content fade in
    Animated.timing(contentOp, {
      toValue: 1, duration: 350, delay: 300, useNativeDriver: true,
    }).start();

    // Confetti fall (success only)
    if (isSuccess) {
      Animated.timing(confettiAnim, {
        toValue: 1, duration: 2800, delay: 250, useNativeDriver: true,
      }).start();
    }

    // Auto-dismiss after 3 seconds
    autoDismissRef.current = setTimeout(animateDismiss, 3000);
    return () => { if (autoDismissRef.current) clearTimeout(autoDismissRef.current); };
  }, [visible, isSuccess, iconScale, contentOp, confettiAnim, dissolveOp, dissolveScale, animateDismiss]);

  const formattedPhone = userPhone
    ? `+91 ${userPhone.slice(0, 3)} ${userPhone.slice(3, 6)} ${userPhone.slice(6)}`
    : '';

  if (!visible) return null;

  return (
    <Modal visible animationType="none" statusBarTranslucent onRequestClose={animateDismiss}>
      <View style={s.rootBg}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <Animated.View style={[s.root, { opacity: dissolveOp, transform: [{ scale: dissolveScale }] }]}>

        {/* ── Gradient card (top ~55%) ── */}
        <TouchableOpacity activeOpacity={1} onPress={animateDismiss} style={{ flex: 0 }}>
        <LinearGradient
          colors={isSuccess
            ? ['#7c3aed', '#6366f1', '#4f46e5']
            : ['#f87171', '#ef4444', '#dc2626']}
          start={{ x: 0.3, y: 0 }}
          end={{ x: 0.7, y: 1 }}
          style={s.card}
        >

          <View style={s.cardCenter}>
            {/* Icon with optional glow ring */}
            <Animated.View style={[s.iconWrap, { transform: [{ scale: iconScale }] }]}>
              {isSuccess && <View style={s.iconGlow} />}
              <View style={s.iconCircle}>
                <Icon
                  name={isSuccess ? 'checkmark-sharp' : 'close'}
                  size={38}
                  color={isSuccess ? '#4f46e5' : '#1a1a1a'}
                />
              </View>

              {/* Sparkles (success only) */}
              {isSuccess && (
                <>
                  <Animated.View style={[s.sparkle, { top: -8, right: -14 }, { opacity: contentOp }]}>
                    <Text style={s.sparkleChar}>✦</Text>
                  </Animated.View>
                  <Animated.View style={[s.sparkle, { top: 2, left: -16 }, { opacity: contentOp }]}>
                    <Text style={[s.sparkleChar, { fontSize: 10 }]}>✦</Text>
                  </Animated.View>
                  <Animated.View style={[s.sparkle, { bottom: 6, right: -20 }, { opacity: contentOp }]}>
                    <Text style={[s.sparkleChar, { fontSize: 11 }]}>✧</Text>
                  </Animated.View>
                </>
              )}
            </Animated.View>

            {/* Text content */}
            <Animated.View style={[s.textBlock, { opacity: contentOp }]}>
              <Text style={s.dateText}>{formatResultDate()}</Text>
              <Text style={s.title}>
                {isSuccess ? 'Transaction Successful' : 'Payment Failed'}
              </Text>
              {isSuccess && <Text style={s.amount}>Rs. {amount}</Text>}

              {/* User pill */}
              {userName ? (
                <View style={s.userPill}>
                  {userAvatar ? (
                    <Image source={{ uri: userAvatar }} style={s.avatar} />
                  ) : (
                    <View style={s.avatarFallback}>
                      <Icon name="person" size={16} color="#fff" />
                    </View>
                  )}
                  <View>
                    <Text style={s.userName}>{userName}</Text>
                    {formattedPhone ? <Text style={s.userPhone}>{formattedPhone}</Text> : null}
                  </View>
                </View>
              ) : null}
            </Animated.View>
          </View>
        </LinearGradient>
        </TouchableOpacity>

        {/* ── Bottom area (confetti) ── */}
        <TouchableOpacity style={s.bottom} activeOpacity={1} onPress={animateDismiss}>
          {isSuccess && <Confetti anim={confettiAnim} pieces={confettiPieces} />}
        </TouchableOpacity>
      </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────
const CARD_H = SH * 0.56;
const STATUS_H = StatusBar.currentHeight || 44;

const s = StyleSheet.create({
  rootBg: { flex: 1, backgroundColor: '#0a0a0a' },
  root: { flex: 1, backgroundColor: '#0a0a0a' },

  // Gradient card
  card: {
    height: CARD_H,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    paddingTop: STATUS_H + 12,
    paddingHorizontal: 24,
  },
  cardCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 30,
  },

  // Icon
  iconWrap: { marginBottom: 28 },
  iconGlow: {
    position: 'absolute',
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.12)',
    top: -8, left: -8,
  },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },

  // Sparkles
  sparkle: { position: 'absolute' },
  sparkleChar: { fontSize: 14, color: 'rgba(255,255,255,0.65)' },

  // Text content
  textBlock: { alignItems: 'center' },
  dateText: {
    fontSize: 13, color: 'rgba(255,255,255,0.6)',
    marginBottom: 10, fontWeight: '500',
  },
  title: {
    fontSize: 22, fontWeight: '800', color: '#fff',
    marginBottom: 6, textAlign: 'center',
  },
  amount: {
    fontSize: 36, fontWeight: '900', color: '#fff',
    marginBottom: 20,
  },

  // User pill
  userPill: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(0,0,0,0.22)',
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 30,
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  avatarFallback: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  userName: { fontSize: 14, fontWeight: '600', color: '#fff' },
  userPhone: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 1 },

  // Bottom area
  bottom: { flex: 1, overflow: 'hidden' },
});
