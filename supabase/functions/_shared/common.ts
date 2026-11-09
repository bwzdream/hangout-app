// Shared helpers for Pingle edge functions (Deno runtime).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Admin client (bypasses RLS) — only used after we've verified the caller. */
export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

/** Resolve the calling user from their JWT. */
export async function callerId(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization');
  if (!auth) return null;
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  });
  const { data } = await client.auth.getUser();
  return data.user?.id ?? null;
}

export async function areFriends(admin: SupabaseClient, a: string, b: string) {
  const { data } = await admin
    .from('friendships')
    .select('id')
    .eq('status', 'accepted')
    .or(`and(requester_id.eq.${a},addressee_id.eq.${b}),and(requester_id.eq.${b},addressee_id.eq.${a})`)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

export async function friendIds(admin: SupabaseClient, userId: string): Promise<string[]> {
  const { data } = await admin
    .from('friendships')
    .select('requester_id, addressee_id')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  return (data ?? []).map((f) => (f.requester_id === userId ? f.addressee_id : f.requester_id));
}

type PushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default';
  richContent?: { image?: string };
};

/** Send push notifications through Expo's push service (handles APNs + FCM). */
export async function sendExpoPush(
  admin: SupabaseClient,
  userIds: string[],
  message: Omit<PushMessage, 'to'>,
) {
  if (userIds.length === 0) return 0;
  const { data: tokens } = await admin.from('push_tokens').select('token').in('user_id', userIds);
  const messages: PushMessage[] = (tokens ?? []).map((t) => ({ to: t.token, sound: 'default', ...message }));
  // Expo accepts up to 100 messages per request.
  for (let i = 0; i < messages.length; i += 100) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages.slice(i, i + 100)),
    });
  }
  return messages.length;
}
