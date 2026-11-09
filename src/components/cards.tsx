import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import type { ActivityWithPeople } from '@/lib/api';
import { formatTime, timeLeft } from '@/lib/time';
import type { Ping, Profile } from '@/lib/types';

import { Icon } from './icon';
import { Avatar, AvatarStack, Badge, Card, DateBlock, Row, T, displayName } from './ui';

export function ActivityCard({
  activity,
  profiles,
  meId,
}: {
  activity: ActivityWithPeople;
  profiles: Record<string, Profile>;
  meId?: string;
}) {
  const going = activity.members.filter((m) => m.status === 'going');
  const imIn = activity.members.some((m) => m.user_id === meId);
  const host = profiles[activity.host_id];
  const weekday = new Date(activity.starts_at).toLocaleDateString(undefined, { weekday: 'short' });
  return (
    <Card onPress={() => router.push({ pathname: '/activity/[id]', params: { id: activity.id } })}>
      <Row gap={Spacing.lg} style={{ alignItems: 'flex-start' }}>
        <DateBlock date={activity.starts_at} />
        <View style={{ flex: 1, gap: 3 }}>
          <T variant="heading" numberOfLines={2}>
            {activity.title}
          </T>
          <T variant="caption">
            {weekday} · {formatTime(activity.starts_at)}
            {activity.location ? ` · ${activity.location}` : ''}
          </T>
        </View>
        {imIn ? <Badge label={activity.host_id === meId ? 'Hosting' : 'Going'} /> : null}
      </Row>
      <Row style={{ justifyContent: 'space-between' }}>
        <AvatarStack profiles={going.map((m) => profiles[m.user_id])} size={26} />
        <T variant="caption">
          {going.length} going{host && activity.host_id !== meId ? ` · ${displayName(host)}` : ''}
        </T>
      </Row>
    </Card>
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
      style={{ marginHorizontal: -Spacing.xl + 4, paddingLeft: Spacing.xl - 4 }}>
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
