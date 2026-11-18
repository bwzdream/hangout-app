/**
 * First-run setup, written for people who don't use many apps:
 * one question per screen, big choices, plain words, always a way to skip.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, Share, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { HandLogo } from '@/components/logo';
import { Bouncy, PopButton } from '@/components/playful';
import { Button, Row, Screen, T } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { errorMessage, notify } from '@/lib/alert';
import { addRules } from '@/lib/api';
import { inviteMessage } from '@/lib/invite';
import { WELCOME_KEY } from '@/lib/onboarding';
import { useAuth } from '@/providers/auth';

const ROUTINES = [
  { key: 'weeknights', title: 'Weekday evenings', detail: 'Mon – Thu, 6pm – 10pm', days: [1, 2, 3, 4], start: 18 * 60, end: 22 * 60 },
  { key: 'friday', title: 'Friday nights', detail: 'Fri, 6pm – midnight', days: [5], start: 18 * 60, end: 23 * 60 + 59 },
  { key: 'weekend-day', title: 'Weekend daytime', detail: 'Sat & Sun, 11am – 5pm', days: [0, 6], start: 11 * 60, end: 17 * 60 },
  { key: 'weekend-eve', title: 'Weekend evenings', detail: 'Sat & Sun, 6pm – 11pm', days: [0, 6], start: 18 * 60, end: 23 * 60 },
];

function Choice({ title, detail, on, onPress }: { title: string; detail: string; on: boolean; onPress: () => void }) {
  return (
    <Bouncy
      onPress={onPress}
      squish={0.97}
      style={{
        borderRadius: 24,
        padding: 20,
        backgroundColor: on ? Colors.accent : Colors.surface,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.lg,
      }}>
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="heading" style={{ fontSize: 20 }}>
          {title}
        </T>
        <T variant="body" color={on ? Colors.onAccent : Colors.textSecondary}>
          {detail}
        </T>
      </View>
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: on ? Colors.text : Colors.surfaceRaised,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {on ? <Icon name="check" size={16} color={Colors.accent} /> : null}
      </View>
    </Bouncy>
  );
}

function Dots({ step }: { step: number }) {
  return (
    <Row gap={6} style={{ justifyContent: 'center' }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ width: i === step ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i === step ? Colors.text : Colors.surfaceRaised }} />
      ))}
    </Row>
  );
}

export default function Welcome() {
  const { profile } = useAuth();
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const finish = async () => {
    try {
      await AsyncStorage.setItem(WELCOME_KEY, '1');
    } catch {
      // not critical
    }
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const saveRoutine = async () => {
    setSaving(true);
    try {
      const rules = ROUTINES.filter((r) => picked.includes(r.key)).flatMap((r) =>
        r.days.map((weekday) => ({ weekday, start_minute: r.start, end_minute: r.end })),
      );
      if (rules.length) await addRules(rules);
      setStep(1);
    } catch (e) {
      notify('Something went wrong', errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const invite = async () => {
    const message = inviteMessage(profile?.username);
    if (Platform.OS === 'web') {
      await navigator.clipboard?.writeText(message);
      notify('Copied', 'Paste it into a text to your friend.');
    } else {
      await Share.share({ message });
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Dots step={step} />

      {step === 0 ? (
        <Animated.View key="s0" entering={FadeInRight.duration(260)} style={{ gap: Spacing.xl }}>
          <View style={{ gap: Spacing.sm }}>
            <T variant="largeTitle">When are you usually free to hang out?</T>
            <T variant="body" color={Colors.textSecondary}>
              Tap all that fit. Your friends will see these times. You can change them anytime.
            </T>
          </View>
          <View style={{ gap: Spacing.md }}>
            {ROUTINES.map((r) => (
              <Choice
                key={r.key}
                title={r.title}
                detail={r.detail}
                on={picked.includes(r.key)}
                onPress={() => setPicked((p) => (p.includes(r.key) ? p.filter((x) => x !== r.key) : [...p, r.key]))}
              />
            ))}
          </View>
          <PopButton onPress={saveRoutine} disabled={saving}>
            <T variant="button" color={Colors.onAccent} style={{ textAlign: 'center', padding: 18 }}>
              {picked.length ? 'Next' : 'It changes every week'}
            </T>
          </PopButton>
        </Animated.View>
      ) : null}

      {step === 1 ? (
        <Animated.View key="s1" entering={FadeInRight.duration(260)} style={{ gap: Spacing.xl }}>
          <View style={{ gap: Spacing.sm }}>
            <T variant="largeTitle">Bring your friends</T>
            <T variant="body" color={Colors.textSecondary}>
              See which of your contacts are already here, and invite the rest with a text.
            </T>
          </View>
          <PopButton onPress={() => router.push('/find-friends')}>
            <Row style={{ padding: 18, justifyContent: 'center' }} gap={10}>
              <Icon name="friends" size={20} color={Colors.onAccent} />
              <T variant="button" color={Colors.onAccent}>
                Find friends in my contacts
              </T>
            </Row>
          </PopButton>
          <Button title="Just text an invite" variant="secondary" size="lg" onPress={invite} />
          <Pressable onPress={() => setStep(2)} hitSlop={10} style={{ alignSelf: 'center' }}>
            <T variant="label" style={{ textDecorationLine: 'underline' }}>
              Next
            </T>
          </Pressable>
        </Animated.View>
      ) : null}

      {step === 2 ? (
        <Animated.View key="s2" entering={FadeInRight.duration(260)} style={{ gap: Spacing.xl, alignItems: 'center' }}>
          <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <HandLogo size={84} wave />
          </View>
          <T variant="largeTitle" style={{ textAlign: 'center' }}>
            You&apos;re all set!
          </T>
          <T variant="body" color={Colors.textSecondary} style={{ textAlign: 'center', maxWidth: 320 }}>
            Whenever you feel like hanging out, tap the big green button at the bottom. We&apos;ll let your friends know.
          </T>
          <PopButton onPress={finish} style={{ alignSelf: 'stretch' }}>
            <T variant="button" color={Colors.onAccent} style={{ textAlign: 'center', padding: 18 }}>
              Start
            </T>
          </PopButton>
        </Animated.View>
      ) : null}
    </Screen>
  );
}
