/**
 * Find friends from the address book — privately.
 * Contacts are read on the phone, each email/phone is hashed (SHA-256), and only the
 * hashes are sent to the server to find which belong to Pingle users.
 */
import * as Contacts from 'expo-contacts';
import { Contact, ContactField } from 'expo-contacts';
import * as Crypto from 'expo-crypto';
import * as SMS from 'expo-sms';
import { Platform, Share } from 'react-native';

import { inviteMessage } from './invite';
import { emailKey, normalizePhone, phoneKey } from './phone';
import { supabase } from './supabase';

export const canReadContacts = Platform.OS === 'ios' || Platform.OS === 'android';

export type PhoneContact = { id: string; name: string; phones: string[]; emails: string[] };
export type ContactMatch = PhoneContact & {
  user: { id: string; username: string; display_name: string; avatar_emoji: string; verified: boolean };
};

const sha256 = (s: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, s);
export const hashPhone = (digits: string) => sha256(phoneKey(digits));
export const hashEmail = (email: string) => sha256(emailKey(email));

export async function contactsPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (!canReadContacts) return 'denied';
  const p = await Contacts.getPermissionsAsync();
  return p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';
}

export async function requestContacts(): Promise<boolean> {
  if (!canReadContacts) return false;
  const p = await Contacts.requestPermissionsAsync();
  return p.granted;
}

/** Everyone in the address book with a phone or email, sorted by name. */
export async function readContacts(): Promise<PhoneContact[]> {
  const rows = await Contact.getAllDetails([
    ContactField.FULL_NAME,
    ContactField.GIVEN_NAME,
    ContactField.FAMILY_NAME,
    ContactField.PHONES,
    ContactField.EMAILS,
  ]);
  return rows
    .map((c) => ({
      id: c.id,
      name: c.fullName || [c.givenName, c.familyName].filter(Boolean).join(' ') || '',
      phones: (c.phones ?? []).map((p) => p.number).filter((n): n is string => !!n),
      emails: (c.emails ?? []).map((e) => e.address).filter((a): a is string => !!a),
    }))
    .filter((c) => c.name && (c.phones.length || c.emails.length))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Which contacts are already on Pingle. */
export async function matchContacts(contacts: PhoneContact[]): Promise<ContactMatch[]> {
  const byHash = new Map<string, PhoneContact>();
  for (const c of contacts) {
    for (const p of c.phones) {
      const n = normalizePhone(p);
      if (n) byHash.set(await hashPhone(n), c);
    }
    for (const e of c.emails) byHash.set(await hashEmail(e), c);
  }
  const hashes = [...byHash.keys()];
  const found = new Map<string, ContactMatch>();
  for (let i = 0; i < hashes.length; i += 1000) {
    const { data, error } = await supabase.rpc('match_contacts', { hashes: hashes.slice(i, i + 1000) });
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as {
      hash: string;
      verified: boolean;
      id: string;
      username: string;
      display_name: string;
      avatar_emoji: string;
    }[]) {
      const contact = byHash.get(row.hash);
      if (!contact || found.has(row.id)) continue;
      found.set(row.id, {
        ...contact,
        user: { id: row.id, username: row.username, display_name: row.display_name, avatar_emoji: row.avatar_emoji, verified: row.verified },
      });
    }
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Save (or clear) my phone number so friends who have it can find me. Only the hash is stored. */
export async function setMyPhone(userId: string, raw: string | null) {
  await supabase.from('contact_hashes').delete().eq('user_id', userId).eq('kind', 'phone');
  if (!raw) return;
  const n = normalizePhone(raw);
  if (!n) throw new Error('That doesn’t look like a phone number');
  const { error } = await supabase.from('contact_hashes').insert({ user_id: userId, kind: 'phone', hash: await hashPhone(n) });
  if (error) throw new Error(error.message);
}

export async function hasMyPhone(userId: string): Promise<boolean> {
  const { data } = await supabase.from('contact_hashes').select('hash').eq('user_id', userId).eq('kind', 'phone').limit(1);
  return (data?.length ?? 0) > 0;
}

/**
 * Invite someone by text from the user's own phone (free — it's their own Messages app).
 * Falls back to the share sheet when texting isn't available.
 */
export async function inviteByText(phone: string | null, username?: string | null) {
  const message = inviteMessage(username);
  if (phone && Platform.OS !== 'web' && (await SMS.isAvailableAsync())) {
    await SMS.sendSMSAsync([phone], message);
    return;
  }
  if (Platform.OS === 'web') {
    await navigator.clipboard?.writeText(message);
    return;
  }
  await Share.share({ message });
}
