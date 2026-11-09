import { View } from 'react-native';

import type { Circle } from '@/lib/types';

import { Chip, T } from './ui';

export type Audience = { visibility: 'friends' | 'circle' | 'invite'; circleId: string | null };

/** Who can see this? All friends, one circle, or (activities only) invited people. */
export function AudiencePicker({
  value,
  onChange,
  circles,
  allowInvite,
}: {
  value: Audience;
  onChange: (a: Audience) => void;
  circles: Circle[];
  allowInvite?: boolean;
}) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Chip
          label="All friends"
          selected={value.visibility === 'friends'}
          onPress={() => onChange({ visibility: 'friends', circleId: null })}
        />
        {circles.map((c) => (
          <Chip
            key={c.id}
            label={c.name}
            selected={value.visibility === 'circle' && value.circleId === c.id}
            onPress={() => onChange({ visibility: 'circle', circleId: c.id })}
          />
        ))}
        {allowInvite ? (
          <Chip
            label="Invite only"
            selected={value.visibility === 'invite'}
            onPress={() => onChange({ visibility: 'invite', circleId: null })}
          />
        ) : null}
      </View>
      {circles.length === 0 ? <T variant="caption">Create circles from the Friends tab to share with smaller groups.</T> : null}
    </View>
  );
}
