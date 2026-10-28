-- Run this in Supabase → SQL Editor → New query → Run.
-- Safe to run again: it only adds what is missing.

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'pending_payment'
    check (status in ('pending_payment','paid','sent_to_printer','printed','shipped','delivered','cancelled')),
  customer_name text not null,
  phone text not null,
  email text,
  address text not null,
  pincode text not null,
  colour_id text not null,
  heavy boolean not null default false,
  qty int not null default 1 check (qty between 1 and 10),
  design jsonb not null,
  price jsonb not null,
  total int not null,
  files jsonb not null default '{}'::jsonb,
  payment_ref text,
  printer text,
  tracking text,
  notes text
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);

-- Print partners. Each one signs in at /printer with their access code.
create table if not exists public.printers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  area text,
  phone text,
  access_code text not null unique,
  active boolean not null default true
);

-- WearSketch additions to orders
alter table public.orders add column if not exists code text;
alter table public.orders add column if not exists printer_id uuid references public.printers (id) on delete set null;
alter table public.orders add column if not exists printer_cost int;
alter table public.orders add column if not exists printer_note text;
alter table public.orders add column if not exists updated_at timestamptz not null default now();
update public.orders set code = upper(left(id::text, 8)) where code is null;
create unique index if not exists orders_code_idx on public.orders (code);
create index if not exists orders_printer_idx on public.orders (printer_id, created_at desc);

-- One review per order, left by the customer on their order page.
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  name text,
  show_on_site boolean not null default false
);

-- Cart, merchant login, pickup requests and after-sale tracking (October 2026)
-- drop the old status and qty checks, whatever they are named, then add the new ones
do $$
declare r record;
begin
  for r in select conname from pg_constraint
    where conrelid = 'public.orders'::regclass and contype = 'c'
      and (pg_get_constraintdef(oid) ilike '%status%' or pg_get_constraintdef(oid) ilike '%qty%')
  loop
    execute format('alter table public.orders drop constraint %I', r.conname);
  end loop;
end $$;
alter table public.orders add constraint orders_status_check
  check (status in ('pending_payment','paid','sent_to_printer','printed','pickup_requested','shipped','delivered','cancelled'));
-- qty is now the total number of shirts in the order, across all designs
alter table public.orders add constraint orders_qty_check check (qty between 1 and 100);
alter table public.orders add column if not exists items jsonb;
alter table public.orders add column if not exists address_parts jsonb;
alter table public.orders add column if not exists pickup_requested_at timestamptz;
alter table public.orders add column if not exists status_times jsonb not null default '{}'::jsonb;
alter table public.orders add column if not exists issue text;
alter table public.orders add column if not exists issue_note text;
alter table public.orders add column if not exists refund_amount int;
alter table public.orders drop constraint if exists orders_issue_check;
alter table public.orders add constraint orders_issue_check check (issue is null or issue in ('reprint','refund','return'));

-- Merchants sign in with a login ID and a password. Existing access codes become their login ID.
alter table public.printers add column if not exists login_id text;
alter table public.printers add column if not exists password_hash text;
update public.printers set login_id = access_code where login_id is null;
create unique index if not exists printers_login_id_idx on public.printers (login_id);

-- Merchant account details, Shiprocket pickups and withdrawals (October 2026)
alter table public.printers add column if not exists address text;
alter table public.printers add column if not exists city text;
alter table public.printers add column if not exists pincode text;
alter table public.printers add column if not exists account_name text;
alter table public.printers add column if not exists account_number text;
alter table public.printers add column if not exists ifsc text;
alter table public.printers add column if not exists upi_id text;
alter table public.printers add column if not exists shiprocket_pickup text;
alter table public.orders add column if not exists shiprocket jsonb;

-- A locked copy of each merchant password so the admin can see it again (October 2026)
alter table public.printers add column if not exists password_enc text;

-- A merchant asks to withdraw what they earned; the admin pays it and marks it paid.
create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  printer_id uuid references public.printers (id) on delete set null,
  printer_name text not null,
  amount int not null check (amount > 0),
  pay_to text,
  status text not null default 'requested' check (status in ('requested','paid','rejected')),
  reference text,
  paid_at timestamptz
);
create index if not exists payouts_printer_idx on public.payouts (printer_id, created_at desc);

-- Only the server (secret key) reads or writes these tables. No public access.
alter table public.orders enable row level security;
alter table public.printers enable row level security;
alter table public.reviews enable row level security;
alter table public.payouts enable row level security;

-- Print files: private bucket, the server hands out signed upload/download links.
insert into storage.buckets (id, name, public)
values ('print-files', 'print-files', false)
on conflict (id) do nothing;
