import { Tabs } from 'expo-router';
import { Text } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

const icon = (emoji: string) =>
  function TabIcon({ focused }: { focused: boolean }) {
    return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
  };

export default function TabLayout() {
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: { backgroundColor: theme.card, borderTopColor: theme.border },
        tabBarLabelStyle: { fontWeight: '700' },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Hang', tabBarIcon: icon('🏠') }} />
      <Tabs.Screen name="calendar" options={{ title: "Who's free", tabBarIcon: icon('📅') }} />
      <Tabs.Screen name="friends" options={{ title: 'Friends', tabBarIcon: icon('👯') }} />
      <Tabs.Screen name="me" options={{ title: 'Me', tabBarIcon: icon('😎') }} />
    </Tabs>
  );
}
