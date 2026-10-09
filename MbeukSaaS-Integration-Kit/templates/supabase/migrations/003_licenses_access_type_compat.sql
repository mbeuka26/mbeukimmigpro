-- Compatibilite Hub + cache licence local
-- Corrige: column licenses.access_type does not exist

ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS access_type text;

COMMENT ON COLUMN public.licenses.access_type IS
  'Cache Hub (trial/active). Autorite: Hub Central.';

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS hub_license_id text,
  ADD COLUMN IF NOT EXISTS hub_access_type text,
  ADD COLUMN IF NOT EXISTS hub_last_sync_at timestamptz;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hub_user_id text,
  ADD COLUMN IF NOT EXISTS hub_email text,
  ADD COLUMN IF NOT EXISTS hub_product_id uuid;

ALTER TABLE public.license_history DROP CONSTRAINT IF EXISTS license_history_event_check;

UPDATE public.license_history
SET
  details = COALESCE(details, '{}'::jsonb) || jsonb_build_object('legacy_event', event),
  event = 'hub_sync'
WHERE event NOT IN (
  'trial_started',
  'trial_expired',
  'activated',
  'renewed',
  'expired',
  'revoked',
  'hub_sync',
  'hub_sync_pending',
  'hub_denied',
  'checkout_started',
  'hub_register',
  'hub_login',
  'hub_me_refresh'
);

ALTER TABLE public.license_history ADD CONSTRAINT license_history_event_check
  CHECK (event IN (
    'trial_started',
    'trial_expired',
    'activated',
    'renewed',
    'expired',
    'revoked',
    'hub_sync',
    'hub_sync_pending',
    'hub_denied',
    'checkout_started',
    'hub_register',
    'hub_login',
    'hub_me_refresh'
  ));
