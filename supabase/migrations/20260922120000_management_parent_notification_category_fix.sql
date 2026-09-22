-- GB-M35E: restore the Parent notification preference taxonomy on databases
-- whose older applied migration ledger predates the expanded Parent categories.
-- This is forward-only and safe for both fresh installs and existing upgrades.

alter table public.push_category_preferences
  drop constraint if exists push_category_preferences_category_check;

alter table public.push_category_preferences
  add constraint push_category_preferences_category_check check (category in (
    'registration',
    'parent_approval',
    'child_approval',
    'payment_reminder',
    'safety_alert',
    'observer_alert',
    'inspection_alert',
    'camera_alert',
    'system_notification',
    'compliance',
    'important',
    'safety',
    'attendance',
    'message',
    'document',
    'payment',
    'pickup'
  ));
