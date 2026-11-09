export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_emoji: string;
  bio: string;
  timezone: string;
};

export type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted';
  created_at: string;
};

export type Circle = { id: string; owner_id: string; name: string; emoji: string };

export type AvailabilityRule = {
  id: string;
  user_id: string;
  weekday: number; // 0 = Sunday
  start_minute: number;
  end_minute: number;
};

export type FreeSlot = { id: string; user_id: string; starts_at: string; ends_at: string; note: string };
export type BusyBlock = { id: string; user_id: string; starts_at: string; ends_at: string; source: string };

export type Visibility = 'friends' | 'circle' | 'invite';

export type Activity = {
  id: string;
  host_id: string;
  title: string;
  emoji: string;
  details: string;
  location: string;
  starts_at: string;
  ends_at: string;
  visibility: Visibility;
  circle_id: string | null;
  created_at: string;
};

export type ActivityMember = {
  activity_id: string;
  user_id: string;
  status: 'going' | 'maybe';
};

export type Ping = {
  id: string;
  sender_id: string;
  message: string;
  gif_url: string | null;
  sticker: string | null;
  starts_at: string;
  ends_at: string;
  activity_id: string | null;
  visibility: 'friends' | 'circle';
  circle_id: string | null;
  expires_at: string;
  created_at: string;
};

export type PingResponse = { ping_id: string; user_id: string; response: 'in' | 'maybe' };
