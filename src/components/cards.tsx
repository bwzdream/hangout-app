import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import type { ActivityWithPeople } from '@/lib/api';
import { formatTime, timeLeft } from '@/lib/time';
import type { Ping, Profile } from '@/lib/types';

import { Icon } from './icon';
import { LiquidGradient, TiltCard, paletteFor } from './liquid';
import { Avatar, AvatarStack, Row, T, displayName } from './ui';

export function ActivityCard({
  activity,
  profiles,
  meId,
  height = 236,
}: {
  activity: ActivityWithPeople;
  profiles: Record<string, Profile>;
  meId?: string;
  height?: number;
}) {
  const going = activity.members.filter((m) => m.status === 'going');
  const imIn = activity.members.some((m) => m.user_id === meId);
  const palette = paletteFor(activity.id);
  const d = new Date(activity.starts_at);
  return (
    <TiltCard
      height={height}
      glow={Colors.cardShadow}
      onPress={() => router.push({ pathname: '/activity/[id]', params: { id: activity.id } })}>
      <LiquidGradient palette={palette}>
        <View style={{ flex: 1, padding: 18, justifyContent: 'space-between' }}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ backgroundColor: Colors.cardPill, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
              <T variant="caption" color={Colors.cardPillInk} style={{ fontWeight: '800', fontSize: 12, letterSpacing: 0.6 }}>
                {d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
              </T>
            </View>
            {imIn ? (
              <View style={{ backgroundColor: Colors.accent, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
                <T variant="caption" color={Colors.onAccent} style={{ fontWeight: '800', fontSize: 12 }}>
                  {activity.host_id === meId ? 'HOSTING' : 'GOING'}
                </T>
              </View>
            ) : null}
          </Row>

          <View style={{ gap: 6 }}>
            <T variant="largeTitle" color={Colors.cardInk} numberOfLines={2}>
              {activity.title}
            </T>
            <Row style={{ justifyContent: 'space-between' }}>
              <T variant="label" color={Colors.cardInkSecondary} numberOfLines={1} style={{ flex: 1 }}>
                {formatTime(activity.starts_at)}
                {activity.location ? ` · ${activity.location}` : ''}
              </T>
              <Row gap={8}>
                <AvatarStack profiles={going.map((m) => profiles[m.user_id])} size={24} max={3} borderColor={Colors.cardPill} />
                <T variant="label" color={Colors.cardInk}>
                  {going.length}
                </T>
              </Row>
            </Row>
          </View>
        </View>
      </LiquidGradient>
    </TiltCard>
  );
}

/** Live pings, like stories. Unseen ones get an accent ring. */
export function PingStories({
  pings,
  profiles,
  viewed,
  meId,
}: {
  pings: Ping[];
  profiles: Record<string, Profile>;
  viewed: Set<string>;
  meId?: string;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: Spacing.lg, paddingRight: Spacing.lg }}
      style={{ marginHorizontal: -Spacing.md, paddingLeft: Spacing.md }}>
      <Pressable onPress={() => router.push('/ping/new')} style={{ alignItems: 'center', gap: 8, width: 68 }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: Colors.textTertiary,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon name="plus" size={22} color={Colors.textSecondary} />
        </View>
        <T variant="caption" numberOfLines={1}>
          You
        </T>
      </Pressable>
      {pings.map((p) => {
        const mine = p.sender_id === meId;
        const fresh = !mine && !viewed.has(p.id);
        return (
          <Pressable
            key={p.id}
            onPress={() => router.push({ pathname: '/ping/[id]', params: { id: p.id } })}
            style={{ alignItems: 'center', gap: 8, width: 68 }}>
            <Avatar profile={profiles[p.sender_id]} size={56} ring={fresh ? Colors.pink : Colors.surfaceRaised} />
            <View style={{ alignItems: 'center' }}>
              <T variant="caption" color={Colors.text} numberOfLines={1} style={{ fontWeight: '600' }}>
                {mine ? 'You' : displayName(profiles[p.sender_id]).split(' ')[0]}
              </T>
              <T variant="caption" style={{ fontSize: 11, lineHeight: 14 }} color={fresh ? Colors.pink : Colors.textTertiary}>
                {timeLeft(p.expires_at)}
              </T>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
