import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { supabase } from './supabase';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/** Ask for permission, get an Expo push token and save it for this user. */
export async function registerForPush(userId: string): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('pings', {
      name: 'Hangout pings',
      // eslint-disable-next-line import/namespace -- enum is re-exported via `export *`
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 100, 200],
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn('No EAS projectId — run `npx eas-cli init` to enable push notifications.');
    return null;
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await supabase
    .from('push_tokens')
    .upsert({ token, user_id: userId, platform: Platform.OS, updated_at: new Date().toISOString() });
  return token;
}

/** Open the right screen when someone taps a notification. */
export function listenForNotificationTaps() {
  if (Platform.OS === 'web') return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as { type?: string; pingId?: string };
    if (data?.type === 'ping' && data.pingId) router.push({ pathname: '/ping/[id]', params: { id: data.pingId } });
    else router.push('/');
  });
  return () => sub.remove();
}
