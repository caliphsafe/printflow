-- PrintFlow Launch Candidate v9
create table if not exists public.platform_admins (
  email text primary key,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.platform_admins(email,active)
values ('caliph.safe@gmail.com',true)
on conflict(email) do update set active=true;

create table if not exists public.subscription_plans (
  code text primary key,
  name text not null,
  monthly_price numeric(10,2) not null default 0,
  description text not null default '',
  features jsonb not null default '[]'::jsonb,
  order_limit integer,
  team_seats integer,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.subscription_plans(code,name,monthly_price,description,features,order_limit,team_seats,sort_order)
values
  ('starter','Starter',49,'For new shops launching online ordering.','["Branded storefront","Stripe or Square checkout","S&S catalog connection","Production pricing","Up to 75 orders per month","Guided onboarding"]'::jsonb,75,2,1),
  ('growth','Growth',99,'For established shops processing steady volume.','["Everything in Starter","Unlimited customer products","Advanced pricing and add-ons","Supplier ordering","Up to 300 orders per month","Priority onboarding"]'::jsonb,300,5,2),
  ('scale','Scale',199,'For high-volume production teams and multi-user operations.','["Everything in Growth","Unlimited orders","Priority support","Advanced account controls","Launch assistance"]'::jsonb,null,10,3)
on conflict(code) do update set
  name=excluded.name,
  monthly_price=excluded.monthly_price,
  description=excluded.description,
  features=excluded.features,
  order_limit=excluded.order_limit,
  team_seats=excluded.team_seats,
  sort_order=excluded.sort_order,
  active=true,
  updated_at=now();

alter table public.platform_admins enable row level security;
alter table public.subscription_plans enable row level security;

drop policy if exists "Public reads active plans" on public.subscription_plans;
create policy "Public reads active plans" on public.subscription_plans
for select to anon, authenticated using (active = true);

-- Platform administration is performed only through authenticated server routes.
-- No client-side policies are granted on platform_admins.


create table if not exists public.platform_settings (
  key text primary key,
  encrypted_value text not null,
  updated_at timestamptz not null default now()
);

alter table public.platform_settings enable row level security;
-- Platform settings are server-only and intentionally have no client policies.

update public.subscription_accounts
set current_period_end = coalesce(current_period_end, now() + interval '14 days'),
    updated_at = now()
where status = 'trialing';

create index if not exists subscription_accounts_plan_idx on public.subscription_accounts(plan_code,status);
create index if not exists organizations_subscription_status_idx on public.organizations(subscription_status);

notify pgrst, 'reload schema';
