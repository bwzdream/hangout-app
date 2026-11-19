/**
 * Meet people nearby.
 *   Not public yet → a visual explainer and a "Go public" button.
 *   Public → your public time (2 h/day free), requests for you, and people near you who
 *   are free — with the ones free at the same time as you first.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Icon, type IconName } from '@/components/icon';
import { NearbyIllustration } from '@/components/nearby-card';
import { PopButton } from '@/components/playful';
import { Avatar, Button, Chip, Loading, Row, Screen, T, displayName } from '@/components/ui';
import { WhenPicker } from '@/components/when-picker';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useData } from '@/hooks/use-data';
import { confirm, errorMessage, notify } from '@/lib/alert';
import {
  FREE_PUBLIC_MINUTES,
  PublicLimitError,
  addPublicSlot,
  answerRequest,
  blockUser,
  deletePublicSlot,
  getHangoutRequests,
  getMyPublicSlots,
  getPublicStatus,
  minutesLabel,
  nearbySlots,
  sendHangoutRequest,
  setRadius,
  stopPublic,
  GENDERS,
  LOOKING_FOR,
  SEXUALITIES,
  labelOf,
  type NearbySlot,
} from '@/lib/public';
import { DAY_MS, formatDay, formatTime } from '@/lib/time';
import type { Profile } from '@/lib/types';
import { PRESETS, type TimeRange } from '@/lib/when';

const span = (a: string | number, b: string | number) => `${formatTime(a)} – ${formatTime(b)}`;
const RADII = [2, 5, 10, 25];

const asProfile = (s: { user_id: string; username: string; display_name: string; avatar_emoji: string }): Profile => ({
  id: s.user_id,
  username: s.username,
  display_name: s.display_name,
  avatar_emoji: s.avatar_emoji,
  bio: '',
  timezone: '',
});

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <Row gap={Spacing.lg} style={{ alignItems: 'flex-start' }}>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' }}>
        <T variant="label" color={Colors.onAccent} style={{ fontWeight: '800' }}>
          {n}
        </T>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="heading">{title}</T>
        <T variant="body" color={Colors.textSecondary}>
          {body}
        </T>
      </View>
    </Row>
  );
}

function Intro() {
  return (
    <Screen edges={['bottom']}>
      <View style={{ alignItems: 'center' }}>
        <NearbyIllustration size={240} />
      </View>
      <View style={{ gap: Spacing.sm }}>
        <T variant="largeTitle">Meet people nearby</T>
        <T variant="body" color={Colors.textSecondary}>
          Not just friends: people around you who also want to hang out.
        </T>
      </View>
      <View style={{ gap: Spacing.xl }}>
        <Step n={1} title="Tell us about you" body="Your age, what you're into, and what you're looking for: friends, an activity buddy, dating or networking." />
        <Step n={2} title="Share a bit of free time" body="Pick when you're free. Free accounts can share up to 2 hours a day." />
        <Step n={3} title="Meet people who fit" body="See people nearby who fit what you want (and you fit theirs), free at the same time. Ask to hang out; nothing happens unless you both say yes." />
      </View>
      <View style={{ backgroundColor: Colors.surface, borderRadius: 20, padding: 16, gap: 6 }}>
        <Row gap={8}>
          <Icon name="lock" size={14} color={Colors.textSecondary} />
          <T variant="label">Your privacy</T>
        </Row>
        <T variant="caption">
          Others see your first name, age, interests, what you’re looking for, a rough distance (like “about 3 km”) and the times you share. Your exact location and birthday are never shown. You can block anyone, and stop being public anytime.
        </T>
      </View>
      <PopButton onPress={() => router.push({ pathname: '/public-profile', params: { setup: '1' } })}>
        <Row style={{ padding: 18, justifyContent: 'center' }} gap={10}>
          <Icon name="pin" size={20} color={Colors.onAccent} />
          <T variant="button" color={Colors.onAccent}>
            Set up my public profile
          </T>
        </Row>
      </PopButton>
      <T variant="caption" style={{ textAlign: 'center' }}>
        We’ll ask to use your location to find people near you.
      </T>
    </Screen>
  );
}

function UsageBar({ used, limit }: { used: number; limit: number | null }) {
  if (limit === null) {
    return (
      <T variant="body" color={Colors.textSecondary}>
        Unlimited public time with Plus.
      </T>
    );
  }
  const left = Math.max(0, limit - used);
  return (
    <View style={{ gap: 8 }}>
      <View style={{ height: 10, borderRadius: 5, backgroundColor: Colors.surfaceRaised, overflow: 'hidden' }}>
        <View style={{ width: `${Math.min(100, (used / limit) * 100)}%`, height: 10, borderRadius: 5, backgroundColor: Colors.text }} />
      </View>
      <Row style={{ justifyContent: 'space-between' }}>
        <T variant="body">{left > 0 ? `${minutesLabel(left)} left today` : 'You’ve used today’s 2 hours'}</T>
        <Pressable onPress={() => router.push('/plus')} hitSlop={8}>
          <T variant="label" style={{ textDecorationLine: 'underline' }}>
            Get more
          </T>
        </Pressable>
      </Row>
    </View>
  );
}

/** Small rounded label, optionally highlighted. */
function Pill({ label, strong, onMint }: { label: string; strong?: boolean; onMint?: boolean }) {
  return (
    <View
      style={{
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        backgroundColor: strong ? Colors.text : onMint ? 'rgba(20,20,20,0.08)' : Colors.surfaceRaised,
      }}>
      <T variant="caption" color={strong ? Colors.background : Colors.text} style={{ fontWeight: strong ? '700' : '500' }}>
        {label}
      </T>
    </View>
  );
}

