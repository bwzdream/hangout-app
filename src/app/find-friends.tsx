/**
 * Find friends from your contacts:
 *   1) ask for contacts access (plain explanation first)
 *   2) "Already on Pingle" — add them
 *   3) "Invite to Pingle" — opens your own Messages app with the invite written
 * Only scrambled (hashed) numbers/emails leave the phone.
 */
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { Avatar, Button, Input, Row, Screen, T } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { errorMessage, notify } from '@/lib/alert';
import { getFriends, sendFriendRequest, type FriendsState } from '@/lib/api';
import {
  canReadContacts,
  contactsPermission,
  hasMyPhone,
  inviteByText,
  matchContacts,
  readContacts,
  requestContacts,
  setMyPhone,
  type ContactMatch,
  type PhoneContact,
} from '@/lib/contacts';
import type { Profile } from '@/lib/types';
import { useAuth } from '@/providers/auth';

type Phase = 'intro' | 'loading' | 'ready' | 'denied';

const asProfile = (id: string, name: string, username = ''): Profile => ({
  id,
  username,
  display_name: name,
  avatar_emoji: '',
  bio: '',
  timezone: '',
});

/** Ask people to add their own number so friends can find them. */
function MyNumber({ userId }: { userId: string }) {
  const [has, setHas] = useState<boolean | null>(null);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    hasMyPhone(userId).then(setHas).catch(() => setHas(false));
  }, [userId]);
  if (has === null) return null;
  if (has) {
    return (
      <Row gap={8}>
        <Icon name="check" size={16} color={Colors.accentInk} />
        <T variant="body" color={Colors.textSecondary}>
          Friends who have your number can find you.
        </T>
      </Row>
    );
  }
  return (
    <View style={{ backgroundColor: Colors.surface, borderRadius: 24, padding: 18, gap: Spacing.md }}>
      <T variant="heading">Help friends find you</T>
      <T variant="body" color={Colors.textSecondary}>
        Add your phone number so friends who have it in their contacts can find you. We only keep a scrambled copy.
      </T>
      <Input value={value} onChangeText={setValue} placeholder="Your phone number" keyboardType="phone-pad" autoComplete="tel" />
      <Button
        title="Save my number"
        loading={saving}
        disabled={value.replace(/\D/g, '').length < 8}
        onPress={async () => {
          setSaving(true);
          try {
            await setMyPhone(userId, value);
            setHas(true);
          } catch (e) {
            notify('Hmm', errorMessage(e));
          } finally {
            setSaving(false);
          }
        }}
        style={{ alignSelf: 'flex-start' }}
      />
    </View>
  );
}

