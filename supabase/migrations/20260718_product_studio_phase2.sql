-- PrintFlow Product Studio + two-sided designer
alter table public.designs add column if not exists design_sides jsonb not null default '{}'::jsonb;
alter table public.designs add column if not exists design_configuration jsonb not null default '{}'::jsonb;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 8388608, array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do update set public = true, file_size_limit = 8388608,
allowed_mime_types = array['image/png','image/jpeg','image/webp','image/svg+xml'];

drop policy if exists "Public reads product images" on storage.objects;
create policy "Public reads product images" on storage.objects for select to public using (bucket_id = 'product-images');

drop policy if exists "Members upload product images" on storage.objects;
create policy "Members upload product images" on storage.objects for insert to authenticated
with check (bucket_id = 'product-images' and exists (
  select 1 from public.shops s where (storage.foldername(name))[1] = s.id::text and public.is_organization_member(s.organization_id)
));

drop policy if exists "Members update product images" on storage.objects;
create policy "Members update product images" on storage.objects for update to authenticated
using (bucket_id = 'product-images' and exists (
  select 1 from public.shops s where (storage.foldername(name))[1] = s.id::text and public.is_organization_member(s.organization_id)
));

-- Secure credential vault shared by payment, commerce, file and supplier connectors.
create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  provider text not null,
  category text not null check (category in ('payment','commerce','files','supplier','shipping','accounting')),
  status text not null default 'disconnected' check (status in ('disconnected','configured','connected','error')),
  account_label text,
  encrypted_credentials text,
  configuration jsonb not null default '{}'::jsonb,
  last_tested_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(shop_id, provider)
);
alter table public.integration_connections enable row level security;
drop policy if exists "Members manage integration connections" on public.integration_connections;
create policy "Members manage integration connections" on public.integration_connections for all to authenticated
using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));
notify pgrst, 'reload schema';
