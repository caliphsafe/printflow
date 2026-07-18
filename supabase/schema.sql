-- PrintFlow Pilot / future SaaS foundation
create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  subscription_status text not null default 'pilot'
    check (subscription_status in ('pilot','trialing','active','past_due','canceled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','admin','staff')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null unique,
  name text not null,
  settings jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_integrations (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  checkout_provider text not null default 'squarespace',
  squarespace_api_key text,
  google_web_app_url text,
  google_webhook_secret text,
  last_order_sync timestamptz not null default (now() - interval '7 days'),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.designs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  display_id text not null unique,
  status text not null default 'draft'
    check (status in ('draft','awaiting_payment','paid','delivered','failed')),
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  product_name text not null,
  package_id text not null,
  package_label text not null,
  package_quantity integer not null check (package_quantity > 0),
  package_price numeric(12,2) not null check (package_price >= 0),
  shirt_color_id text not null,
  shirt_color_name text not null,
  print_location text not null,
  size_breakdown jsonb not null,
  customer_notes text,
  original_artwork_path text not null,
  preview_path text not null,
  original_filename text not null,
  original_mime_type text not null,
  checkout_url text not null,
  squarespace_order_id text,
  squarespace_order_number text,
  paid_at timestamptz,
  submitted_at timestamptz,
  delivered_at timestamptz,
  sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists designs_org_status_idx on public.designs(organization_id,status);
create index if not exists designs_shop_status_idx on public.designs(shop_id,status);
create index if not exists designs_display_id_idx on public.designs(display_id);

create table if not exists public.sync_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  external_event_id text not null,
  event_type text not null,
  created_at timestamptz not null default now(),
  unique(shop_id, external_event_id)
);



-- Future SaaS commercial/account foundation. These tables are safe to create
-- during the pilot even though billing and self-service onboarding are not yet enabled.
create table if not exists public.subscription_accounts (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  provider text not null default 'manual' check (provider in ('manual','stripe')),
  provider_customer_id text,
  provider_subscription_id text,
  plan_code text not null default 'pilot',
  status text not null default 'pilot',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.embed_keys (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  public_key text not null unique default ('pk_' || encode(gen_random_bytes(18),'hex')),
  allowed_domains text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  email text not null,
  name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(shop_id,email)
);

create table if not exists public.catalog_products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  active boolean not null default true,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(shop_id,slug)
);

create table if not exists public.checkout_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  provider text not null check (provider in ('squarespace','stripe','square','shopify')),
  status text not null default 'disconnected' check (status in ('disconnected','pending','connected','error')),
  external_account_id text,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(shop_id,provider)
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.is_organization_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.organization_members
    where organization_id = target_org and user_id = (select auth.uid())
  );
$$;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.shops enable row level security;
alter table public.shop_integrations enable row level security;
alter table public.designs enable row level security;
alter table public.sync_events enable row level security;
alter table public.subscription_accounts enable row level security;
alter table public.embed_keys enable row level security;
alter table public.customers enable row level security;
alter table public.catalog_products enable row level security;
alter table public.checkout_connections enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "Members read organizations" on public.organizations;
create policy "Members read organizations" on public.organizations
for select to authenticated using (public.is_organization_member(id));

drop policy if exists "Members read memberships" on public.organization_members;
create policy "Members read memberships" on public.organization_members
for select to authenticated using (user_id = (select auth.uid()) or public.is_organization_member(organization_id));

drop policy if exists "Public reads active shops" on public.shops;
create policy "Public reads active shops" on public.shops
for select to anon, authenticated using (active = true);

drop policy if exists "Members update shops" on public.shops;
create policy "Members update shops" on public.shops
for update to authenticated using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

drop policy if exists "Members read integrations" on public.shop_integrations;
create policy "Members read integrations" on public.shop_integrations
for select to authenticated using (
  exists(select 1 from public.shops s where s.id=shop_id and public.is_organization_member(s.organization_id))
);

drop policy if exists "Members read designs" on public.designs;
create policy "Members read designs" on public.designs
for select to authenticated using (public.is_organization_member(organization_id));

drop policy if exists "Members update designs" on public.designs;
create policy "Members update designs" on public.designs
for update to authenticated using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

drop policy if exists "Members read sync events" on public.sync_events;
create policy "Members read sync events" on public.sync_events
for select to authenticated using (public.is_organization_member(organization_id));



drop policy if exists "Members read subscriptions" on public.subscription_accounts;
create policy "Members read subscriptions" on public.subscription_accounts
for select to authenticated using (public.is_organization_member(organization_id));

drop policy if exists "Members manage embed keys" on public.embed_keys;
create policy "Members manage embed keys" on public.embed_keys
for all to authenticated using (
  exists(select 1 from public.shops s where s.id=shop_id and public.is_organization_member(s.organization_id))
) with check (
  exists(select 1 from public.shops s where s.id=shop_id and public.is_organization_member(s.organization_id))
);

