/**
 * The moment after "Tell my friends": your card pops in, gets "sent" with a burst of
 * confetti and a stamp, your friends' faces fly in, and anyone who's free at the same
 * time shows up right away with a button to ask them.
 */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Colors, Spacing } from '@/constants/theme';
import { getAvailability, getFriends } from '@/lib/api';
import { freeWindows, intersect, type Interval } from '@/lib/availability';
import { formatDay, formatTime } from '@/lib/time';
import type { Profile } from '@/lib/types';

import { Icon } from './icon';
import { HandLogo } from './logo';
import { Avatar, AvatarStack, Button, Row, T, displayName } from './ui';

const span = (w: Interval) => `${formatTime(w.start)} – ${formatTime(w.end)}`;

// ─── Confetti ────────────────────────────────────────────────
const PIECES = Array.from({ length: 22 }, (_, i) => ({
  angle: (i / 22) * Math.PI * 2 + (i % 3) * 0.2,
  dist: 120 + ((i * 37) % 90),
  size: 6 + (i % 4) * 2,
  color: [Colors.accent, Colors.text, Colors.accentInk, '#FFD166'][i % 4],
  spin: (i % 2 ? 1 : -1) * (180 + i * 20),
  round: i % 3 === 0,
}));

function Piece({ p, delay }: { p: (typeof PIECES)[number]; delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withDelay(delay, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) })));
  }, [t, delay]);
  const style = useAnimatedStyle(() => {
    const v = t.get();
    return {
      opacity: v === 0 ? 0 : 1 - Math.max(0, v - 0.6) / 0.4,
      transform: [
        { translateX: Math.cos(p.angle) * p.dist * v },
        { translateY: Math.sin(p.angle) * p.dist * v + 60 * v * v }, // a little gravity
        { rotate: `${p.spin * v}deg` },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        { position: 'absolute', width: p.size, height: p.round ? p.size : p.size * 1.8, borderRadius: p.round ? p.size : 2, backgroundColor: p.color },
        style,
      ]}
    />
  );
}

function Confetti({ delay }: { delay: number }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: '45%', left: '50%' }}>
      {PIECES.map((p, i) => (
        <Piece key={i} p={p} delay={delay} />
      ))}
    </View>
  );
}

// ─── The card that gets "sent" ───────────────────────────────
function FreeCard({ me, range, note, sentAt }: { me: Profile | null; range: Interval; note: string; sentAt: number }) {
  const lift = useSharedValue(0);
  useEffect(() => {
    // pop in → wind up → "whoosh" a little upward → settle
    lift.set(
      withDelay(
        sentAt - 250,
        withSequence(withTiming(1, { duration: 160 }), withSpring(-1, { damping: 7, stiffness: 140 }), withSpring(0, { damping: 12 })),
      ),
    );
  }, [lift, sentAt]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.get() * -14 }, { rotate: `${lift.get() * -2}deg` }, { scale: 1 - Math.abs(lift.get()) * 0.03 }],
  }));

  return (
    <Animated.View entering={ZoomIn.springify().damping(12)} style={style}>
      <View style={{ backgroundColor: Colors.accent, borderRadius: 32, padding: 24, gap: Spacing.lg }}>
        <Row gap={Spacing.md}>
          <Avatar profile={me} size={52} ring={Colors.onAccent} />
          <View style={{ flex: 1 }}>
            <T variant="heading" color={Colors.onAccent}>
              {displayName(me).split(' ')[0]} is free
            </T>
            <T variant="caption" color={Colors.onAccent} style={{ opacity: 0.7 }}>
              {formatDay(range.start)}
            </T>
          </View>
          <HandLogo size={44} />
        </Row>
        <T variant="display" color={Colors.onAccent} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ fontSize: 42, lineHeight: 48 }}>
          {formatTime(range.start)} – {formatTime(range.end)}
        </T>
        {note ? (
          <T variant="title" color={Colors.onAccent} style={{ fontSize: 22, lineHeight: 26 }}>
            “{note}”
          </T>
        ) : null}
      </View>

      {/* the "Sent" stamp */}
      <Animated.View
        entering={ZoomIn.delay(sentAt).springify().damping(9)}
        style={{
          position: 'absolute',
          top: -14,
          right: -6,
          transform: [{ rotate: '8deg' }],
          backgroundColor: Colors.text,
          borderRadius: 999,
          paddingHorizontal: 14,
          paddingVertical: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        }}>
        <Icon name="check" size={14} color={Colors.accent} />
        <T variant="label" color={Colors.background} style={{ fontWeight: '800' }}>
          Sent
        </T>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Screen ──────────────────────────────────────────────────
