/**
 * Day timeline for Home: hours run down the left, each friend's free time is a block at
 * its real time, and your own free time is a mint band behind everything. Blocks that
 * overlap your free time turn mint and say exactly when you're both free.
 */
import { useState } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import type { Interval } from '@/lib/availability';
import { formatTime } from '@/lib/time';
import type { Profile } from '@/lib/types';

import { Bouncy } from './bouncy';
import { Icon } from './icon';
import { Avatar, Row, T, displayName } from './ui';

export type FreeBlock = { key: string; profile: Profile; window: Interval; both: Interval | null; note: string | null };

const HOUR = 60; // px per hour
const AXIS = 40; // hour labels column
const MIN_BLOCK = 76;

const span = (w: Interval) => `${formatTime(w.start)} – ${formatTime(w.end)}`;
const hourLabel = (h: number) => (h === 0 || h === 24 ? '12am' : h === 12 ? '12pm' : h > 12 ? `${h - 12}pm` : `${h}am`);

/** Put overlapping blocks side by side (greedy lanes). */
function assignLanes(blocks: FreeBlock[], minMs: number) {
  const sorted = [...blocks].sort((a, b) => a.window.start - b.window.start);
  const laneEnds: number[] = [];
  const lane = new Map<string, number>();
  for (const b of sorted) {
    // Treat short blocks as at least MIN_BLOCK tall so their labels don't collide.
    const end = Math.max(b.window.end, b.window.start + minMs);
    let i = laneEnds.findIndex((e) => e <= b.window.start);
    if (i === -1) i = laneEnds.push(end) - 1;
    else laneEnds[i] = end;
    lane.set(b.key, i);
  }
  return { lane, lanes: Math.max(1, laneEnds.length) };
}

export function FreeTimeline({
  day,
  now,
  mine,
  blocks,
  onPress,
}: {
  day: number;
  now: number;
  mine: Interval[];
  blocks: FreeBlock[];
  onPress: (b: FreeBlock) => void;
}) {
  const [width, setWidth] = useState(320);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  // Show from the earliest thing (or now) to the latest, in whole hours.
  const all = [...mine, ...blocks.map((b) => b.window)];
  const firstMs = Math.min(...all.map((w) => w.start), now >= day && now < day + 86400000 ? now : Infinity);
  const lastMs = Math.max(...all.map((w) => w.end));
  const startH = Math.max(0, Math.floor((firstMs - day) / 3600000));
  const endH = Math.min(24, Math.ceil((lastMs - day) / 3600000));
  const top = day + startH * 3600000;
  const y = (ms: number) => ((Math.min(Math.max(ms, top), day + endH * 3600000) - top) / 3600000) * HOUR;
  const height = (endH - startH) * HOUR;

  const { lane, lanes } = assignLanes(blocks, (MIN_BLOCK / HOUR) * 3600000);
  const gap = 6;
  const colW = (width - AXIS - gap * (lanes - 1)) / lanes;
  const showNow = now > top && now < day + endH * 3600000;

  return (
    <View onLayout={onLayout} style={{ height: height + 8 }}>
      {/* hour lines + labels */}
      {Array.from({ length: endH - startH + 1 }, (_, i) => startH + i).map((h) => (
        <View key={h} style={{ position: 'absolute', top: (h - startH) * HOUR, left: 0, right: 0, flexDirection: 'row', alignItems: 'center' }}>
          <T variant="caption" color={Colors.textTertiary} style={{ width: AXIS, fontSize: 11, marginTop: -16 }}>
            {hourLabel(h)}
          </T>
          <View style={{ flex: 1, height: 1, backgroundColor: Colors.hairline }} />
        </View>
      ))}

      {/* your free time: a band behind everything */}
      {mine.map((w) => (
        <View
          key={`me${w.start}`}
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: y(w.start),
            height: y(w.end) - y(w.start),
            left: AXIS - 6,
            right: -6,
            borderRadius: 14,
            backgroundColor: Colors.accentDim,
            borderLeftWidth: 4,
            borderLeftColor: Colors.accent,
          }}>
          <T variant="caption" color={Colors.accentInk} style={{ position: 'absolute', right: 10, bottom: 6, fontWeight: '700' }}>
            You&apos;re free {span(w)}
          </T>
        </View>
      ))}

      {/* friends' free time */}
      {blocks.map((b) => {
        const t = y(b.window.start);
        const h = Math.max(MIN_BLOCK, y(b.window.end) - t);
        const both = !!b.both;
        const roomy = h >= 110;
        return (
          <Bouncy
            key={b.key}
            onPress={() => onPress(b)}
            squish={0.97}
            accessibilityLabel={`Ask ${displayName(b.profile)} to hang out, ${span(b.window)}`}
            style={{
              position: 'absolute',
              top: t + 2,
              height: h - 4,
              left: AXIS + (lane.get(b.key) ?? 0) * (colW + gap),
              width: colW,
              borderRadius: 16,
              padding: 10,
              gap: 3,
              backgroundColor: both ? Colors.accent : Colors.surface,
              shadowColor: '#000',
              shadowOpacity: 0.06,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              overflow: 'hidden',
            }}>
            <Row gap={8}>
              <Avatar profile={b.profile} size={26} />
              <T variant="label" numberOfLines={1} color={both ? Colors.onAccent : Colors.text} style={{ flex: 1, fontWeight: '700' }}>
                {displayName(b.profile).split(' ')[0]}
              </T>
              {both ? (
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.onAccent, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="check" size={11} color={Colors.accent} />
                </View>
              ) : null}
            </Row>
            <T variant="caption" color={both ? Colors.onAccent : Colors.textSecondary} numberOfLines={1}>
              {span(b.window)}
            </T>
            {both && b.both ? (
              <T variant="caption" color={Colors.onAccent} numberOfLines={2} style={{ fontWeight: '700' }}>
                Both free {span(b.both)}
              </T>
            ) : null}
            {b.note && (roomy || !both) ? (
              <T variant="caption" color={both ? Colors.onAccent : Colors.textSecondary} numberOfLines={roomy ? 2 : 1} style={{ opacity: 0.8 }}>
                “{b.note}”
              </T>
            ) : null}
          </Bouncy>
        );
      })}

      {/* now */}
      {showNow ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: y(now) - 1, left: AXIS - 6, right: 0, height: 2, backgroundColor: Colors.danger }}>
          <View style={{ position: 'absolute', left: -4, top: -3, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.danger }} />
        </View>
      ) : null}

      {blocks.length === 0 && mine.length === 0 ? null : <View style={{ height: Spacing.sm }} />}
    </View>
  );
}
