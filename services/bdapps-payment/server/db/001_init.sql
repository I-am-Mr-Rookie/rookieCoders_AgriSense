create table if not exists bdapps_subscribers (
  id bigserial primary key,
  subscriber_id text not null unique,
  subscription_status text not null default 'UNKNOWN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bdapps_otp_requests (
  reference_no text primary key,
  subscriber_id text not null,
  status_code text,
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

create table if not exists bdapps_events (
  id bigserial primary key,
  event_type text not null,
  request_id text,
  subscriber_id text,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

create index if not exists bdapps_events_received_at_idx
  on bdapps_events (received_at desc);
create index if not exists bdapps_events_request_id_idx
  on bdapps_events (request_id) where request_id is not null;

create table if not exists bdapps_transactions (
  external_trx_id text primary key,
  internal_trx_id text,
  subscriber_id text,
  amount numeric(12,2),
  currency char(3) not null default 'BDT',
  status_code text,
  status_detail text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table bdapps_transactions add column if not exists state text not null default 'UNKNOWN';
alter table bdapps_transactions add column if not exists request_payload jsonb not null default '{}'::jsonb;
alter table bdapps_transactions add column if not exists response_payload jsonb;
alter table bdapps_transactions add column if not exists last_error text;
alter table bdapps_transactions add column if not exists attempt_count integer not null default 0;

update bdapps_transactions
set state = case
  when status_code = 'S1000' then 'SUCCEEDED'
  when status_code is null then 'UNKNOWN'
  else 'FAILED'
end
where state = 'UNKNOWN' and status_code is not null;

create index if not exists bdapps_transactions_state_idx
  on bdapps_transactions (state, updated_at desc);
create index if not exists bdapps_transactions_updated_at_idx
  on bdapps_transactions (updated_at desc);
create index if not exists bdapps_transactions_subscriber_idx
  on bdapps_transactions (subscriber_id, updated_at desc);
