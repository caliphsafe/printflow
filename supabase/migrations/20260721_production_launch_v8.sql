-- PrintFlow Production Launch v8
alter table public.shops add column if not exists onboarding_state jsonb not null default '{}'::jsonb;
alter table public.shops add column if not exists onboarding_completed_at timestamptz;

alter table public.designs add column if not exists payment_provider text;
alter table public.designs add column if not exists payment_reference text;
alter table public.designs add column if not exists payment_url text;
alter table public.designs add column if not exists payment_status text not null default 'not_started';
alter table public.designs add column if not exists paid_amount numeric(12,2);
alter table public.designs add column if not exists currency text not null default 'usd';

create index if not exists designs_payment_reference_idx on public.designs(payment_provider,payment_reference);
create index if not exists designs_payment_status_idx on public.designs(shop_id,payment_status);

-- Existing shops are considered onboarded so this migration never locks current owners out.
update public.shops set onboarding_completed_at = coalesce(onboarding_completed_at, now()), onboarding_state = coalesce(onboarding_state,'{}'::jsonb) || '{"step":"complete","migrated":true}'::jsonb;

notify pgrst, 'reload schema';
