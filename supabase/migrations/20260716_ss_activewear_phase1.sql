-- PrintFlow S&S Activewear Phase 1
create table if not exists public.supplier_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  provider text not null check (provider in ('ss-activewear')),
  status text not null default 'connected' check (status in ('connected','error','disconnected')),
  encrypted_account_number text not null,
  encrypted_api_key text not null,
  account_hint text,
  settings jsonb not null default '{"testMode":true,"shippingMethod":"1","autoselectWarehouse":true}'::jsonb,
  last_tested_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(shop_id,provider)
);

alter table public.designs add column if not exists catalog_product_id uuid references public.catalog_products(id) on delete set null;
alter table public.designs add column if not exists supplier_items jsonb not null default '[]'::jsonb;

create table if not exists public.supplier_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  design_id uuid not null references public.designs(id) on delete cascade,
  provider text not null check (provider in ('ss-activewear')),
  status text not null default 'submitted' check (status in ('submitted','confirmed','shipped','canceled','error')),
  test_order boolean not null default true,
  external_order_numbers text[] not null default '{}',
  request_payload jsonb not null,
  response_payload jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(design_id,provider)
);

alter table public.supplier_connections enable row level security;
alter table public.supplier_orders enable row level security;

drop policy if exists "Members manage supplier connections" on public.supplier_connections;
create policy "Members manage supplier connections" on public.supplier_connections for all to authenticated
using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));

drop policy if exists "Members read supplier orders" on public.supplier_orders;
create policy "Members read supplier orders" on public.supplier_orders for select to authenticated
using (public.is_organization_member(organization_id));

drop policy if exists "Members create supplier orders" on public.supplier_orders;
create policy "Members create supplier orders" on public.supplier_orders for insert to authenticated
with check (public.is_organization_member(organization_id));
