import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Animated,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { WeeklyChallenge, WeeklyChallengeDay } from '../../types';
import { useAppDispatch, useAppSelector } from '../../store';
import { claimWeeklyChallenge } from '../../store/slices/streakSlice';

interface Props {
  visible: boolean;
  weeklyChallenge: WeeklyChallenge | null;
  onClose: () => void;
}

type Phase = 'idle' | 'shaking' | 'opening' | 'revealed' | 'claiming' | 'claimed';

const SPARKLE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const SPARKLE_EMOJIS = ['✨', '⭐', '✨', '⭐', '✨', '⭐', '✨', '⭐'];

const EMPTY_DAYS: WeeklyChallengeDay[] = Array.from({ length: 7 }, (_, i) => ({
  date: '',
  dayLabel: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][i],
  orderCount: 0,
  completed: false,
  isFuture: true,
}));

function getDaySquareColor(day: WeeklyChallengeDay, completedDays: number): string {
  if (day.isFuture) return 'rgba(255,255,255,0.12)';   // future — very faint
  if (!day.completed) return 'rgba(255,255,255,0.22)';  // past missed — muted
  if (completedDays <= 3) return '#a78bfa';   // early week — light purple
  if (completedDays <= 5) return '#7c3aed';   // mid week — deep purple
  return '#fbbf24';                            // 6-7 days — gold!
}

