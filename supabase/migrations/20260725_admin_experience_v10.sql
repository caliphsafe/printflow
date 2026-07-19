-- PrintFlow Admin Experience v10
create table if not exists public.platform_account_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by_email text not null,
  note text not null,
  created_at timestamptz not null default now()
);

create index if not exists platform_account_notes_org_created_idx
  on public.platform_account_notes(organization_id, created_at desc);

alter table public.platform_account_notes enable row level security;
-- Platform support notes are server-only. No client policy is granted.

create table if not exists public.platform_admin_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  admin_email text not null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists platform_admin_actions_created_idx
  on public.platform_admin_actions(created_at desc);

alter table public.platform_admin_actions enable row level security;
-- Platform audit history is server-only. No client policy is granted.
