import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, Share, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Bouncy } from '@/components/playful';
import { Avatar, Button, Header, Input, Loading, Row, Screen, Section, T, displayName } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { confirm, errorMessage, notify } from '@/lib/alert';
import { acceptFriendRequest, getFriends, removeFriendship, searchProfiles, sendFriendRequest } from '@/lib/api';
import type { Profile } from '@/lib/types';
import { useAuth } from '@/providers/auth';

const COLUMNS = 3;

/** A friend as a big face with a name under it. */
function Face({ profile, onPress, badge }: { profile: Profile; onPress?: () => void; badge?: React.ReactNode }) {
  return (
    <Bouncy onPress={onPress} style={{ width: `${100 / COLUMNS}%`, alignItems: 'center', gap: 8, paddingVertical: 10 }}>
      <View>
        <Avatar profile={profile} size={76} />
        {badge ? <View style={{ position: 'absolute', right: -4, bottom: -4 }}>{badge}</View> : null}
      </View>
      <T variant="label" numberOfLines={1} style={{ maxWidth: 96 }}>
        {displayName(profile).split(' ')[0]}
      </T>
    </Bouncy>
  );
}

export default function Friends() {
  const { profile: me } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const { data, loading, refreshing, refresh, reload } = useData(getFriends);

  useEffect(() => {
    const t = setTimeout(() => {
      searchProfiles(query).then(setResults).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await reload();
    } catch (e) {
      notify('Something went wrong', errorMessage(e));
    }
  };

  const invite = async () => {
    const message = `Find me on Pingle: @${me?.username}`;
    if (Platform.OS === 'web') {
      await navigator.clipboard?.writeText(message);
      notify('Copied', 'Invite copied to your clipboard.');
    } else {
      await Share.share({ message });
    }
  };

  if (loading && !data) return <Loading />;

  const searching = query.trim().length >= 2;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Header title="Your people" />

      <Input value={query} onChangeText={setQuery} placeholder="Find someone by name or @username" autoCapitalize="none" autoCorrect={false} />

      {searching ? (
        <View style={{ gap: Spacing.lg }}>
          {results.length === 0 ? <T variant="body" color={Colors.textSecondary}>No one by that name yet. Send them an invite!</T> : null}
          {results.map((p) => {
            const f = data?.friendshipByUser[p.id];
            return (
              <Row key={p.id} gap={Spacing.lg}>
                <Avatar profile={p} size={52} />
                <View style={{ flex: 1 }}>
                  <T variant="heading">{displayName(p)}</T>
                  <T variant="caption">@{p.username}</T>
                </View>
                {!f ? (
                  <Button title="Add" size="sm" onPress={() => run(() => sendFriendRequest(p.id))} />
                ) : f.status === 'accepted' ? (
                  <T variant="caption">Friends</T>
                ) : f.addressee_id === p.id ? (
                  <T variant="caption">Requested</T>
                ) : (
                  <Button title="Accept" size="sm" onPress={() => run(() => acceptFriendRequest(f.id))} />
                )}
              </Row>
            );
          })}
        </View>
      ) : null}

      {!searching && data && data.incoming.length > 0
        ? data.incoming.map(({ friendship, profile }) => (
            <View key={friendship.id} style={{ backgroundColor: Colors.accent, borderRadius: 28, padding: 22, gap: Spacing.lg }}>
              <Row gap={Spacing.lg}>
                <Avatar profile={profile} size={52} />
                <View style={{ flex: 1 }}>
                  <T variant="title" color={Colors.onAccent}>
                    {displayName(profile).split(' ')[0]} wants to hang
                  </T>
                  <T variant="caption" color={Colors.onAccent} style={{ opacity: 0.7 }}>
                    @{profile.username}
                  </T>
                </View>
              </Row>
              <Row gap={Spacing.md}>
                <Button title="Accept" onPress={() => run(() => acceptFriendRequest(friendship.id))} />
                <Pressable onPress={() => run(() => removeFriendship(friendship.id))} hitSlop={8}>
                  <T variant="label" color={Colors.onAccent}>
                    Not now
                  </T>
                </Pressable>
              </Row>
            </View>
          ))
        : null}

      {!searching ? (
        <Section
          title={data && data.friends.length > 0 ? `Friends · ${data.friends.length}` : 'Friends'}
          action={
            <Pressable onPress={() => router.push('/circles')} hitSlop={8}>
              <T variant="label" style={{ textDecorationLine: 'underline' }}>
                Circles
              </T>
            </Pressable>
          }>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 }}>
            <Bouncy onPress={invite} style={{ width: `${100 / COLUMNS}%`, alignItems: 'center', gap: 8, paddingVertical: 10 }}>
              <View
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: 38,
                  borderWidth: 2,
                  borderColor: Colors.text,
                  borderStyle: 'dashed',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Icon name="plus" size={26} color={Colors.text} />
              </View>
              <T variant="label">Invite</T>
            </Bouncy>
            {(data?.friends ?? []).map((p) => (
              <Face
                key={p.id}
                profile={p}
                onPress={async () => {
                  const f = data?.friendshipByUser[p.id];
                  if (f && (await confirm(displayName(p), `Remove ${displayName(p)} from your friends?`, 'Remove'))) {
                    run(() => removeFriendship(f.id));
                  }
                }}
              />
            ))}
            {(data?.outgoing ?? []).map(({ friendship, profile }) => (
              <Face
                key={friendship.id}
                profile={profile}
                badge={
                  <View style={{ backgroundColor: Colors.surfaceRaised, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <T variant="caption" style={{ fontSize: 11 }}>
                      sent
                    </T>
                  </View>
                }
                onPress={async () => {
                  if (await confirm('Cancel request?', `Cancel your request to ${displayName(profile)}?`, 'Cancel request')) {
                    run(() => removeFriendship(friendship.id));
                  }
                }}
              />
            ))}
          </View>
          {data && data.friends.length === 0 ? (
            <T variant="body" color={Colors.textSecondary}>
              Search above or tap Invite to bring your crew.
            </T>
          ) : null}
        </Section>
      ) : null}
    </Screen>
  );
}
