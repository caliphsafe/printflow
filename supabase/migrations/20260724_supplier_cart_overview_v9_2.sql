-- PrintFlow Supplier Cart + Overview UX v9.2
-- Converts blank-order drafts into provider-specific cart records.

alter table public.supplier_order_drafts
  drop constraint if exists supplier_order_drafts_status_check;

alter table public.supplier_order_drafts
  add constraint supplier_order_drafts_status_check
  check (status in ('draft','ready','cart','submitted','ordered','canceled'));

update public.supplier_order_drafts
set status = 'cart', updated_at = now()
where status in ('draft','ready');

create index if not exists supplier_order_drafts_shop_provider_status_idx
  on public.supplier_order_drafts(shop_id, provider, status, updated_at desc);
