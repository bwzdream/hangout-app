import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import type { ActivityWithPeople } from '@/lib/api';
import { formatTime, timeLeft } from '@/lib/time';
import type { Ping, Profile } from '@/lib/types';

import { Icon } from './icon';
import { Glass, LiquidGradient, TiltCard, paletteFor } from './liquid';
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
  const host = profiles[activity.host_id];
  const palette = paletteFor(activity.id);
  const d = new Date(activity.starts_at);
  return (
    <TiltCard
      height={height}
      glow={palette[0]}
      onPress={() => router.push({ pathname: '/activity/[id]', params: { id: activity.id } })}>
      <LiquidGradient palette={palette}>
        <View style={{ flex: 1, padding: 10, justifyContent: 'space-between' }}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Glass radius={16} style={{ width: 58, height: 62, alignItems: 'center', justifyContent: 'center' }}>
              <T variant="overline" color="rgba(255,255,255,0.75)" style={{ fontSize: 10, lineHeight: 12 }}>
                {d.toLocaleDateString(undefined, { month: 'short' })}
              </T>
              <T variant="title" color="#fff" style={{ fontSize: 26, lineHeight: 30, fontWeight: '800' }}>
                {d.getDate()}
              </T>
            </Glass>
            <Row gap={8}>
              {imIn ? (
                <Glass radius={999} style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
                  <T variant="caption" color="#fff" style={{ fontWeight: '700', fontSize: 12 }}>
                    {activity.host_id === meId ? 'Hosting' : 'Going'}
                  </T>
                </Glass>
              ) : null}
              <Text style={{ fontSize: 34 }}>{activity.emoji}</Text>
            </Row>
          </Row>

          <Glass radius={20} style={{ padding: 14, gap: 8 }}>
            <View style={{ gap: 2 }}>
              <T variant="heading" color="#fff" numberOfLines={1} style={{ fontSize: 21, fontWeight: '800' }}>
                {activity.title}
              </T>
              <T variant="caption" color="rgba(255,255,255,0.75)" numberOfLines={1}>
                {d.toLocaleDateString(undefined, { weekday: 'short' })} · {formatTime(activity.starts_at)}
                {activity.location ? ` · ${activity.location}` : ''}
              </T>
            </View>
            <Row style={{ justifyContent: 'space-between' }}>
              <AvatarStack profiles={going.map((m) => profiles[m.user_id])} size={24} borderColor="rgba(0,0,0,0.35)" />
              <T variant="caption" color="rgba(255,255,255,0.75)">
                {going.length} going{host && activity.host_id !== meId ? ` · ${displayName(host)}` : ''}
              </T>
            </Row>
          </Glass>
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
            <Avatar profile={profiles[p.sender_id]} size={56} ring={fresh ? Colors.accent : Colors.surfaceRaised} />
            <View style={{ alignItems: 'center' }}>
              <T variant="caption" color={Colors.text} numberOfLines={1} style={{ fontWeight: '600' }}>
                {mine ? 'You' : displayName(profiles[p.sender_id]).split(' ')[0]}
              </T>
              <T variant="caption" style={{ fontSize: 11, lineHeight: 14 }} color={fresh ? Colors.accent : Colors.textTertiary}>
                {timeLeft(p.expires_at)}
              </T>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
