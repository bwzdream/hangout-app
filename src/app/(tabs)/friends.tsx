import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, Share } from 'react-native';

import { Avatar, Button, Empty, Header, IconButton, Input, List, ListRow, Loading, Screen, Section, T, displayName } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { confirm, errorMessage, notify } from '@/lib/alert';
import { acceptFriendRequest, getFriends, removeFriendship, searchProfiles, sendFriendRequest } from '@/lib/api';
import type { Profile } from '@/lib/types';
import { useAuth } from '@/providers/auth';

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

  const avatar = (p: Profile) => <Avatar profile={p} size={36} />;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Header title="Friends" right={<IconButton icon="share" label="Invite friends" onPress={invite} />} />

      <Input value={query} onChangeText={setQuery} placeholder="Search name or @username" autoCapitalize="none" autoCorrect={false} />

      {query.length >= 2 ? (
        <Section title="Results">
          {results.length === 0 ? (
            <T variant="caption">No one found. Send them an invite instead.</T>
          ) : (
            <List>
              {results.map((p) => {
                const f = data?.friendshipByUser[p.id];
                const right = !f ? (
                  <Button title="Add" size="sm" variant="white" onPress={() => run(() => sendFriendRequest(p.id))} />
                ) : f.status === 'accepted' ? (
                  <T variant="caption">Friends</T>
                ) : f.addressee_id === p.id ? (
                  <T variant="caption">Requested</T>
                ) : (
                  <Button title="Accept" size="sm" onPress={() => run(() => acceptFriendRequest(f.id))} />
                );
                return <ListRow key={p.id} title={displayName(p)} subtitle={`@${p.username}`} left={avatar(p)} right={right} chevron={false} />;
              })}
            </List>
          )}
        </Section>
      ) : null}

      {data && data.incoming.length > 0 ? (
        <Section title={`Requests · ${data.incoming.length}`}>
          <List>
            {data.incoming.map(({ friendship, profile }) => (
              <ListRow
                key={friendship.id}
                title={displayName(profile)}
                subtitle={`@${profile.username}`}
                left={avatar(profile)}
                chevron={false}
                right={
                  <>
                    <Button title="Accept" size="sm" onPress={() => run(() => acceptFriendRequest(friendship.id))} />
                    <IconButton icon="close" label="Decline" onPress={() => run(() => removeFriendship(friendship.id))} />
                  </>
                }
              />
            ))}
          </List>
        </Section>
      ) : null}

      <Section
        title={`Friends · ${data?.friends.length ?? 0}`}
        action={
          <Pressable onPress={() => router.push('/circles')} hitSlop={8}>
            <T variant="caption" color={Colors.text} style={{ fontWeight: '600' }}>
              Circles
            </T>
          </Pressable>
        }>
        {data && data.friends.length === 0 ? (
          <Empty
            icon="addPerson"
            title="No friends yet"
            body="Search above or share your invite."
            action={<Button title="Invite friends" icon="share" size="sm" variant="white" onPress={invite} />}
          />
        ) : (
          <List>
            {(data?.friends ?? []).map((p) => (
              <ListRow
                key={p.id}
                title={displayName(p)}
                subtitle={`@${p.username}`}
                left={avatar(p)}
                chevron={false}
                right={
                  <Pressable
                    hitSlop={8}
                    onPress={async () => {
                      const f = data?.friendshipByUser[p.id];
                      if (f && (await confirm('Remove friend?', `${displayName(p)} won't see your free time anymore.`, 'Remove'))) {
                        run(() => removeFriendship(f.id));
                      }
                    }}>
                    <T variant="caption" color={Colors.textTertiary}>
                      Remove
                    </T>
                  </Pressable>
                }
              />
            ))}
          </List>
        )}
      </Section>

      {data && data.outgoing.length > 0 ? (
        <Section title="Pending">
          <List>
            {data.outgoing.map(({ friendship, profile }) => (
              <ListRow
                key={friendship.id}
                title={displayName(profile)}
                subtitle={`@${profile.username}`}
                left={avatar(profile)}
                chevron={false}
                right={
                  <Pressable hitSlop={8} onPress={() => run(() => removeFriendship(friendship.id))}>
                    <T variant="caption" color={Colors.textTertiary}>
                      Cancel
                    </T>
                  </Pressable>
                }
              />
            ))}
          </List>
        </Section>
      ) : null}
    </Screen>
  );
}
