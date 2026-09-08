-- SanMar FTP catalog cache for fast visual browsing.
-- One row per SanMar style; exact live pricing/inventory still comes from Web Services.
create table if not exists public.sanmar_catalog_styles (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  style_id text not null,
  brand_name text not null default 'SanMar',
  title text not null,
  description text not null default '',
  category text not null default 'Apparel',
  source_category text,
  subcategory text,
  image_url text,
  front_model_url text,
  back_model_url text,
  front_flat_url text,
  back_flat_url text,
  color_count integer not null default 0,
  size_count integer not null default 0,
  price_min numeric(12,2) not null default 0,
  price_max numeric(12,2) not null default 0,
  variants jsonb not null default '[]'::jsonb,
  source_file text,
  source_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  unique(shop_id, style_id)
);

create index if not exists sanmar_catalog_styles_shop_category_idx
  on public.sanmar_catalog_styles(shop_id, category, brand_name, style_id);
create index if not exists sanmar_catalog_styles_shop_style_idx
  on public.sanmar_catalog_styles(shop_id, style_id);

alter table public.sanmar_catalog_styles enable row level security;

drop policy if exists "Members manage SanMar catalog" on public.sanmar_catalog_styles;
create policy "Members manage SanMar catalog"
on public.sanmar_catalog_styles
for all to authenticated
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));
