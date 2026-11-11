-- =============================================================
--  Chicken Hot — база для сайта и админки (Supabase)
--  Выполнить один раз: Supabase → SQL Editor → New query → Run
-- =============================================================

-- 1. Меню, акции и настройки (один JSON-документ)
create table if not exists public.site (
  id         int primary key default 1 check (id = 1),
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- 2. Заказы с сайта
create table if not exists public.orders (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  code       text check (char_length(code) <= 10),
  name       text not null check (char_length(name) between 1 and 80),
  phone      text not null check (char_length(phone) between 5 and 30),
  address    text check (char_length(address) <= 300),
  payment    text check (char_length(payment) <= 60),
  promo      text check (char_length(promo) <= 40),
  comment    text check (char_length(comment) <= 500),
  items      jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 60),
  total      int not null check (total between 0 and 2000000),
  status     text not null default 'new'
             check (status in ('new','accepted','cooking','delivery','done','canceled'))
);

-- 3. Администраторы (email тех, кто может входить в админку)
create table if not exists public.admins (
  email text primary key
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where lower(email) = lower(auth.jwt() ->> 'email'));
$$;

-- 4. Права доступа (RLS)
alter table public.site   enable row level security;
alter table public.orders enable row level security;
alter table public.admins enable row level security;

drop policy if exists "site: читать всем"        on public.site;
drop policy if exists "site: менять админам"     on public.site;
drop policy if exists "orders: создавать всем"   on public.orders;
drop policy if exists "orders: читать админам"   on public.orders;
drop policy if exists "orders: менять админам"   on public.orders;
drop policy if exists "orders: удалять админам"  on public.orders;
drop policy if exists "admins: видеть себя"      on public.admins;

create policy "site: читать всем"       on public.site   for select using (true);
create policy "site: менять админам"    on public.site   for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "orders: создавать всем"  on public.orders for insert to anon, authenticated with check (status = 'new');
create policy "orders: читать админам"  on public.orders for select to authenticated using (public.is_admin());
create policy "orders: менять админам"  on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "orders: удалять админам" on public.orders for delete to authenticated using (public.is_admin());
create policy "admins: видеть себя"     on public.admins for select to authenticated using (lower(email) = lower(auth.jwt() ->> 'email'));

-- 5. Хранилище для фото блюд
insert into storage.buckets (id, name, public)
values ('menu', 'menu', true)
on conflict (id) do nothing;

drop policy if exists "menu: читать всем"      on storage.objects;
drop policy if exists "menu: загружать админам" on storage.objects;
drop policy if exists "menu: менять админам"    on storage.objects;
drop policy if exists "menu: удалять админам"   on storage.objects;

create policy "menu: читать всем"       on storage.objects for select using (bucket_id = 'menu');
create policy "menu: загружать админам" on storage.objects for insert to authenticated with check (bucket_id = 'menu' and public.is_admin());
create policy "menu: менять админам"    on storage.objects for update to authenticated using (bucket_id = 'menu' and public.is_admin());
create policy "menu: удалять админам"   on storage.objects for delete to authenticated using (bucket_id = 'menu' and public.is_admin());

-- 6. Мгновенные уведомления о новых заказах в админке
do $$ begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null; end $$;

-- 7. ВАЖНО: впишите email администратора (тот же, что создадите в Authentication → Users)
insert into public.admins (email) values ('ВАШ_EMAIL@gmail.com')
on conflict do nothing;
