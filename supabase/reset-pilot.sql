-- ONLY use this if schema.sql partially failed and there is no real order data.
-- It removes the pilot tables so schema.sql can be run cleanly again.
drop table if exists public.audit_logs cascade;
drop table if exists public.checkout_connections cascade;
drop table if exists public.catalog_products cascade;
drop table if exists public.customers cascade;
drop table if exists public.embed_keys cascade;
drop table if exists public.subscription_accounts cascade;
drop table if exists public.sync_events cascade;
drop table if exists public.designs cascade;
drop table if exists public.shop_integrations cascade;
drop table if exists public.shops cascade;
drop table if exists public.organization_members cascade;
drop table if exists public.organizations cascade;
drop function if exists public.is_organization_member(uuid) cascade;
