import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Share, View } from 'react-native';

import { Avatar, Button, Card, Empty, Input, Loading, Row, Screen, Section, T, displayName } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { confirm, errorMessage, notify } from '@/lib/alert';
import {
  acceptFriendRequest,
  getFriends,
  removeFriendship,
  searchProfiles,
  sendFriendRequest,
} from '@/lib/api';
import type { Profile } from '@/lib/types';
import { useAuth } from '@/providers/auth';

function PersonRow({ profile, children }: { profile: Profile; children?: React.ReactNode }) {
  return (
    <Row gap={Spacing.md}>
      <Avatar profile={profile} />
      <View style={{ flex: 1 }}>
        <T variant="label">{displayName(profile)}</T>
        <T variant="caption">@{profile.username}</T>
      </View>
      {children}
    </Row>
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
      notify('Oops', errorMessage(e));
    }
  };

  const invite = async () => {
    const message = `Let's hang! Add me on Pingle: @${me?.username} 🙌`;
    if (Platform.OS === 'web') {
      await navigator.clipboard?.writeText(message);
      notify('Copied!', 'Invite message copied to your clipboard.');
    } else {
      await Share.share({ message });
    }
  };

  if (loading && !data) return <Loading />;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <T variant="title">Friends 👯</T>

      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="Search by name or @username"
        autoCapitalize="none"
        autoCorrect={false}
      />

      {query.length >= 2 ? (
        <Section title="Results">
          {results.length === 0 ? <T variant="caption">No one found — invite them instead!</T> : null}
          {results.map((p) => {
            const f = data?.friendshipByUser[p.id];
            return (
              <Card key={p.id}>
                <PersonRow profile={p}>
                  {!f ? (
                    <Button title="Add" size="sm" onPress={() => run(() => sendFriendRequest(p.id))} />
                  ) : f.status === 'accepted' ? (
                    <T variant="caption">Friends ✓</T>
                  ) : f.addressee_id === p.id ? (
                    <T variant="caption">Requested</T>
                  ) : (
                    <Button title="Accept" size="sm" variant="accent" onPress={() => run(() => acceptFriendRequest(f.id))} />
                  )}
                </PersonRow>
              </Card>
            );
          })}
        </Section>
      ) : null}

      {data && data.incoming.length > 0 ? (
        <Section title={`Requests (${data.incoming.length}) 💌`}>
          {data.incoming.map(({ friendship, profile }) => (
            <Card key={friendship.id} tone="accentSoft">
              <PersonRow profile={profile}>
                <Button title="Accept" size="sm" variant="accent" onPress={() => run(() => acceptFriendRequest(friendship.id))} />
                <Button title="✕" size="sm" variant="ghost" onPress={() => run(() => removeFriendship(friendship.id))} />
              </PersonRow>
            </Card>
          ))}
        </Section>
      ) : null}

      <Section
        title={`Your friends (${data?.friends.length ?? 0})`}
        action={<Button title="Circles" variant="ghost" size="sm" onPress={() => router.push('/circles')} />}>
        {data && data.friends.length === 0 ? (
          <Empty
            emoji="🥺"
            title="No friends here yet"
            body="Search above, or send your crew an invite."
            action={<Button title="Invite friends" icon="💌" onPress={invite} />}
          />
        ) : (
          data?.friends.map((p) => (
            <Card key={p.id}>
              <PersonRow profile={p}>
                <Button
                  title="Remove"
                  size="sm"
                  variant="danger"
                  onPress={async () => {
                    const f = data.friendshipByUser[p.id];
                    if (f && (await confirm('Remove friend?', `${displayName(p)} won't see your free time anymore.`, 'Remove'))) {
                      run(() => removeFriendship(f.id));
                    }
                  }}
                />
              </PersonRow>
            </Card>
          ))
        )}
      </Section>

      {data && data.outgoing.length > 0 ? (
        <Section title="Pending">
          {data.outgoing.map(({ friendship, profile }) => (
            <Card key={friendship.id}>
              <PersonRow profile={profile}>
                <Button title="Cancel" size="sm" variant="ghost" onPress={() => run(() => removeFriendship(friendship.id))} />
              </PersonRow>
            </Card>
          ))}
        </Section>
      ) : null}

      {data && data.friends.length > 0 ? <Button title="Invite more friends" icon="💌" variant="secondary" onPress={invite} /> : null}
    </Screen>
  );
}
