-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — Sklep (materiały cyfrowe) + analityka
--  Migracja #49  ·  idempotentna (można uruchomić ponownie)
--
--  Tworzy:
--    • public.shop_products  — produkty/materiały do pobrania
--    • public.shop_events    — analityka (wejścia, pobrania, kliknięcia)
--    • RPC shop_stats()      — zagregowane statystyki (admin only)
--    • Storage bucket 'shop-files' (publiczny odczyt, zapis admin)
--
--  Wymaga wcześniej: fix-rls-recursion.sql (#20) — helper public._is_admin()
-- ═══════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─── Produkty ──────────────────────────────────────────────────
create table if not exists public.shop_products (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  title         text not null,
  short_desc    text,
  long_desc     text,
  category      text,                       -- np. 'karty-pracy','gry','testy','plany'
  audience      text not null default 'both'
                  check (audience in ('teacher','student','both')),
  cover_emoji   text default '📄',
  cover_url     text,                        -- opcjonalna miniatura (URL)
  price_grosze  integer not null default 0 check (price_grosze >= 0),
  currency      text not null default 'PLN',
  is_free       boolean not null default true,
  file_url      text,                        -- link do pobrania pliku (Storage/zewnętrzny)
  external_url  text,                        -- alternatywnie: link do materiału
  badge         text,                        -- np. 'Nowość','Bestseller'
  is_published  boolean not null default false,
  sort_order    integer not null default 0,
  created_by    uuid references auth.users(id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists shop_products_pub_idx  on public.shop_products (is_published, sort_order);
create index if not exists shop_products_cat_idx  on public.shop_products (category);

-- ─── Analityka (zdarzenia) ─────────────────────────────────────
create table if not exists public.shop_events (
  id          bigint generated always as identity primary key,
  product_id  uuid references public.shop_products(id) on delete set null,
  event_type  text not null
                check (event_type in ('view_shop','view_product','click_download','click_link','click_buy')),
  path        text,
  referrer    text,
  user_id     uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists shop_events_prod_idx on public.shop_events (product_id, event_type);
create index if not exists shop_events_time_idx on public.shop_events (created_at);

-- ─── RLS ───────────────────────────────────────────────────────
alter table public.shop_products enable row level security;
alter table public.shop_events   enable row level security;

-- Produkty: opublikowane widoczne dla wszystkich (także anon); admin widzi wszystko
drop policy if exists shop_products_select on public.shop_products;
create policy shop_products_select on public.shop_products
  for select using ( is_published = true or public._is_admin() );

drop policy if exists shop_products_ins on public.shop_products;
create policy shop_products_ins on public.shop_products
  for insert with check ( public._is_admin() );

drop policy if exists shop_products_upd on public.shop_products;
create policy shop_products_upd on public.shop_products
  for update using ( public._is_admin() ) with check ( public._is_admin() );

drop policy if exists shop_products_del on public.shop_products;
create policy shop_products_del on public.shop_products
  for delete using ( public._is_admin() );

-- Zdarzenia: każdy (także anon) może zalogować wejście/kliknięcie
-- (tylko dozwolone typy); odczyt tylko admin.
drop policy if exists shop_events_ins on public.shop_events;
create policy shop_events_ins on public.shop_events
  for insert with check (
    event_type in ('view_shop','view_product','click_download','click_link','click_buy')
  );

drop policy if exists shop_events_select on public.shop_events;
create policy shop_events_select on public.shop_events
  for select using ( public._is_admin() );

-- ─── GRANT-y (Supabase Data API) ───────────────────────────────
grant select                       on public.shop_products to anon, authenticated;
grant insert, update, delete       on public.shop_products to authenticated;
grant select, insert               on public.shop_events   to anon, authenticated;

-- ─── RPC: zagregowane statystyki (admin only) ──────────────────
create or replace function public.shop_stats()
returns table (
  product_id   uuid,
  title        text,
  is_published boolean,
  views        bigint,
  downloads    bigint,
  link_clicks  bigint,
  buy_clicks   bigint
)
language sql security definer set search_path = public as $$
  select p.id, p.title, p.is_published,
    count(*) filter (where e.event_type = 'view_product')   as views,
    count(*) filter (where e.event_type = 'click_download') as downloads,
    count(*) filter (where e.event_type = 'click_link')     as link_clicks,
    count(*) filter (where e.event_type = 'click_buy')      as buy_clicks
  from public.shop_products p
  left join public.shop_events e on e.product_id = p.id
  where public._is_admin()
  group by p.id, p.title, p.is_published
  order by views desc nulls last, p.sort_order;
$$;

grant execute on function public.shop_stats() to anon, authenticated;

-- RPC: łączna liczba wejść na sklep (view_shop) — dla dashboardu admina
create or replace function public.shop_total_visits()
returns bigint
language sql security definer set search_path = public as $$
  select count(*) from public.shop_events
  where event_type = 'view_shop' and public._is_admin();
$$;

grant execute on function public.shop_total_visits() to anon, authenticated;

-- ─── Storage: bucket na pliki do pobrania ──────────────────────
insert into storage.buckets (id, name, public)
values ('shop-files', 'shop-files', true)
on conflict (id) do nothing;

-- Odczyt publiczny (pobieranie darmowych materiałów)
drop policy if exists shop_files_read on storage.objects;
create policy shop_files_read on storage.objects
  for select using ( bucket_id = 'shop-files' );

-- Zapis/edycja/usuwanie tylko admin
drop policy if exists shop_files_write on storage.objects;
create policy shop_files_write on storage.objects
  for insert with check ( bucket_id = 'shop-files' and public._is_admin() );

drop policy if exists shop_files_update on storage.objects;
create policy shop_files_update on storage.objects
  for update using ( bucket_id = 'shop-files' and public._is_admin() );

drop policy if exists shop_files_delete on storage.objects;
create policy shop_files_delete on storage.objects
  for delete using ( bucket_id = 'shop-files' and public._is_admin() );
