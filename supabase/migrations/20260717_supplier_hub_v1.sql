-- PrintFlow Supplier Hub v1
-- Supplier-neutral catalog, demo data, and blank-order draft workflow.

alter table public.supplier_connections drop constraint if exists supplier_connections_provider_check;
alter table public.supplier_orders drop constraint if exists supplier_orders_provider_check;

create table if not exists public.supplier_catalog_styles (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_style_id text not null,
  supplier_name text not null,
  brand_name text not null,
  style_name text not null,
  title text not null,
  description text,
  category text not null default 'T-Shirts',
  part_number text,
  image_front_url text,
  image_back_url text,
  source_mode text not null default 'live' check (source_mode in ('live','demo')),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, external_style_id)
);

create table if not exists public.supplier_catalog_variants (
  id uuid primary key default gen_random_uuid(),
  style_id uuid not null references public.supplier_catalog_styles(id) on delete cascade,
  external_variant_id text,
  sku text not null,
  gtin text,
  color_name text not null,
  color_hex text not null default '#777777',
  size_name text not null,
  wholesale_price numeric(12,2) not null default 0,
  inventory_quantity integer not null default 0,
  image_front_url text,
  image_back_url text,
  swatch_image_url text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(style_id, sku)
);

create table if not exists public.supplier_order_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  design_id uuid not null references public.designs(id) on delete cascade,
  provider text not null,
  status text not null default 'draft' check (status in ('draft','ready','submitted','canceled')),
  items jsonb not null default '[]'::jsonb,
  estimated_total numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(design_id, provider)
);

alter table public.supplier_catalog_styles enable row level security;
alter table public.supplier_catalog_variants enable row level security;
alter table public.supplier_order_drafts enable row level security;

drop policy if exists "Authenticated users read supplier styles" on public.supplier_catalog_styles;
create policy "Authenticated users read supplier styles" on public.supplier_catalog_styles for select to authenticated using (active = true);

drop policy if exists "Authenticated users read supplier variants" on public.supplier_catalog_variants;
create policy "Authenticated users read supplier variants" on public.supplier_catalog_variants for select to authenticated using (active = true);

drop policy if exists "Members manage supplier order drafts" on public.supplier_order_drafts;
create policy "Members manage supplier order drafts" on public.supplier_order_drafts for all to authenticated
using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));

insert into public.supplier_catalog_styles
(provider,external_style_id,supplier_name,brand_name,style_name,title,description,category,part_number,image_front_url,image_back_url,source_mode,metadata)
values
('demo','demo-core-tee','PrintFlow Demo Supplier','PF Basics','Core Tee','Core Cotton T-Shirt','Demo supplier-neutral garment used to test imports while live credentials are pending.','T-Shirts','PF100','/demo-blanks/core-tee-front.svg','/demo-blanks/core-tee-back.svg','demo','{"weight":"6 oz","fabric":"100% cotton"}'::jsonb),
('demo','demo-premium-tee','PrintFlow Demo Supplier','PF Studio','Premium Tee','Premium Ringspun T-Shirt','Demo premium blank with supplier-neutral color, size and SKU data.','T-Shirts','PF200','/demo-blanks/premium-tee-front.svg','/demo-blanks/premium-tee-back.svg','demo','{"weight":"4.3 oz","fabric":"ringspun cotton"}'::jsonb)
on conflict (provider,external_style_id) do update set title=excluded.title,updated_at=now();

do $$
declare core uuid; premium uuid; c text; s text; hex text;
begin
 select id into core from public.supplier_catalog_styles where provider='demo' and external_style_id='demo-core-tee';
 select id into premium from public.supplier_catalog_styles where provider='demo' and external_style_id='demo-premium-tee';
 foreach c in array array['Black','White','Navy'] loop
  hex := case c when 'Black' then '#202124' when 'White' then '#f5f5f2' else '#1d2d50' end;
  foreach s in array array['S','M','L','XL','2XL'] loop
   insert into public.supplier_catalog_variants(style_id,external_variant_id,sku,color_name,color_hex,size_name,wholesale_price,inventory_quantity,image_front_url,image_back_url,metadata)
   values(core,'core-'||lower(c)||'-'||lower(s),'DEMO-CORE-'||upper(substr(c,1,3))||'-'||s,c,hex,s,case when s='2XL' then 4.75 else 3.75 end,250,'/demo-blanks/core-tee-front.svg','/demo-blanks/core-tee-back.svg','{"demo":true}'::jsonb)
   on conflict(style_id,sku) do nothing;
  end loop;
 end loop;
 foreach c in array array['Natural','Vintage Black','Heather Grey'] loop
  hex := case c when 'Natural' then '#e8e5dc' when 'Vintage Black' then '#333333' else '#aaa9a5' end;
  foreach s in array array['XS','S','M','L','XL','2XL'] loop
   insert into public.supplier_catalog_variants(style_id,external_variant_id,sku,color_name,color_hex,size_name,wholesale_price,inventory_quantity,image_front_url,image_back_url,metadata)
   values(premium,'premium-'||replace(lower(c),' ','-')||'-'||lower(s),'DEMO-PREM-'||upper(substr(replace(c,' ',''),1,3))||'-'||s,c,hex,s,case when s='2XL' then 6.50 else 5.50 end,175,'/demo-blanks/premium-tee-front.svg','/demo-blanks/premium-tee-back.svg','{"demo":true}'::jsonb)
   on conflict(style_id,sku) do nothing;
  end loop;
 end loop;
end $$;
