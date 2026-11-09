import { Tabs } from 'expo-router';

import { Icon, type IconName } from '@/components/icon';
import { Colors } from '@/constants/theme';

const tabIcon = (name: IconName) =>
  function TabIcon({ color }: { color: unknown }) {
    return <Icon name={name} size={22} color={typeof color === 'string' ? color : Colors.text} />;
  };

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.text,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarStyle: {
          backgroundColor: Colors.background,
          borderTopColor: Colors.hairline,
        },
        tabBarLabelStyle: { fontWeight: '600', fontSize: 11 },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar', tabBarIcon: tabIcon('calendar') }} />
      <Tabs.Screen name="friends" options={{ title: 'Friends', tabBarIcon: tabIcon('friends') }} />
      <Tabs.Screen name="me" options={{ title: 'You', tabBarIcon: tabIcon('person') }} />
    </Tabs>
  );
}
