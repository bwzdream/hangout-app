/**
 * The download link to put in invites. Set this once the app has a real link
 * (for example a TestFlight public link or the App Store page).
 */
export const INVITE_URL = process.env.EXPO_PUBLIC_INVITE_URL ?? '';

/** The text people send to invite a friend. Plain words, with a clear next step. */
export function inviteMessage(username?: string | null) {
  return [
    "Hey! I'm using Pingle to see when friends are free to hang out.",
    INVITE_URL ? `Get it here: ${INVITE_URL}` : 'Get the Pingle app,',
    username ? `then add me: @${username}` : 'then add me as a friend.',
  ].join('\n');
}
