-- Run this once in Supabase → SQL Editor → New query.
-- Creates the orders table and a private bucket for print files.

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

-- Only the server (service role key) touches orders. No public access.
alter table public.orders enable row level security;

-- Print files: private bucket, the server hands out signed upload/download links.
insert into storage.buckets (id, name, public)
values ('print-files', 'print-files', false)
on conflict (id) do nothing;
