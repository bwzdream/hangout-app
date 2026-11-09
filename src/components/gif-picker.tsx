import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { GIF_PRESETS, STICKERS, gifsEnabled, searchGifs, type Gif } from '@/lib/gifs';

import { Chip, Input, T } from './ui';

export type GifChoice = { gifUrl: string | null; sticker: string | null };

/** Pick a GIF (GIPHY) or, as a fallback, a big emoji sticker. */
export function GifPicker({ value, onChange }: { value: GifChoice; onChange: (v: GifChoice) => void }) {
  const theme = useTheme();
  const [query, setQuery] = useState(GIF_PRESETS[0]);
  const [gifs, setGifs] = useState<Gif[]>([]);

  useEffect(() => {
    if (!gifsEnabled) return;
    const t = setTimeout(() => searchGifs(query).then(setGifs).catch(() => setGifs([])), 300);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <View style={{ gap: Spacing.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {STICKERS.map((s) => (
          <Pressable
            key={s}
            onPress={() => onChange({ gifUrl: null, sticker: value.sticker === s ? null : s })}
            style={{
              width: 52,
              height: 52,
              borderRadius: Radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: value.sticker === s ? theme.accentSoft : theme.card,
              borderWidth: 2,
              borderColor: value.sticker === s ? theme.accent : theme.border,
            }}>
            <Text style={{ fontSize: 28 }}>{s}</Text>
          </Pressable>
        ))}
      </View>

      {gifsEnabled ? (
        <>
          <Input value={query} onChangeText={setQuery} placeholder="Search GIFs…" autoCapitalize="none" />
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
                  borderWidth: 3,
                  borderColor: value.gifUrl === g.url ? theme.accent : 'transparent',
                }}>
                <Image source={{ uri: g.preview }} style={{ width: 130, height: 130 }} contentFit="cover" />
              </Pressable>
            ))}
          </ScrollView>
          <T variant="caption">Powered by GIPHY</T>
        </>
      ) : (
        <T variant="caption">Add a GIPHY key to search GIFs — stickers work in the meantime ✨</T>
      )}
    </View>
  );
}