export default function WeeklyChallengeModal({ visible, weeklyChallenge, onClose }: Props) {
  const dispatch = useAppDispatch();
  const claimLoading = useAppSelector(s => s.streak.weeklyClaimLoading);
  // Get personality for personalized badge reveal
  const personality = useAppSelector(s => s.streak.summary?.personality ?? null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [claimError, setClaimError] = useState('');

  const completedDays = weeklyChallenge?.completedDays ?? 0;
  const isClaimable = weeklyChallenge?.isClaimable ?? false;
  const claimed = weeklyChallenge?.claimed ?? false;
  const days = weeklyChallenge?.days ?? EMPTY_DAYS;

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const boxScale = useRef(new Animated.Value(1)).current;
  const boxOpacity = useRef(new Animated.Value(1)).current;
  const badgeScale = useRef(new Animated.Value(0)).current;
  const badgeOpacity = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.7)).current;

  const sparkles = useRef(
    SPARKLE_ANGLES.map(() => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0),
    }))
  ).current;

  const resetAnims = useCallback(() => {
    shakeAnim.setValue(0);
    boxScale.setValue(1);
    boxOpacity.setValue(1);
    badgeScale.setValue(0);
    badgeOpacity.setValue(0);
    glowAnim.setValue(0.7);
    sparkles.forEach(s => {
      s.x.setValue(0); s.y.setValue(0);
      s.opacity.setValue(0); s.scale.setValue(0);
    });
  }, [shakeAnim, boxScale, boxOpacity, badgeScale, badgeOpacity, glowAnim, sparkles]);

  useEffect(() => {
    if (visible) {
      setClaimError('');
      if (claimed) {
        // Skip straight to claimed state
        resetAnims();
        boxOpacity.setValue(0);
        boxScale.setValue(0);
        badgeScale.setValue(1);
        badgeOpacity.setValue(1);
        setPhase('claimed');
        // Idle glow loop for badge
        const loop = Animated.loop(Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        ]));
        loop.start();
        return () => loop.stop();
      } else {
        resetAnims();
        setPhase('idle');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, claimed]);

  const runAnimation = useCallback(() => {
    if (phase !== 'idle') return;
    setPhase('shaking');

    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 70, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 70, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 9, duration: 70, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -9, duration: 70, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5, duration: 70, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 70, useNativeDriver: true }),
    ]).start(() => {
      setPhase('opening');

      const sparkleAnims = sparkles.flatMap((s, i) => {
        const angle = (SPARKLE_ANGLES[i] * Math.PI) / 180;
        const dist = 90;
        return [
          Animated.timing(s.opacity, { toValue: 1, duration: 80, useNativeDriver: true }),
          Animated.timing(s.scale, { toValue: 1.2, duration: 200, useNativeDriver: true }),
          Animated.timing(s.x, { toValue: Math.cos(angle) * dist, duration: 600, useNativeDriver: true }),
          Animated.timing(s.y, { toValue: Math.sin(angle) * dist, duration: 600, useNativeDriver: true }),
          Animated.sequence([
            Animated.delay(200),
            Animated.timing(s.opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
          ]),
        ];
      });

      Animated.parallel([
        Animated.sequence([
          Animated.spring(boxScale, { toValue: 1.5, friction: 3, tension: 100, useNativeDriver: true }),
          Animated.timing(boxScale, { toValue: 0, duration: 180, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(250),
          Animated.timing(boxOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]),
        ...sparkleAnims,
      ]).start(() => {
        setPhase('revealed');
        Animated.parallel([
          Animated.spring(badgeScale, { toValue: 1, friction: 4, tension: 50, useNativeDriver: true }),
          Animated.timing(badgeOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        ]).start(() => {
          // Start badge glow loop
          Animated.loop(Animated.sequence([
            Animated.timing(glowAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
            Animated.timing(glowAnim, { toValue: 0.7, duration: 800, useNativeDriver: true }),
          ])).start();
        });
      });
    });
  }, [phase, shakeAnim, boxScale, boxOpacity, sparkles, badgeScale, badgeOpacity, glowAnim]);

  const handleClaim = useCallback(async () => {
    setPhase('claiming');
    setClaimError('');
    try {
      await dispatch(claimWeeklyChallenge()).unwrap();
      setPhase('claimed');
    } catch (e: any) {
      setClaimError(e?.toString?.() || 'Could not claim badge. Try again.');
      setPhase('revealed');
    }
  }, [dispatch]);

  const showBox = phase === 'idle' || phase === 'shaking' || phase === 'opening';
  const showBadge = phase === 'revealed' || phase === 'claiming' || phase === 'claimed';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <LinearGradient colors={['#2e1065', '#6d28d9']} style={styles.card}>

            {/* Close */}
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.closeTxt}>✕</Text>
            </TouchableOpacity>

            {/* Header */}
            <Text style={styles.title}>Weekly Challenge</Text>
            <Text style={styles.subtitle}>3 meals/day for 7 days</Text>

            {/* 7-day progress */}
            <View style={styles.daysRow}>
              {days.map((day, i) => (
                <View key={i} style={styles.dayCol}>
                  <Text style={styles.dayLabel}>{day.dayLabel}</Text>
                  <View style={[styles.daySquare, { backgroundColor: getDaySquareColor(day, completedDays) }]}>
                    {day.completed && <Text style={styles.dayCheck}>✓</Text>}
                  </View>
                </View>
              ))}
            </View>

            {/* Gift / Badge area */}
            <View style={styles.giftArea}>
              {/* Sparkles (absolutely positioned around center) */}
              {sparkles.map((s, i) => (
                <Animated.Text
                  key={i}
                  style={[styles.sparkle, {
                    transform: [
                      { translateX: s.x },
                      { translateY: s.y },
                      { scale: s.scale },
                    ],
                    opacity: s.opacity,
                  }]}
                >
                  {SPARKLE_EMOJIS[i]}
                </Animated.Text>
              ))}

              {showBox && (
                <Animated.Text style={[styles.giftEmoji, {
                  transform: [
                    { translateX: shakeAnim },
                    { scale: boxScale },
                  ],
                  opacity: boxOpacity,
                }]}>
                  🎁
                </Animated.Text>
              )}

              {showBadge && (
                <Animated.View style={[styles.badgeWrap, {
                  transform: [{ scale: badgeScale }],
                  opacity: Animated.multiply(badgeOpacity, glowAnim),
                }]}>
                  {/* Show personality badge if available, else fallback to medal */}
                  <Text style={styles.badgeEmoji}>
                    {personality ? personality.emoji : '🏅'}
                  </Text>
                  {personality && (
                    <Text style={styles.badgePersonalityLabel}>{personality.label}</Text>
                  )}
                </Animated.View>
              )}
            </View>

            {/* Status / label */}
            {showBadge ? (
              <Text style={styles.badgeLabel}>
                {phase === 'claimed'
                  ? `${personality?.label ?? 'Badge'} Claimed! 🎉`
                  : `Perfect Week! You're a ${personality?.label ?? 'Champion'}!`}
              </Text>
            ) : (
              <Text style={styles.statusText}>
                {completedDays === 0
                  ? 'Start ordering to light up the squares!'
                  : isClaimable
                  ? 'You did it! Open your reward!'
                  : `${completedDays}/7 days completed`}
              </Text>
            )}

            {claimError ? (
              <Text style={styles.errorText}>{claimError}</Text>
            ) : null}

            {/* Action buttons */}
            {isClaimable && !claimed && phase === 'idle' && (
              <TouchableOpacity style={styles.actionBtn} onPress={runAnimation} activeOpacity={0.85}>
                <Text style={styles.actionTxt}>🎁 Open Gift</Text>
              </TouchableOpacity>
            )}

            {phase === 'revealed' && !claimed && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.claimBtn]}
                onPress={handleClaim}
                activeOpacity={0.85}
                disabled={claimLoading}
              >
                <Text style={styles.actionTxt}>{claimLoading ? 'Claiming…' : '🏅 Claim Badge'}</Text>
              </TouchableOpacity>
            )}

          </LinearGradient>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: 320,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 16,
  },
  closeTxt: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '700',
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
    marginTop: 4,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
    marginBottom: 20,
  },
  daysRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 28,
  },
  dayCol: { alignItems: 'center', gap: 4 },
  dayLabel: { fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: '700' },
  daySquare: {
    width: 30, height: 30, borderRadius: 7,
    justifyContent: 'center', alignItems: 'center',
  },
  dayCheck: { fontSize: 13, color: '#fff', fontWeight: '900' },
  giftArea: {
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  sparkle: {
    position: 'absolute',
    fontSize: 18,
  },
  giftEmoji: {
    position: 'absolute',
    fontSize: 72,
  },
  badgeWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeEmoji: { fontSize: 72 },
  badgePersonalityLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fbbf24',
    marginTop: 6,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  badgeLabel: {
    fontSize: 17,
    fontWeight: '900',
    color: '#fbbf24',
    marginBottom: 20,
    letterSpacing: 0.3,
  },
  statusText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 18,
  },
  errorText: {
    fontSize: 11,
    color: '#fca5a5',
    marginBottom: 8,
    textAlign: 'center',
  },
  actionBtn: {
    backgroundColor: '#fbbf24',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 32,
    marginTop: 4,
  },
  claimBtn: {
    backgroundColor: '#7c3aed',
    borderWidth: 2,
    borderColor: '#fbbf24',
  },
  actionTxt: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e0a3c',
  },
});
