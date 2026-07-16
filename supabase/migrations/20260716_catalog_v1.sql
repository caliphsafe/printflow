-- PrintFlow catalog editor v1
-- Run once in Supabase SQL Editor after the original schema.sql.

-- Ensure existing seeded products contain a complete designer configuration.
update public.catalog_products p
set configuration = jsonb_build_object(
  'sizes', s.settings->'sizes',
  'colors', s.settings->'colors',
  'printLocations', s.settings->'printLocations',
  'packages', s.settings->'packages',
  'mockupImageUrl', coalesce(p.configuration->'mockupImageUrl', 'null'::jsonb)
),
updated_at = now()
from public.shops s
where p.shop_id = s.id
  and (p.configuration->'sizes' is null or jsonb_typeof(p.configuration->'sizes') <> 'array');

-- Admin members already have full catalog CRUD through the original RLS policy.
-- Public designer reads products through a server-only Supabase secret key.

notify pgrst, 'reload schema';
