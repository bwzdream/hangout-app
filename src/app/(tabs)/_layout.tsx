import { router, Tabs } from 'expo-router';
import { View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { Bouncy } from '@/components/playful';
import { T } from '@/components/ui';
import { Colors } from '@/constants/theme';

const tabIcon = (name: IconName) =>
  function TabIcon({ color }: { color: unknown }) {
    return <Icon name={name} size={22} color={typeof color === 'string' ? color : Colors.text} />;
  };

/** The big round "I'm free" button that sits in the middle of the tab bar. */
function FreeButton() {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Bouncy
        accessibilityLabel="I'm free — ping friends"
        onPress={() => router.push('/ping/new')}
        style={{ alignItems: 'center', marginTop: -22 }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: Colors.accent,
            borderWidth: 2,
            borderColor: Colors.text,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.18,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
          }}>
          <Icon name="bolt" size={26} color={Colors.onAccent} />
        </View>
        <T variant="caption" color={Colors.text} style={{ fontSize: 11, fontWeight: '700', marginTop: 4 }}>
          I&apos;m free
        </T>
      </Bouncy>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.text,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarStyle: { backgroundColor: Colors.background, borderTopColor: Colors.hairline, height: 88, paddingTop: 6 },
        tabBarLabelStyle: { fontWeight: '600', fontSize: 11 },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar', tabBarIcon: tabIcon('calendar') }} />
      <Tabs.Screen name="new" options={{ title: "I'm free", tabBarButton: () => <FreeButton /> }} />
      <Tabs.Screen name="friends" options={{ title: 'Friends', tabBarIcon: tabIcon('friends') }} />
      <Tabs.Screen name="me" options={{ title: 'You', tabBarIcon: tabIcon('person') }} />
    </Tabs>
  );
}
