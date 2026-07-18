-- PrintFlow onboarding shop visibility fix v8.2
-- New shops are inactive until onboarding completes. Authenticated organization
-- members still need to read their own inactive shop in the onboarding/dashboard
-- application, while anonymous storefront visitors remain limited to active shops.

drop policy if exists "Members read shops" on public.shops;
create policy "Members read shops" on public.shops
for select to authenticated
using (public.is_organization_member(organization_id));

notify pgrst, 'reload schema';
