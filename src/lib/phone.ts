/** Phone/email normalisation shared by the app and tests (no native imports). */

/** Digits only, with a country code. A bare 10-digit number is treated as US/Canada. */
export function normalizePhone(raw: string, defaultCountry = '1'): string | null {
  const plus = raw.trim().startsWith('+');
  let digits = raw.replace(/\D/g, '');
  if (!plus && digits.startsWith('00')) digits = digits.slice(2);
  else if (!plus && digits.length === 10) digits = defaultCountry + digits;
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

export const normalizeEmail = (raw: string) => raw.trim().toLowerCase();

/** The strings that get hashed (must match supabase/migrations/*_contact_matching.sql). */
export const phoneKey = (digits: string) => `phone:${digits}`;
export const emailKey = (email: string) => `email:${normalizeEmail(email)}`;
