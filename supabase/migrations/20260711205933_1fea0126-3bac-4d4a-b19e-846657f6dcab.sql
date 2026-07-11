create table if not exists public.whatsapp_sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  connection_secret text not null unique,
  status text not null default 'disconnected',
  qr_data_url text,
  phone_number text,
  worker_version text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger whatsapp_sessions_updated before update on public.whatsapp_sessions for each row execute function public.set_updated_at();

create table if not exists public.whatsapp_outbound (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.whatsapp_sessions(id) on delete cascade,
  to_jid text not null,
  body text not null,
  status text not null default 'queued',
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists whatsapp_outbound_pending on public.whatsapp_outbound(session_id, status) where status = 'queued';

create table if not exists public.whatsapp_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.whatsapp_sessions(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists whatsapp_events_session_time on public.whatsapp_events(session_id, created_at desc);

grant select, insert, update, delete on public.whatsapp_sessions to authenticated;
grant all on public.whatsapp_sessions to service_role;
grant select, insert, update, delete on public.whatsapp_outbound to authenticated;
grant all on public.whatsapp_outbound to service_role;
grant select, insert, update, delete on public.whatsapp_events to authenticated;
grant all on public.whatsapp_events to service_role;

alter table public.whatsapp_sessions enable row level security;
alter table public.whatsapp_outbound enable row level security;
alter table public.whatsapp_events enable row level security;

create policy "owner reads whatsapp session" on public.whatsapp_sessions for select to authenticated
  using (exists (select 1 from public.businesses b where b.id = whatsapp_sessions.business_id and b.owner_id = auth.uid()));
create policy "owner reads whatsapp outbound" on public.whatsapp_outbound for select to authenticated
  using (exists (select 1 from public.whatsapp_sessions s join public.businesses b on b.id = s.business_id where s.id = whatsapp_outbound.session_id and b.owner_id = auth.uid()));
create policy "owner reads whatsapp events" on public.whatsapp_events for select to authenticated
  using (exists (select 1 from public.whatsapp_sessions s join public.businesses b on b.id = s.business_id where s.id = whatsapp_events.session_id and b.owner_id = auth.uid()));