-- Helper functions are only meant for RLS policies and triggers, not as public API endpoints.
-- Signed-out visitors can't call any of them.
revoke execute on function
  public.is_friend(uuid), public.owns_circle(uuid), public.in_circle(uuid),
  public.can_view_activity(uuid), public.is_activity_participant(uuid), public.is_activity_host(uuid),
  public.can_view_ping(uuid), public.handle_new_user(), public.add_host_as_member()
from public, anon;

-- Trigger functions never need to be called directly.
revoke execute on function public.handle_new_user(), public.add_host_as_member() from authenticated;

-- RLS policies run as the signed-in user, so they need these. Each one only answers
-- questions about the caller's own relationships (e.g. "am I friends with X?").
grant execute on function
  public.is_friend(uuid), public.owns_circle(uuid), public.in_circle(uuid),
  public.can_view_activity(uuid), public.is_activity_participant(uuid), public.is_activity_host(uuid),
  public.can_view_ping(uuid)
to authenticated;
