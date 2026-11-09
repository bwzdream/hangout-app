import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { GIF_PRESETS, STICKERS, gifsEnabled, searchGifs, type Gif } from '@/lib/gifs';

import { Chip, Input, T } from './ui';

export type GifChoice = { gifUrl: string | null; sticker: string | null };

/** Pick a GIF (GIPHY) or a single emoji as the ping's cover. */
export function GifPicker({ value, onChange }: { value: GifChoice; onChange: (v: GifChoice) => void }) {
  const [query, setQuery] = useState(GIF_PRESETS[0]);
  const [gifs, setGifs] = useState<Gif[]>([]);

  useEffect(() => {
    if (!gifsEnabled) return;
    const t = setTimeout(() => searchGifs(query).then(setGifs).catch(() => setGifs([])), 300);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <View style={{ gap: Spacing.md }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {STICKERS.map((s) => {
          const on = value.sticker === s;
          return (
            <Pressable
              key={s}
              onPress={() => onChange({ gifUrl: null, sticker: on ? null : s })}
              style={{
                width: 52,
                height: 52,
                borderRadius: Radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: on ? Colors.surfacePressed : Colors.surface,
                borderWidth: 1.5,
                borderColor: on ? Colors.accent : 'transparent',
              }}>
              <Text style={{ fontSize: 24 }}>{s}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {gifsEnabled ? (
        <>
          <Input value={query} onChangeText={setQuery} placeholder="Search GIFs" autoCapitalize="none" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {GIF_PRESETS.map((p) => (
              <Chip key={p} label={p} selected={p === query} onPress={() => setQuery(p)} />
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {gifs.map((g) => (
              <Pressable
                key={g.id}
                onPress={() => onChange({ gifUrl: value.gifUrl === g.url ? null : g.url, sticker: null })}
                style={{
                  borderRadius: Radius.md,
                  overflow: 'hidden',
                  borderWidth: 2,
                  borderColor: value.gifUrl === g.url ? Colors.accent : 'transparent',
                }}>
                <Image source={{ uri: g.preview }} style={{ width: 120, height: 120 }} contentFit="cover" />
              </Pressable>
            ))}
          </ScrollView>
          <T variant="caption" color={Colors.textTertiary}>
            Powered by GIPHY
          </T>
        </>
      ) : null}
    </View>
  );
}
