import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Avatar, AvatarStack, Button, Input, List, ListRow, Loading, Screen, Section, T, displayName } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { confirm, errorMessage, notify } from '@/lib/alert';
import { createCircle, deleteCircle, getFriends, getMyCircles } from '@/lib/api';

export default function Circles() {
  const [name, setName] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const { data, loading, reload } = useData(async () => {
    const [friends, circles] = await Promise.all([getFriends(), getMyCircles()]);
    return { friends: friends.friends, circles, byId: Object.fromEntries(friends.friends.map((f) => [f.id, f])) };
  });

  if (loading && !data) return <Loading />;

  const create = async () => {
    if (!name.trim()) return notify('Name your circle');
    setSaving(true);
    try {
      await createCircle(name.trim(), '•', members);
      setName('');
      setMembers([]);
      await reload();
    } catch (e) {
      notify('Something went wrong', errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <T variant="caption">
        Share pings and hangouts with smaller groups, like close friends or your climbing crew. Only you can see your circles.
      </T>

      {data && data.circles.length > 0 ? (
        <Section title="Your circles">
          <List>
            {data.circles.map((c) => (
              <ListRow
                key={c.id}
                title={c.name}
                subtitle={`${c.memberIds.length} member${c.memberIds.length === 1 ? '' : 's'}`}
                chevron={false}
                right={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
                    <AvatarStack profiles={c.memberIds.map((id) => data.byId[id])} size={24} max={4} />
                    <Pressable
                      hitSlop={8}
                      onPress={async () => {
                        if (await confirm('Delete circle?', c.name, 'Delete')) {
                          await deleteCircle(c.id);
                          reload();
                        }
                      }}>
                      <Icon name="trash" size={16} color={Colors.textTertiary} />
                    </Pressable>
                  </View>
                }
              />
            ))}
          </List>
        </Section>
      ) : null}

      <Section title="New circle">
        <Input value={name} onChangeText={setName} placeholder="Circle name" maxLength={40} />
        {data && data.friends.length > 0 ? (
          <List>
            {data.friends.map((f) => {
              const on = members.includes(f.id);
              return (
                <ListRow
                  key={f.id}
                  title={displayName(f)}
                  left={<Avatar profile={f} size={32} />}
                  chevron={false}
                  onPress={() => setMembers((m) => (on ? m.filter((x) => x !== f.id) : [...m, f.id]))}
                  right={
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: on ? Colors.accent : 'transparent',
                        borderWidth: on ? 0 : 1.5,
                        borderColor: Colors.textTertiary,
                      }}>
                      {on ? <Icon name="check" size={14} color={Colors.onAccent} /> : null}
                    </View>
                  }
                />
              );
            })}
          </List>
        ) : (
          <T variant="caption">Add friends first.</T>
        )}
        <Button title="Create circle" variant="white" onPress={create} loading={saving} />
      </Section>
    </Screen>
  );
}
