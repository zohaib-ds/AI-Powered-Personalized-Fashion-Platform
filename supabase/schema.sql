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

-- Only the server (secret key) reads or writes these tables. No public access.
alter table public.orders enable row level security;
alter table public.printers enable row level security;
alter table public.reviews enable row level security;

-- Print files: private bucket, the server hands out signed upload/download links.
insert into storage.buckets (id, name, public)
values ('print-files', 'print-files', false)
on conflict (id) do nothing;
