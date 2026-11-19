/**
 * Public profile for "Meet people nearby": about you + who you'd like to meet.
 * Opened from the intro (setup=1, which also turns public mode on) or from settings.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Switch, TextInput, View } from 'react-native';

import { PopButton } from '@/components/playful';
import { Chip, Loading, Row, Screen, T } from '@/components/ui';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { errorMessage, notify } from '@/lib/alert';
import {
  EMPTY_PUBLIC_PROFILE,
  GENDERS,
  INTERESTS,
  LOOKING_FOR,
  SEXUALITIES,
  ageFrom,
  getPublicProfile,
  savePublicProfile,
  type PublicProfile,
} from '@/lib/public';

const toggle = (list: string[], key: string, max = 99) =>
  list.includes(key) ? list.filter((k) => k !== key) : list.length >= max ? list : [...list, key];

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: Spacing.md }}>
      <View style={{ gap: 2 }}>
        <T variant="title" style={{ fontSize: 24, lineHeight: 28 }}>
          {title}
        </T>
        {hint ? (
          <T variant="body" color={Colors.textSecondary}>
            {hint}
          </T>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const Chips = ({ children }: { children: React.ReactNode }) => (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{children}</View>
);

function Stepper({ label, value, onChange, min, max }: { label: string; value: number; onChange: (n: number) => void; min: number; max: number }) {
  const btn = { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceRaised, alignItems: 'center' as const, justifyContent: 'center' as const };
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <T variant="body" color={Colors.textSecondary}>
        {label}
      </T>
      <Row gap={14}>
        <Pressable accessibilityLabel={`Lower ${label}`} onPress={() => onChange(Math.max(min, value - 1))} style={btn}>
          <T variant="heading">−</T>
        </Pressable>
        <T variant="heading" style={{ minWidth: 44, textAlign: 'center', fontSize: 22 }}>
          {value >= 99 ? '99+' : value}
        </T>
        <Pressable accessibilityLabel={`Raise ${label}`} onPress={() => onChange(Math.min(max, value + 1))} style={btn}>
          <T variant="heading">+</T>
        </Pressable>
      </Row>
    </Row>
  );
}

export default function PublicProfileScreen() {
  const { setup } = useLocalSearchParams<{ setup?: string }>();
  const isSetup = setup === '1';
  const [p, setP] = useState<PublicProfile | null>(null);
  const [birth, setBirth] = useState({ m: '', d: '', y: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getPublicProfile()
      .then((prof) => {
        setP(prof);
        if (prof.birthdate) {
          const [y, m, d] = prof.birthdate.split('-');
          setBirth({ y, m: String(+m), d: String(+d) });
        }
      })
      .catch(() => setP(EMPTY_PUBLIC_PROFILE));
  }, []);

  if (!p) return <Loading />;
  const set = (patch: Partial<PublicProfile>) => setP({ ...p, ...patch });

  const birthdate =
    birth.y.length === 4 && +birth.m >= 1 && +birth.m <= 12 && +birth.d >= 1 && +birth.d <= 31
      ? `${birth.y}-${birth.m.padStart(2, '0')}-${birth.d.padStart(2, '0')}`
      : null;
  const age = ageFrom(birthdate);

  const save = async () => {
    if (!birthdate || age === null) return notify('Your birthday', 'Please enter your birthday (month, day and year).');
    if (age < 18) return notify('Sorry', 'You need to be 18 or older to meet people nearby.');
    if (!p.gender) return notify('One more thing', 'Please choose how you describe your gender.');
    if (p.looking_for.length === 0) return notify('One more thing', 'Pick at least one thing you’re looking for.');
    setSaving(true);
    try {
      await savePublicProfile({ ...p, birthdate }, isSetup);
      router.back();
    } catch (e) {
      notify('Couldn’t save', errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const birthInput = (key: 'm' | 'd' | 'y', placeholder: string, width: number, max: number) => (
    <TextInput
      value={birth[key]}
      onChangeText={(t) => setBirth({ ...birth, [key]: t.replace(/\D/g, '').slice(0, max) })}
      placeholder={placeholder}
      placeholderTextColor={Colors.textTertiary}
      keyboardType="number-pad"
      maxLength={max}
      accessibilityLabel={placeholder}
      style={{
        width,
        fontFamily: Fonts.body,
        fontSize: 22,
        textAlign: 'center',
        color: Colors.text,
        paddingVertical: 12,
        borderRadius: 14,
        backgroundColor: Colors.surface,
      }}
    />
  );

  return (
    <Screen edges={['bottom']} center={false}>
      {isSetup ? (
        <View style={{ gap: Spacing.sm }}>
          <T variant="largeTitle">Your public profile</T>
          <T variant="body" color={Colors.textSecondary}>
            This helps us show you people you’d actually want to meet, and shows you to people who’d want to meet you.
          </T>
        </View>
      ) : null}

      <Group title="Your birthday" hint="People see your age, not your birthday. You must be 18+.">
        <Row gap={10}>
          {birthInput('m', 'MM', 70, 2)}
          {birthInput('d', 'DD', 70, 2)}
          {birthInput('y', 'YYYY', 100, 4)}
          {age !== null ? (
            <T variant="heading" color={age >= 18 ? Colors.text : Colors.danger}>
              {age >= 18 ? `${age} years old` : 'Under 18'}
            </T>
          ) : null}
        </Row>
      </Group>

      <Group title="I am a…">
        <Chips>
          {GENDERS.map((g) => (
            <Chip key={g.key} label={g.label} selected={p.gender === g.key} onPress={() => set({ gender: g.key })} />
          ))}
        </Chips>
      </Group>

      <Group title="Sexuality" hint="Optional. Only shown on your profile if you turn it on.">
        <Chips>
          {SEXUALITIES.map((x) => (
            <Chip
              key={x.key}
              label={x.label}
              selected={p.sexuality === x.key}
              onPress={() => set({ sexuality: p.sexuality === x.key ? null : x.key })}
            />
          ))}
        </Chips>
        {p.sexuality ? (
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="body">Show on my profile</T>
            <Switch
              value={p.show_sexuality}
              onValueChange={(v) => set({ show_sexuality: v })}
              trackColor={{ false: Colors.surfaceRaised, true: Colors.accent }}
              thumbColor={Colors.white}
              {...({ activeThumbColor: Colors.white } as object)}
            />
          </Row>
        ) : null}
      </Group>

      <Group title="I’m looking for" hint="Pick all that fit. You’ll only match with people looking for something you are.">
        <Chips>
          {LOOKING_FOR.map((x) => (
            <Chip key={x.key} label={x.label} selected={p.looking_for.includes(x.key)} onPress={() => set({ looking_for: toggle(p.looking_for, x.key) })} />
          ))}
        </Chips>
      </Group>

      <Group title="Interests" hint={`Pick up to 12. People who share them show up first. (${p.interests.length}/12)`}>
        <Chips>
          {INTERESTS.map((x) => (
            <Chip key={x} label={x} selected={p.interests.includes(x)} onPress={() => set({ interests: toggle(p.interests, x, 12) })} />
          ))}
        </Chips>
      </Group>

      <View style={{ height: 1, backgroundColor: Colors.hairline }} />

      <Group title="Who you’d like to meet" hint="You’ll only see people who fit this, and who you fit too.">
        <Stepper label="Youngest" value={p.pref_age_min} min={18} max={p.pref_age_max} onChange={(n) => set({ pref_age_min: n })} />
        <Stepper label="Oldest" value={p.pref_age_max} min={p.pref_age_min} max={99} onChange={(n) => set({ pref_age_max: n })} />
        <T variant="label" style={{ marginTop: Spacing.sm }}>
          Show me
        </T>
        <Chips>
          <Chip label="Everyone" selected={p.pref_genders.length === 0} onPress={() => set({ pref_genders: [] })} />
          {GENDERS.map((g) => (
            <Chip
              key={g.key}
              label={g.label}
              selected={p.pref_genders.includes(g.key)}
              onPress={() => set({ pref_genders: toggle(p.pref_genders, g.key) })}
            />
          ))}
        </Chips>
      </Group>

      <PopButton onPress={save} disabled={saving}>
        <T variant="button" color={Colors.onAccent} style={{ textAlign: 'center', padding: 18 }}>
          {saving ? 'Saving…' : isSetup ? 'Save and go public' : 'Save'}
        </T>
      </PopButton>
    </Screen>
  );
}
