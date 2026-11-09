// POST { ping_id } — notifies everyone who can see a ping that their friend is free.
import { adminClient, callerId, corsHeaders, friendIds, json, sendExpoPush } from '../_shared/common.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const uid = await callerId(req);
  if (!uid) return json({ error: 'unauthorized' }, 401);

  const { ping_id } = await req.json().catch(() => ({}));
  if (!ping_id) return json({ error: 'ping_id required' }, 400);

  const admin = adminClient();
  const { data: ping } = await admin.from('pings').select('*').eq('id', ping_id).single();
  if (!ping || ping.sender_id !== uid) return json({ error: 'not found' }, 404);

  const { data: sender } = await admin
    .from('profiles')
    .select('display_name, username, avatar_emoji')
    .eq('id', uid)
    .single();

  let audience = await friendIds(admin, uid);
  if (ping.visibility === 'circle' && ping.circle_id) {
    const { data: members } = await admin
      .from('circle_members')
      .select('member_id')
      .eq('circle_id', ping.circle_id);
    const inCircle = new Set((members ?? []).map((m) => m.member_id));
    audience = audience.filter((id) => inCircle.has(id));
  }

  const name = sender?.display_name || sender?.username || 'A friend';
  const sent = await sendExpoPush(admin, audience, {
    title: `${sender?.avatar_emoji ?? '🎉'} ${name} is free to hang!`,
    body: ping.message || 'Tap to see when — this ping disappears soon 👀',
    data: { type: 'ping', pingId: ping.id, gifUrl: ping.gif_url },
    ...(ping.gif_url ? { richContent: { image: ping.gif_url } } : {}),
  });

  return json({ sent });
});
