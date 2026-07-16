-- Deploy the Edge Function first:
-- supabase functions deploy sync-squarespace-orders --no-verify-jwt
--
-- Then store the project URL and publishable key in Vault and schedule it.
-- Replace values before running.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

select vault.create_secret(
  'https://YOUR-PROJECT-REF.supabase.co',
  'project_url'
);

select vault.create_secret(
  'YOUR-SUPABASE-PUBLISHABLE-KEY',
  'publishable_key'
);

select cron.schedule(
  'sync-squarespace-paid-orders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'project_url'
    ) || '/functions/v1/sync-squarespace-orders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'publishable_key'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
