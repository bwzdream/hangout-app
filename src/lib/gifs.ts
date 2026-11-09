/**
 * GIF search via GIPHY. Set EXPO_PUBLIC_GIPHY_API_KEY to enable it
 * (free key at developers.giphy.com — GIPHY attribution must be shown).
 * Without a key, the picker falls back to big emoji stickers.
 */
const GIPHY_KEY = process.env.EXPO_PUBLIC_GIPHY_API_KEY;

export const gifsEnabled = Boolean(GIPHY_KEY);

export type Gif = { id: string; url: string; preview: string; width: number; height: number };

export const GIF_PRESETS = ['free to hang', 'lets go', 'party', 'coffee', 'pizza', 'dance', 'cute cat', 'yay'];

export const STICKERS = ['🎉', '🍕', '☕️', '🍻', '🎳', '🏀', '🎮', '🎤', '🍜', '🌮', '🛼', '🌳', '🎬', '🧋', '🏖️', '🪩'];

export async function searchGifs(query: string, limit = 24): Promise<Gif[]> {
  if (!GIPHY_KEY) return [];
  const endpoint = query.trim()
    ? `https://api.giphy.com/v1/gifs/search?q=${encodeURIComponent(query)}&`
    : 'https://api.giphy.com/v1/gifs/trending?';
  const res = await fetch(`${endpoint}api_key=${GIPHY_KEY}&limit=${limit}&rating=pg`);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.data ?? []).map((g: any) => ({
    id: g.id,
    url: g.images?.downsized_medium?.url ?? g.images?.original?.url,
    preview: g.images?.fixed_width?.url ?? g.images?.original?.url,
    width: Number(g.images?.fixed_width?.width ?? 200),
    height: Number(g.images?.fixed_width?.height ?? 200),
  }));
}
