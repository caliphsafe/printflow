-- 1. Create the pilot owner in Supabase Dashboard → Authentication → Users.
-- 2. Replace the email below and run this file.
insert into public.organization_members (organization_id,user_id,role)
select o.id,u.id,'owner'
from public.organizations o
join auth.users u on lower(u.email)=lower('OWNER@EXAMPLE.COM')
where o.slug='demo-print-company'
on conflict (organization_id,user_id) do update set role='owner';
