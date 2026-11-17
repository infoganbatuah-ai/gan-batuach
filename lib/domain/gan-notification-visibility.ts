type NotificationQuery<Q> = {
  or(filter: string): Q;
  is(column: string, value: null): Q;
};

export function scopeActiveGanNotifications<Q extends NotificationQuery<Q>>(query: Q, profileId: string): Q {
  return query.or(`recipient_id.eq.${profileId},recipient_profile_id.eq.${profileId}`)
    .is("archived_at", null);
}
