import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Avatar, AvatarStack, Button, Card, Chip, Input, Loading, Row, Screen, Section, T, displayName } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { confirm, errorMessage, notify } from '@/lib/alert';
import { createCircle, deleteCircle, getFriends, getMyCircles } from '@/lib/api';

const EMOJIS = ['✨', '💖', '🏀', '🎮', '🍻', '🏢', '🎓', '🏡'];

export default function Circles() {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('✨');
  const [members, setMembers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const { data, loading, reload } = useData(async () => {
    const [friends, circles] = await Promise.all([getFriends(), getMyCircles()]);
    return { friends: friends.friends, circles, byId: Object.fromEntries(friends.friends.map((f) => [f.id, f])) };
  });

  if (loading && !data) return <Loading />;

  const create = async () => {
    if (!name.trim()) return notify('Name your circle ✍️');
    setSaving(true);
    try {
      await createCircle(name.trim(), emoji, members);
      setName('');
      setMembers([]);
      await reload();
    } catch (e) {
      notify('Oops', errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <T variant="caption">
        Circles let you choose who sees a ping or hangout — like “Close friends” or “Climbing crew”. Only you can see your
        circles.
      </T>

      {data?.circles.map((c) => (
        <Card key={c.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="heading">
              {c.emoji} {c.name}
            </T>
            <Button
              title="Delete"
              size="sm"
              variant="danger"
              onPress={async () => {
                if (await confirm('Delete circle?', c.name, 'Delete')) {
                  await deleteCircle(c.id);
                  reload();
                }
              }}
            />
          </Row>
          <AvatarStack profiles={c.memberIds.map((id) => data.byId[id])} max={8} />
        </Card>
      ))}

      <Section title="New circle">
        <Card style={{ gap: Spacing.md }}>
          <Input value={name} onChangeText={setName} placeholder="Close friends" maxLength={40} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {EMOJIS.map((e) => (
              <Chip key={e} label={e} selected={e === emoji} onPress={() => setEmoji(e)} />
            ))}
          </View>
          {data?.friends.map((f) => {
            const on = members.includes(f.id);
            return (
              <Pressable key={f.id} onPress={() => setMembers((m) => (on ? m.filter((x) => x !== f.id) : [...m, f.id]))}>
                <Row gap={Spacing.md}>
                  <Avatar profile={f} size={34} />
                  <T variant="label" style={{ flex: 1 }}>
                    {displayName(f)}
                  </T>
                  <Text style={{ fontSize: 20 }}>{on ? '✅' : '⬜️'}</Text>
                </Row>
              </Pressable>
            );
          })}
          {data?.friends.length === 0 ? <T variant="caption">Add some friends first.</T> : null}
          <Button title="Create circle" onPress={create} loading={saving} />
        </Card>
      </Section>
    </Screen>
  );
}
