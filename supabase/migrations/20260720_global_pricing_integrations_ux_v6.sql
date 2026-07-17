-- PrintFlow Global Pricing + Add-ons + Integration UX v6
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
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

insert into public.shop_pricing_profiles (organization_id, shop_id, configuration)
select
  s.organization_id,
  s.id,
  jsonb_build_object(
    'setupFee', jsonb_build_object(
      'enabled', true,
      'label', 'Order setup',
      'description', 'Covers production setup, file preparation, and press-ready administration.',
      'amount', 60
    ),
    'designOptimizationFee', jsonb_build_object(
      'enabled', true,
      'label', 'Design optimization',
      'description', 'Optional professional cleanup and production adjustment by the print shop.',
      'amount', 100
    ),
    'decorationServices', jsonb_build_array(
      jsonb_build_object('id','screen-print','name','Screen Print','percentageAdjustment',0,'active',true),
      jsonb_build_object('id','dtf','name','DTF','percentageAdjustment',0,'active',true),
      jsonb_build_object('id','embroidery','name','Embroidery','percentageAdjustment',0,'active',true),
      jsonb_build_object('id','heat-transfer','name','Heat Transfer','percentageAdjustment',0,'active',true)
    ),
    'addOns', '[]'::jsonb
  )
from public.shops s
on conflict (shop_id) do nothing;

notify pgrst, 'reload schema';
