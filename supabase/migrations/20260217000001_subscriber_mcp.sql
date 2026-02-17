-- Subscriber MCP Access: Executive Circle read-only MCP for subscribers
-- Gives paid subscribers AI-powered access to published posts and prompt kits

-- ── subscriber_mcp_access ──────────────────────────────────────────────
create table if not exists subscriber_mcp_access (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  token text unique not null,  -- format: exc__<32 random chars>
  access_code_used text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  total_requests integer not null default 0,
  is_revoked boolean not null default false
);

create index idx_subscriber_mcp_access_token
  on subscriber_mcp_access (token)
  where is_revoked = false;

create index idx_subscriber_mcp_access_email
  on subscriber_mcp_access (email);

-- ── subscriber_mcp_usage ───────────────────────────────────────────────
create table if not exists subscriber_mcp_usage (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references subscriber_mcp_access(id) on delete cascade,
  tool_name text not null,
  created_at timestamptz not null default now()
);

create index idx_subscriber_mcp_usage_rate_limit
  on subscriber_mcp_usage (subscriber_id, created_at desc);

-- ── RLS ────────────────────────────────────────────────────────────────
alter table subscriber_mcp_access enable row level security;
alter table subscriber_mcp_usage enable row level security;

-- All authenticated CMP users can read subscriber data (for admin dashboard)
create policy "Authenticated users can view subscriber access"
  on subscriber_mcp_access for select
  to authenticated
  using (true);

create policy "Authenticated users can view subscriber usage"
  on subscriber_mcp_usage for select
  to authenticated
  using (true);

-- Service role handles all writes (registration API + usage logging)
-- No INSERT/UPDATE policies for authenticated — service client bypasses RLS

-- ── RPC: atomic request counter increment ──────────────────────────────
create or replace function increment_subscriber_requests(sub_id uuid)
returns void
language sql
security definer
as $$
  update subscriber_mcp_access
  set total_requests = total_requests + 1
  where id = sub_id;
$$;

-- ── Seed access code ───────────────────────────────────────────────────
insert into app_settings (category, key, value)
values ('executive_circle', 'access_code', '{"value": "executive_circle"}')
on conflict (category, key) do nothing;