export default function FindFriends() {
  const { session, profile } = useAuth();
  const meId = session?.user.id ?? '';
  const [phase, setPhase] = useState<Phase>('intro');
  const [contacts, setContacts] = useState<PhoneContact[]>([]);
  const [matches, setMatches] = useState<ContactMatch[]>([]);
  const [friends, setFriends] = useState<FriendsState | null>(null);
  const [query, setQuery] = useState('');
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState(60);

  const load = async () => {
    setPhase('loading');
    try {
      const all = await readContacts();
      const [found, f] = await Promise.all([matchContacts(all), getFriends()]);
      setContacts(all);
      setMatches(found);
      setFriends(f);
      setPhase('ready');
    } catch (e) {
      notify("Couldn't read contacts", errorMessage(e));
      setPhase('intro');
    }
  };

  // If access was already given before, go straight to the results.
  useEffect(() => {
    contactsPermission()
      .then((p) => {
        if (p === 'granted') load();
        else if (p === 'denied' && canReadContacts) setPhase('denied');
      })
      .catch(() => {});
  }, []);

  const allow = async () => {
    if (await requestContacts()) load();
    else setPhase('denied');
  };

  const status = (userId: string) => {
    const f = friends?.friendshipByUser[userId];
    if (!f) return 'none' as const;
    if (f.status === 'accepted') return 'friends' as const;
    return f.requester_id === meId ? ('requested' as const) : ('incoming' as const);
  };

  const add = async (ids: string[]) => {
    try {
      for (const id of ids) if (status(id) === 'none') await sendFriendRequest(id);
      setFriends(await getFriends());
    } catch (e) {
      notify('Something went wrong', errorMessage(e));
    }
  };

  const matchedIds = useMemo(() => new Set(matches.map((m) => m.id)), [matches]);
  const invitable = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts.filter((c) => !matchedIds.has(c.id) && c.phones.length > 0 && (!q || c.name.toLowerCase().includes(q)));
  }, [contacts, matchedIds, query]);
  const toAdd = matches.filter((m) => status(m.user.id) === 'none');

  // ── Web: contacts live on the phone ──
  if (!canReadContacts) {
    return (
      <Screen edges={['bottom']}>
        <View style={{ gap: Spacing.lg }}>
          <T variant="largeTitle">Find your friends</T>
          <T variant="body" color={Colors.textSecondary}>
            Open Pingle on your phone to see which of your contacts are already here. From the web, you can copy an invite to send.
          </T>
        </View>
        {meId ? <MyNumber userId={meId} /> : null}
        <Button
          title="Copy an invite"
          icon="share"
          size="lg"
          onPress={async () => {
            await inviteByText(null, profile?.username);
            notify('Copied', 'Paste it into a text to your friend.');
          }}
        />
      </Screen>
    );
  }

  if (phase === 'intro' || phase === 'denied') {
    return (
      <Screen edges={['bottom']}>
        <View style={{ alignItems: 'center', gap: Spacing.xl }}>
          <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="friends" size={40} color={Colors.onAccent} />
          </View>
          <T variant="largeTitle" style={{ textAlign: 'center' }}>
            See which friends are already here
          </T>
          <T variant="body" color={Colors.textSecondary} style={{ textAlign: 'center', maxWidth: 320 }}>
            {phase === 'denied'
              ? 'Pingle needs permission to look at your contacts. You can turn it on in your phone’s Settings → Pingle → Contacts.'
              : 'We check your contacts against Pingle using scrambled numbers. Your contacts are never uploaded or shared.'}
          </T>
        </View>
        {phase === 'intro' ? <Button title="Look through my contacts" size="lg" onPress={allow} /> : null}
        <Button title="Just text an invite" variant="secondary" size="lg" onPress={() => inviteByText(null, profile?.username)} />
      </Screen>
    );
  }

  if (phase === 'loading') {
    return (
      <Screen edges={['bottom']}>
        <View style={{ alignItems: 'center', gap: Spacing.lg }}>
          <ActivityIndicator color={Colors.text} />
          <T variant="body" color={Colors.textSecondary}>
            Looking for your friends…
          </T>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']} center={false}>
      {/* Already on Pingle */}
      <Animated.View entering={FadeIn.duration(250)} style={{ gap: Spacing.lg }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="title">
            {matches.length ? `${matches.length} friend${matches.length === 1 ? ' is' : 's are'} already here` : 'No contacts on Pingle yet'}
          </T>
        </Row>
        {matches.length === 0 ? (
          <T variant="body" color={Colors.textSecondary}>
            Be the first! Invite a few friends below.
          </T>
        ) : null}
        {matches.map((m, i) => {
          const st = status(m.user.id);
          return (
            <Animated.View key={m.user.id} entering={FadeInDown.delay(i * 60).springify()}>
              <Row gap={Spacing.md}>
                <Avatar profile={asProfile(m.user.id, m.user.display_name || m.name, m.user.username)} size={52} />
                <View style={{ flex: 1 }}>
                  <T variant="heading">{m.name}</T>
                  <T variant="caption">
                    @{m.user.username}
                    {m.user.verified ? '' : ' · added their number'}
                  </T>
                </View>
                {st === 'none' ? (
                  <Button title="Add" size="sm" onPress={() => add([m.user.id])} />
                ) : (
                  <T variant="label" color={Colors.textSecondary}>
                    {st === 'friends' ? 'Friends' : st === 'requested' ? 'Requested' : 'Wants to add you'}
                  </T>
                )}
              </Row>
            </Animated.View>
          );
        })}
        {toAdd.length > 1 ? <Button title={`Add all ${toAdd.length}`} onPress={() => add(toAdd.map((m) => m.user.id))} style={{ alignSelf: 'flex-start' }} /> : null}
      </Animated.View>

      {meId ? <MyNumber userId={meId} /> : null}

      {/* Invite */}
      <View style={{ gap: Spacing.lg }}>
        <View style={{ gap: 2 }}>
          <T variant="title">Invite to Pingle</T>
          <T variant="body" color={Colors.textSecondary}>
            Opens your Messages app with the invite ready to send.
          </T>
        </View>
        <Input value={query} onChangeText={setQuery} placeholder="Search your contacts" />
        {invitable.slice(0, shown).map((c) => (
          <Row key={c.id} gap={Spacing.md}>
            <Avatar profile={asProfile(c.id, c.name)} size={44} />
            <View style={{ flex: 1 }}>
              <T variant="label" numberOfLines={1}>
                {c.name}
              </T>
              <T variant="caption" numberOfLines={1}>
                {c.phones[0]}
              </T>
            </View>
            <Button
              title={invited.has(c.id) ? 'Invited' : 'Invite'}
              size="sm"
              variant={invited.has(c.id) ? 'secondary' : 'primary'}
              onPress={async () => {
                await inviteByText(c.phones[0], profile?.username);
                setInvited((s) => new Set(s).add(c.id));
              }}
            />
          </Row>
        ))}
        {invitable.length > shown ? (
          <Button title={`Show more (${invitable.length - shown})`} variant="secondary" onPress={() => setShown((n) => n + 100)} />
        ) : null}
        {Platform.OS !== 'web' && invitable.length === 0 && query ? (
          <T variant="body" color={Colors.textSecondary}>
            No one called “{query}”.
          </T>
        ) : null}
      </View>
    </Screen>
  );
}