drop policy if exists "Members manage customers" on public.customers;
create policy "Members manage customers" on public.customers
for all to authenticated using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

drop policy if exists "Members manage catalog" on public.catalog_products;
create policy "Members manage catalog" on public.catalog_products
for all to authenticated using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

drop policy if exists "Members read checkout connections" on public.checkout_connections;
create policy "Members read checkout connections" on public.checkout_connections
for select to authenticated using (public.is_organization_member(organization_id));

drop policy if exists "Members read audit logs" on public.audit_logs;
create policy "Members read audit logs" on public.audit_logs
for select to authenticated using (public.is_organization_member(organization_id));

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values
  ('artwork','artwork',false,104857600,array['image/png','image/jpeg','image/webp','image/svg+xml']),
  ('previews','previews',false,10485760,array['image/png'])
on conflict (id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

-- Pilot tenant and shop.
insert into public.organizations(name,slug,subscription_status)
values ('Demo Print Company','demo-print-company','pilot')
on conflict(slug) do update set name=excluded.name, updated_at=now();

insert into public.shops(organization_id,slug,name,settings)
select id,'demo-print-shop','Demo Print Shop',
'{
  "brand":{"primaryColor":"#111111","textColor":"#ffffff"},
  "product":{"name":"Classic Soft-Style T-Shirt","description":"Custom front print package"},
  "sizes":["S","M","L","XL","2XL"],
  "colors":[
    {"id":"black","name":"Black","hex":"#171717"},
    {"id":"white","name":"White","hex":"#f7f7f2"},
    {"id":"navy","name":"Navy","hex":"#15233f"},
    {"id":"red","name":"Red","hex":"#8e1f29"},
    {"id":"gray","name":"Sport Gray","hex":"#a8a8a3"}
  ],
  "printLocations":["Front Center"],
  "packages":[
    {"id":"12-shirts","label":"12 shirts","quantity":12,"price":179,"checkoutUrl":"https://YOUR-SQUARESPACE-DOMAIN.com/store/p/12-custom-shirts"},
    {"id":"24-shirts","label":"24 shirts","quantity":24,"price":279,"checkoutUrl":"https://YOUR-SQUARESPACE-DOMAIN.com/store/p/24-custom-shirts"},
    {"id":"50-shirts","label":"50 shirts","quantity":50,"price":449,"checkoutUrl":"https://YOUR-SQUARESPACE-DOMAIN.com/store/p/50-custom-shirts"},
    {"id":"100-shirts","label":"100 shirts","quantity":100,"price":699,"checkoutUrl":"https://YOUR-SQUARESPACE-DOMAIN.com/store/p/100-custom-shirts"}
  ],
  "upload":{"acceptedTypes":["image/png","image/jpeg","image/webp","image/svg+xml"],"maxBytes":104857600}
}'::jsonb
from public.organizations where slug='demo-print-company'
on conflict(slug) do update set settings=excluded.settings, active=true, updated_at=now();



insert into public.subscription_accounts(organization_id,provider,plan_code,status)
select id,'manual','pilot','pilot' from public.organizations where slug='demo-print-company'
on conflict(organization_id) do nothing;

insert into public.embed_keys(shop_id,allowed_domains)
select id,'{}'::text[] from public.shops where slug='demo-print-shop'
on conflict do nothing;

insert into public.catalog_products(organization_id,shop_id,slug,name,description,configuration)
select organization_id,id,'classic-soft-style','Classic Soft-Style T-Shirt','Pilot custom shirt product',settings->'product'
from public.shops where slug='demo-print-shop'
on conflict(shop_id,slug) do update set name=excluded.name,description=excluded.description,configuration=excluded.configuration,updated_at=now();

insert into public.checkout_connections(organization_id,shop_id,provider,status,configuration)
select organization_id,id,'squarespace','pending','{}'::jsonb
from public.shops where slug='demo-print-shop'
on conflict(shop_id,provider) do nothing;

-- Authenticated organization members can read their shop's private files.
drop policy if exists "Members read artwork" on storage.objects;
create policy "Members read artwork" on storage.objects
for select to authenticated using (
  bucket_id='artwork' and exists(
    select 1 from public.shops s
    where s.id::text = (storage.foldername(name))[1]
      and public.is_organization_member(s.organization_id)
  )
);

drop policy if exists "Members read previews" on storage.objects;
create policy "Members read previews" on storage.objects
for select to authenticated using (
  bucket_id='previews' and exists(
    select 1 from public.shops s
    where s.id::text = (storage.foldername(name))[1]
      and public.is_organization_member(s.organization_id)
  )
);

-- Global pricing profile used by the customer pricing engine.
create table if not exists public.shop_pricing_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(shop_id)
);
alter table public.shop_pricing_profiles enable row level security;
drop policy if exists "Members manage shop pricing" on public.shop_pricing_profiles;
create policy "Members manage shop pricing" on public.shop_pricing_profiles for all to authenticated
using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));

-- Production Launch v8 additions (fresh-install parity)
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
