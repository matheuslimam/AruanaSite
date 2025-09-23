-- PERFIS (vincula auth.users)
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  patrol_id uuid references public.patrols(id) on delete set null,
  is_youth boolean not null default true,
  created_at timestamptz not null default now()
);

-- PATRULHAS
create table if not exists public.patrols (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

-- ATIVIDADES
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date date not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- CHAMADA (presenças)
create table if not exists public.attendance (
  activity_id uuid references public.activities(id) on delete cascade,
  member_id uuid references public.profiles(id) on delete cascade,
  present boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (activity_id, member_id)
);

-- PONTOS (podem ser por membro OU por patrulha diretamente)
create table if not exists public.points (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.profiles(id) on delete set null,
  patrol_id uuid references public.patrols(id) on delete set null,
  activity_id uuid references public.activities(id) on delete set null,
  points int not null,
  reason text,
  created_at timestamptz not null default now(),
  check ((member_id is not null) or (patrol_id is not null))
);

-- VIEW: soma por patrulha (pontos individuais somados à patrulha do membro + pontos diretos)
create or replace view public.patrol_points_view as
with individual as (
  select p.patrol_id as patrol_id, coalesce(sum(pt.points),0) as pts
  from public.points pt
  join public.profiles p on p.id = pt.member_id
  group by p.patrol_id
), direct as (
  select patrol_id, coalesce(sum(points),0) as pts from public.points where patrol_id is not null group by patrol_id
)
select pa.id, pa.name, coalesce(i.pts,0) + coalesce(d.pts,0) as total_points
from public.patrols pa
left join individual i on i.patrol_id = pa.id
left join direct d on d.patrol_id = pa.id;

-- RLS
alter table public.profiles enable row level security;
alter table public.patrols enable row level security;
alter table public.activities enable row level security;
alter table public.attendance enable row level security;
alter table public.points enable row level security;

-- Políticas simples (ajuste conforme necessidade)
create policy "read all" on public.patrols for select using (auth.role() = 'authenticated');
create policy "read all" on public.activities for select using (auth.role() = 'authenticated');
create policy "insert auth" on public.activities for insert with check (auth.role() = 'authenticated');
create policy "read all" on public.profiles for select using (auth.role() = 'authenticated');
create policy "insert auth" on public.profiles for insert with check (auth.role() = 'authenticated');
create policy "read all" on public.attendance for select using (auth.role() = 'authenticated');
create policy "insert auth" on public.attendance for insert with check (auth.role() = 'authenticated');
create policy "read all" on public.points for select using (auth.role() = 'authenticated');
create policy "insert auth" on public.points for insert with check (auth.role() = 'authenticated');

grant select on public.patrol_points_view to anon, authenticated;
