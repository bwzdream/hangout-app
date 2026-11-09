// POST { friend_id, label? } — "You're both free Sat 2–5pm 👀"
import { adminClient, areFriends, callerId, corsHeaders, json, sendExpoPush } from '../_shared/common.ts';

const NUDGES = [
  "You're both free",
  'The stars have aligned ✨ you’re both free',
  'No excuses — you’re both free',
  'Hangout alert 🚨 you’re both free',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const uid = await callerId(req);
  if (!uid) return json({ error: 'unauthorized' }, 401);

  const { friend_id, label } = await req.json().catch(() => ({}));
  if (!friend_id) return json({ error: 'friend_id required' }, 400);

  const admin = adminClient();
  if (!(await areFriends(admin, uid, friend_id))) return json({ error: 'not friends' }, 403);

  const { data: me } = await admin
    .from('profiles')
    .select('display_name, username, avatar_emoji')
    .eq('id', uid)
    .single();

  const name = me?.display_name || me?.username || 'Your friend';
  const line = NUDGES[Math.floor(Math.random() * NUDGES.length)];
  const sent = await sendExpoPush(admin, [friend_id], {
    title: `${me?.avatar_emoji ?? '👋'} ${name} nudged you!`,
    body: `${line}${label ? ` ${String(label).slice(0, 60)}` : ''}. Wanna hang?`,
    data: { type: 'nudge', fromId: uid },
  });

  return json({ sent });
});