type Match = { profile: Profile; both: Interval };

export function SentCelebration({
  me,
  range,
  note,
  circleMemberIds,
}: {
  me: Profile | null;
  range: Interval;
  note: string;
  /** If shared with a group, only these friends were told. */
  circleMemberIds?: string[] | null;
}) {
  const SENT_AT = 650;
  const [told, setTold] = useState<Profile[] | null>(null);
  const [matches, setMatches] = useState<Match[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { friends } = await getFriends();
        const audience = circleMemberIds ? friends.filter((f) => circleMemberIds.includes(f.id)) : friends;
        const avail = await getAvailability(
          audience.map((f) => f.id),
          range,
        );
        const found = audience
          .map((f) => {
            const both = avail[f.id] ? intersect([range], freeWindows(avail[f.id], range)) : [];
            const best = both.sort((a, b) => b.end - b.start - (a.end - a.start))[0];
            return best && best.end - best.start >= 30 * 60000 ? { profile: f, both: best } : null;
          })
          .filter((m): m is Match => m !== null)
          .sort((a, b) => a.both.start - b.both.start);
        if (!cancelled) {
          setTold(audience);
          setMatches(found);
        }
      } catch {
        if (!cancelled) {
          setTold([]);
          setMatches([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range, circleMemberIds]);

  const ask = (m: Match) =>
    router.replace({
      pathname: '/activity/new',
      params: {
        start: String(m.both.start),
        end: String(Math.min(m.both.end, m.both.start + 3 * 3600000)),
        invite: m.profile.id,
        title: note,
      },
    });

  return (
    <View style={{ gap: Spacing.xl }}>
      <View>
        <FreeCard me={me} range={range} note={note} sentAt={SENT_AT} />
        <Confetti delay={SENT_AT} />
      </View>

      {told ? (
        <Animated.View entering={FadeInDown.delay(SENT_AT + 250).duration(300)}>
          <Row gap={Spacing.md}>
            <AvatarStack profiles={told} size={32} max={6} borderColor={Colors.background} />
            <T variant="body" style={{ flex: 1 }}>
              {told.length === 0
                ? 'Saved! Add friends so they can see when you’re free.'
                : `Sent to ${told.length === 1 ? displayName(told[0]).split(' ')[0] : `${told.length} friends`}. It disappears at ${formatTime(range.end)}.`}
            </T>
          </Row>
        </Animated.View>
      ) : null}

      {matches ? (
        <Animated.View entering={FadeIn.delay(SENT_AT + 550).duration(300)} style={{ gap: Spacing.lg }}>
          {matches.length > 0 ? (
            <>
              <T variant="title">
                {matches.length === 1 ? `${displayName(matches[0].profile).split(' ')[0]} is free then too!` : `${matches.length} friends are free then too!`}
              </T>
              {matches.map((m, i) => (
                <Animated.View key={m.profile.id} entering={FadeInDown.delay(SENT_AT + 700 + i * 120).springify()}>
                  <Row
                    gap={Spacing.md}
                    style={{ backgroundColor: Colors.surface, borderRadius: 24, padding: 14, paddingRight: 10 }}>
                    <Avatar profile={m.profile} size={48} />
                    <View style={{ flex: 1 }}>
                      <T variant="heading">{displayName(m.profile)}</T>
                      <T variant="body" color={Colors.accentInk} style={{ fontWeight: '600' }}>
                        Both free {span(m.both)}
                      </T>
                    </View>
                    <Button title={`Ask ${displayName(m.profile).split(' ')[0]}`} size="sm" onPress={() => ask(m)} />
                  </Row>
                </Animated.View>
              ))}
            </>
          ) : told && told.length > 0 ? (
            <T variant="body" color={Colors.textSecondary}>
              No one else is free then yet. We&apos;ll let you know as soon as someone is.
            </T>
          ) : null}
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeIn.delay(SENT_AT + 900)}>
        <Button title="Back home" size="lg" variant="secondary" onPress={() => router.back()} />
      </Animated.View>
    </View>
  );
}
