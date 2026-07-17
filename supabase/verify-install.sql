-- Run after schema.sql. Every row should return true or a positive count.
select to_regclass('public.organizations') is not null as organizations_exists;
select to_regclass('public.shops') is not null as shops_exists;
select to_regclass('public.designs') is not null as designs_exists;
select to_regclass('public.catalog_products') is not null as catalog_products_exists;
select to_regclass('public.embed_keys') is not null as embed_keys_exists;
select count(*) as seeded_shops from public.shops;
select slug,name,active from public.shops order by created_at;
select to_regclass('public.shop_pricing_profiles') is not null as shop_pricing_profiles_exists;
