create table if not exists public.watchlist (
  id uuid primary key default gen_random_uuid(),
  ticker text not null unique,
  name text not null,
  sector text,
  exchange text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_snapshots (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  snapshot_date date not null,
  current_price numeric not null,
  daily_change_pct numeric not null,
  five_day_change_pct numeric not null,
  twenty_day_change_pct numeric not null,
  volume bigint not null default 0,
  average_volume bigint not null default 0,
  volume_vs_average numeric not null default 0,
  volatility_score integer not null default 0,
  trend_score integer not null default 0,
  data_mode text not null default 'mock',
  created_at timestamptz not null default now(),
  unique (ticker, snapshot_date)
);

create table if not exists public.news_items (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  ticker text not null,
  headline text not null,
  summary text not null,
  source text not null,
  url text,
  published_at timestamptz not null,
  sentiment text not null check (sentiment in ('positive', 'neutral', 'negative')),
  catalysts text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.signal_scores (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  scored_at timestamptz not null,
  opportunity_score integer not null,
  signal text not null check (signal in ('Strong Buy', 'Buy', 'Watch', 'Avoid', 'Sell')),
  score_breakdown jsonb not null,
  risk_controls jsonb not null,
  sentiment_score integer not null,
  news_catalyst_score integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.portfolio_holdings (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  shares numeric not null,
  average_cost numeric not null,
  market_value numeric not null default 0,
  unrealised_pnl_pct numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trades_journal (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  side text not null check (side in ('buy', 'sell', 'trim', 'add')),
  shares numeric not null,
  price numeric not null,
  thesis text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  starting_capital numeric not null default 25000,
  risk_tolerance text not null default 'balanced' check (risk_tolerance in ('cautious', 'balanced', 'aggressive')),
  max_pct_per_trade numeric not null default 8,
  max_open_positions integer not null default 6,
  max_portfolio_exposure_pct numeric not null default 35,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stock_snapshots_ticker_date_idx on public.stock_snapshots (ticker, snapshot_date desc);
create index if not exists signal_scores_ticker_scored_idx on public.signal_scores (ticker, scored_at desc);
create index if not exists news_items_ticker_published_idx on public.news_items (ticker, published_at desc);
