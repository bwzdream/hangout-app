/**
 * Paywall placeholder for Pingle Plus. Purchases come later (App Store / Play billing);
 * the server already checks the `entitlements` table for the 'plus' plan.
 */
import { router } from 'expo-router';
import { View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { HandLogo } from '@/components/logo';
import { Button, Row, Screen, T } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { notify } from '@/lib/alert';

const PERKS: { icon: IconName; title: string; body: string }[] = [
  { icon: 'clock', title: 'Unlimited public time', body: 'Share as much free time with people nearby as you like, not just 2 hours a day.' },
  { icon: 'calendar', title: 'Plan the whole week', body: 'Set public free time for every day of the week in one go.' },
  { icon: 'sparkle', title: 'Show up first', body: 'Appear higher for people nearby who are free at the same time.' },
];

export default function Plus() {
  return (
    <Screen edges={['bottom']}>
      <View style={{ alignItems: 'center', gap: Spacing.lg }}>
        <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' }}>
          <HandLogo size={68} wave />
        </View>
        <T variant="largeTitle" style={{ textAlign: 'center' }}>
          Pingle Plus
        </T>
        <T variant="body" color={Colors.textSecondary} style={{ textAlign: 'center' }}>
          For people who want to meet more people.
        </T>
      </View>
      <View style={{ gap: Spacing.xl }}>
        {PERKS.map((p) => (
          <Row key={p.title} gap={Spacing.lg} style={{ alignItems: 'flex-start' }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={p.icon} size={18} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="heading">{p.title}</T>
              <T variant="body" color={Colors.textSecondary}>
                {p.body}
              </T>
            </View>
          </Row>
        ))}
      </View>
      <View style={{ gap: Spacing.md }}>
        <Button
          title="Coming soon"
          size="lg"
          onPress={() => notify('Coming soon', 'Pingle Plus isn’t available yet. For now, you can share up to 2 hours of public time a day.')}
        />
        <Button title="Maybe later" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
