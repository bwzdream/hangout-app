import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { StyleProp, ViewStyle } from 'react-native';

import { Colors } from '@/constants/theme';

/**
 * One icon vocabulary for the whole app: SF Symbols on iOS,
 * Material Symbols on Android and web.
 */
const ICONS = {
  home: { ios: 'house.fill', android: 'home' },
  calendar: { ios: 'calendar', android: 'calendar_month' },
  friends: { ios: 'person.2.fill', android: 'group' },
  person: { ios: 'person.crop.circle.fill', android: 'account_circle' },
  bolt: { ios: 'bolt.fill', android: 'bolt' },
  plus: { ios: 'plus', android: 'add' },
  close: { ios: 'xmark', android: 'close' },
  check: { ios: 'checkmark', android: 'check' },
  clock: { ios: 'clock', android: 'schedule' },
  pin: { ios: 'mappin.and.ellipse', android: 'location_on' },
  notes: { ios: 'text.alignleft', android: 'notes' },
  chevron: { ios: 'chevron.right', android: 'chevron_right' },
  search: { ios: 'magnifyingglass', android: 'search' },
  share: { ios: 'square.and.arrow.up', android: 'ios_share' },
  addPerson: { ios: 'person.badge.plus', android: 'person_add' },
  sync: { ios: 'arrow.triangle.2.circlepath', android: 'sync' },
  calendarAdd: { ios: 'calendar.badge.plus', android: 'calendar_add_on' },
  hand: { ios: 'hand.wave.fill', android: 'waving_hand' },
  sparkle: { ios: 'sparkles', android: 'auto_awesome' },
  lock: { ios: 'lock.fill', android: 'lock' },
  circles: { ios: 'circle.grid.2x2.fill', android: 'workspaces' },
  trash: { ios: 'trash', android: 'delete' },
  edit: { ios: 'pencil', android: 'edit' },
  logout: { ios: 'rectangle.portrait.and.arrow.right', android: 'logout' },
  globe: { ios: 'globe', android: 'public' },
  photo: { ios: 'photo.on.rectangle', android: 'photo_library' },
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 20,
  color = Colors.text,
  style,
}: {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const icon = ICONS[name];
  return (
    <SymbolView
      name={{ ios: icon.ios, android: icon.android, web: icon.android } as SymbolViewProps['name']}
      size={size}
      tintColor={color}
      weight="semibold"
      style={style}
    />
  );
}
