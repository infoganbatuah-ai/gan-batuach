-- Enum values must commit before later migrations use them in indexes or rows.
alter type public.kindergarten_subscription_status add value if not exists 'past_due';
alter type public.kindergarten_subscription_status add value if not exists 'grace_period';