/** An icon + content row; keeps every piece of info lined up and scannable. */
function InfoRow({ icon, color, children }: { icon: IconName; color: string; children: React.ReactNode }) {
  return (
    <Row gap={12} style={{ alignItems: 'flex-start' }}>
      <View style={{ width: 22, alignItems: 'center', paddingTop: 2 }}>
        <Icon name={icon} size={16} color={color} />
      </View>
      <View style={{ flex: 1, gap: 6 }}>{children}</View>
    </Row>
  );
}

/** One person nearby: header, then icon rows. Extra details behind "More about…". */
function PersonCard({ s, onRequest, onBlock }: { s: NearbySlot; onRequest: () => void; onBlock: () => void }) {
  const [open, setOpen] = useState(false);
  const mint = s.overlaps_mine;
  const ink = mint ? Colors.onAccent : Colors.text;
  const soft = mint ? Colors.onAccent : Colors.textSecondary;
  const name = (s.display_name || s.username).split(' ')[0];
  const requested = s.my_request === 'pending' || s.my_request === 'accepted';
  const identity = [labelOf(GENDERS, s.gender), labelOf(SEXUALITIES, s.sexuality)].filter(Boolean).join(' · ');
  const others = s.interests.filter((i) => !s.shared_interests.includes(i));

  return (
    <View style={{ backgroundColor: mint ? Colors.accent : Colors.surface, borderRadius: 28, padding: 18, gap: 14 }}>
      {/* Header */}
      <Row gap={Spacing.md}>
        <Avatar profile={asProfile(s)} size={48} />
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="heading" color={ink} style={{ fontSize: 20 }}>
            {name}
            {s.age ? `, ${s.age}` : ''}
          </T>
          {mint ? (
            <Row gap={4}>
              <Icon name="check" size={12} color={Colors.onAccent} />
              <T variant="caption" color={Colors.onAccent} style={{ fontWeight: '700' }}>
                Free when you are
              </T>
            </Row>
          ) : null}
        </View>
        <Row gap={4} style={{ backgroundColor: mint ? 'rgba(20,20,20,0.08)' : Colors.surfaceRaised, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
          <Icon name="nearMe" size={12} color={ink} />
          <T variant="caption" color={ink} style={{ fontWeight: '700' }}>
            {s.distance_km <= 1 ? '< 1 km' : `${s.distance_km} km`}
          </T>
        </Row>
      </Row>

      <View style={{ height: 1, backgroundColor: mint ? 'rgba(20,20,20,0.1)' : Colors.hairline }} />

      {/* Key info */}
      <InfoRow icon="clock" color={ink}>
        <T variant="heading" color={ink}>
          {formatDay(s.starts_at)}, {span(s.starts_at, s.ends_at)}
        </T>
      </InfoRow>
      {s.note ? (
        <InfoRow icon="quote" color={ink}>
          <T variant="body" color={ink}>
            {s.note}
          </T>
        </InfoRow>
      ) : null}
      {s.shared_interests.length ? (
        <InfoRow icon="sparkle" color={ink}>
          <T variant="caption" color={soft}>
            You both like
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {s.shared_interests.map((i) => (
              <Pill key={i} label={i} strong />
            ))}
          </View>
        </InfoRow>
      ) : null}

      {/* Details */}
      {open ? (
        <Animated.View entering={FadeIn.duration(180)} style={{ gap: 14 }}>
          <View style={{ height: 1, backgroundColor: mint ? 'rgba(20,20,20,0.1)' : Colors.hairline }} />
          {identity ? (
            <InfoRow icon="personSmall" color={ink}>
              <T variant="body" color={ink}>
                {identity}
              </T>
            </InfoRow>
          ) : null}
          {s.looking_for.length ? (
            <InfoRow icon="target" color={ink}>
              <T variant="caption" color={soft}>
                Looking for
              </T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {s.looking_for.map((k) => (
                  <Pill key={k} label={labelOf(LOOKING_FOR, k)} onMint={mint} />
                ))}
              </View>
            </InfoRow>
          ) : null}
          {others.length ? (
            <InfoRow icon="tag" color={ink}>
              <T variant="caption" color={soft}>
                Also into
              </T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {others.map((i) => (
                  <Pill key={i} label={i} onMint={mint} />
                ))}
              </View>
            </InfoRow>
          ) : null}
          <Pressable onPress={onBlock} hitSlop={8}>
            <Row gap={8}>
              <Icon name="block" size={14} color={soft} />
              <T variant="label" color={soft}>
                Block {name}
              </T>
            </Row>
          </Pressable>
        </Animated.View>
      ) : null}

      {/* Actions */}
      <Row style={{ justifyContent: 'space-between', marginTop: 2 }}>
        {requested ? (
          <Row gap={6}>
            <Icon name="check" size={14} color={soft} />
            <T variant="label" color={soft}>
              {s.my_request === 'accepted' ? 'They said yes!' : 'Request sent'}
            </T>
          </Row>
        ) : s.my_request === 'declined' ? (
          <T variant="label" color={soft}>
            Not this time
          </T>
        ) : (
          <Button title="Ask to hang out" icon="hand" onPress={onRequest} />
        )}
        <Pressable onPress={() => setOpen((v) => !v)} hitSlop={10}>
          <Row gap={4}>
            <T variant="label" color={soft}>
              {open ? 'Less' : 'More'}
            </T>
            <Icon name={open ? 'close' : 'chevron'} size={12} color={soft} />
          </Row>
        </Pressable>
      </Row>
    </View>
  );
}

export default function PublicScreen() {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<TimeRange>(() => (PRESETS[1].range() ?? PRESETS[2].range())!);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const { data, loading, reload, refresh, refreshing } = useData(async () => {
    const status = await getPublicStatus();
    if (!status.enabled) return { status, mine: [], nearby: [], requests: { incoming: [], outgoing: [] } };
    const [mine, nearby, requests] = await Promise.all([
      getMyPublicSlots(),
      nearbySlots(Date.now(), Date.now() + 7 * DAY_MS),
      getHangoutRequests(),
    ]);
    return { status, mine, nearby, requests };
  });

  if (loading && !data) return <Loading />;
  if (!data?.status.enabled) return <Intro />;

  const { status, mine, nearby, requests } = data;
  const incoming = requests.incoming.filter((r) => r.status === 'pending');
  const answered = [...requests.incoming, ...requests.outgoing].filter((r) => r.status === 'accepted');
  const draftMinutes = Math.round((draft.end - draft.start) / 60000);

  const share = async () => {
    setSaving(true);
    try {
      await addPublicSlot(draft.start, draft.end, note);
      setAdding(false);
      setNote('');
      await reload();
    } catch (e) {
      if (e instanceof PublicLimitError) {
        notify('That’s more than 2 hours', `${minutesLabel(e.minutesLeft)} of public time left that day. Pick a shorter time, or get Plus for unlimited.`);
      } else notify('Couldn’t share', errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await reload();
    } catch (e) {
      notify('Something went wrong', errorMessage(e));
    }
  };

  return (
    <Screen edges={['bottom']} center={false} refreshing={refreshing} onRefresh={refresh}>
      {/* Your public time */}
      <View style={{ gap: Spacing.lg }}>
        <T variant="largeTitle">Your public time</T>
        <UsageBar used={status.usedMinutes} limit={status.limitMinutes} />
        {mine.map((s) => (
          <Row key={s.id} style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <T variant="heading">
                {formatDay(s.starts_at)}, {span(s.starts_at, s.ends_at)}
              </T>
              {s.note ? (
                <T variant="body" color={Colors.textSecondary}>
                  “{s.note}”
                </T>
              ) : null}
            </View>
            <Pressable hitSlop={10} accessibilityLabel="Remove" onPress={() => run(() => deletePublicSlot(s.id))}>
              <Icon name="close" size={18} color={Colors.textTertiary} />
            </Pressable>
          </Row>
        ))}
        {adding ? (
          <Animated.View entering={FadeInDown.duration(220)} style={{ gap: Spacing.lg }}>
            <WhenPicker value={draft} onChange={setDraft} />
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="What are you up for? (optional)"
              placeholderTextColor={Colors.textTertiary}
              maxLength={100}
              style={{ fontFamily: Fonts.body, fontSize: 17, color: Colors.text, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.outline }}
            />
            {status.limitMinutes !== null && draftMinutes > FREE_PUBLIC_MINUTES ? (
              <T variant="body" color={Colors.danger}>
                That’s {minutesLabel(draftMinutes)}. Free accounts can share up to 2 hours a day.
              </T>
            ) : null}
            <Row gap={Spacing.md}>
              <Button title={saving ? 'Sharing…' : 'Share publicly'} onPress={share} loading={saving} />
              <Button title="Cancel" variant="ghost" onPress={() => setAdding(false)} />
            </Row>
          </Animated.View>
        ) : (
          <Button title="Share public time" icon="plus" variant="secondary" size="lg" onPress={() => setAdding(true)} />
        )}
      </View>

      {/* Requests for you */}
      {incoming.length > 0 ? (
        <Animated.View entering={FadeIn} style={{ gap: Spacing.lg }}>
          <T variant="title">{incoming.length === 1 ? 'Someone wants to hang out!' : `${incoming.length} people want to hang out!`}</T>
          {incoming.map((r) => (
            <View key={r.id} style={{ backgroundColor: Colors.accent, borderRadius: 28, padding: 18, gap: 14 }}>
              <Row gap={Spacing.md}>
                <Avatar profile={r.other} size={48} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T variant="heading" color={Colors.onAccent} style={{ fontSize: 20 }}>
                    {displayName(r.other).split(' ')[0]}
                  </T>
                  <Row gap={4}>
                    <Icon name="hand" size={12} color={Colors.onAccent} />
                    <T variant="caption" color={Colors.onAccent} style={{ fontWeight: '700' }}>
                      Wants to hang out
                    </T>
                  </Row>
                </View>
              </Row>
              <View style={{ height: 1, backgroundColor: 'rgba(20,20,20,0.1)' }} />
              {r.slot ? (
                <InfoRow icon="clock" color={Colors.onAccent}>
                  <T variant="heading" color={Colors.onAccent}>
                    {formatDay(r.slot.starts_at)}, {span(r.slot.starts_at, r.slot.ends_at)}
                  </T>
                </InfoRow>
              ) : null}
              {r.message ? (
                <InfoRow icon="quote" color={Colors.onAccent}>
                  <T variant="body" color={Colors.onAccent}>
                    {r.message}
                  </T>
                </InfoRow>
              ) : null}
              <Row gap={Spacing.md} style={{ marginTop: 2 }}>
                <Button title="Say yes" icon="check" variant="white" onPress={() => run(() => answerRequest(r.id, 'accepted'))} />
                <Button title="No thanks" variant="ghost" onPress={() => run(() => answerRequest(r.id, 'declined'))} />
              </Row>
            </View>
          ))}
        </Animated.View>
      ) : null}

      {/* It's a match */}
      {answered.length > 0 ? (
        <View style={{ gap: Spacing.md }}>
          <T variant="title">You’re meeting up</T>
          {answered.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => r.activity_id && router.push({ pathname: '/activity/[id]', params: { id: r.activity_id } })}>
              <Row gap={Spacing.md}>
                <Avatar profile={r.other} size={40} />
                <T variant="body" style={{ flex: 1 }}>
                  {displayName(r.other).split(' ')[0]} · {r.slot ? `${formatDay(r.slot.starts_at)}, ${span(r.slot.starts_at, r.slot.ends_at)}` : ''}
                </T>
                <Icon name="chevron" size={14} color={Colors.textTertiary} />
              </Row>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* People near you */}
      <View style={{ gap: Spacing.lg }}>
        <View style={{ gap: 4 }}>
          <T variant="title">Free near you</T>
          <T variant="body" color={Colors.textSecondary}>
            People within {status.radiusKm} km who fit what you’re looking for.
          </T>
        </View>
        {nearby.length === 0 ? (
          <T variant="body" color={Colors.textSecondary}>
            No one nearby has shared public time yet. Share yours, and we’ll show people here as they join.
          </T>
        ) : (
          nearby.map((s, i) => (
            <Animated.View key={s.slot_id} entering={FadeInDown.delay(i * 60).springify()}>
              <PersonCard
                s={s}
                onRequest={() => run(() => sendHangoutRequest(s.slot_id))}
                onBlock={async () => {
                  if (await confirm(`Block ${s.display_name.split(' ')[0] || 'this person'}?`, 'You won’t see each other here anymore.', 'Block')) {
                    run(() => blockUser(s.user_id));
                  }
                }}
              />
            </Animated.View>
          ))
        )}
      </View>

      {/* Settings */}
      <View style={{ gap: Spacing.md }}>
        <Pressable onPress={() => router.push('/public-profile')} hitSlop={8}>
          <Row gap={8}>
            <Icon name="edit" size={16} />
            <T variant="label" style={{ textDecorationLine: 'underline' }}>
              Edit my public profile and who I’d like to meet
            </T>
          </Row>
        </Pressable>
        <T variant="label" style={{ marginTop: Spacing.sm }}>
          How far to look
        </T>
        <Row gap={8}>
          {RADII.map((r) => (
            <Chip key={r} label={`${r} km`} selected={status.radiusKm === r} onPress={() => run(() => setRadius(r))} />
          ))}
        </Row>
        <Pressable
          hitSlop={8}
          onPress={async () => {
            if (await confirm('Stop being public?', 'Your public times will be removed and people nearby won’t see you.', 'Stop')) {
              run(stopPublic);
            }
          }}>
          <T variant="label" color={Colors.danger} style={{ textDecorationLine: 'underline' }}>
            Stop being public
          </T>
        </Pressable>
      </View>
    </Screen>
  );
}
