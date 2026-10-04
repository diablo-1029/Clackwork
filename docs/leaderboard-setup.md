# Shared leaderboard setup

The shared leaderboard keeps one row per player (their best shift) in a free
[Supabase](https://supabase.com) database. The game calls two database functions
directly, so there is no server of our own to run. Until this is set up, the
Leaderboard screen shows only the player's own best shifts.

## 1. Create the database

1. Create a free Supabase account and a new project (any name and region).
2. Open **SQL Editor**, paste everything in the block below, and press **Run**.

```sql
create table public.scores (
  player_id uuid primary key,
  name text not null check (char_length(name) between 1 and 16),
  score integer not null check (score between 0 and 500000),
  products integer not null check (products between 0 and 500),
  updated_at timestamptz not null default now()
);

-- No policies on purpose: nothing can read or write the table directly.
-- The game can only use the two functions below.
alter table public.scores enable row level security;

create or replace function public.submit_score(p_player uuid, p_name text, p_score integer, p_products integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(left(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 16));
begin
  if p_player is null or v_name = '' or p_score < 0 or p_score > 500000 or p_products < 0 or p_products > 500 then
    raise exception 'invalid score';
  end if;
  -- More than this per product made is not possible in the game.
  if p_score > (p_products + 1) * 2500 then
    raise exception 'implausible score';
  end if;

  insert into scores (player_id, name, score, products)
  values (p_player, v_name, p_score, p_products)
  on conflict (player_id) do update
    set name = excluded.name,
        products = case when excluded.score > scores.score then excluded.products else scores.products end,
        updated_at = case when excluded.score > scores.score then now() else scores.updated_at end,
        score = greatest(scores.score, excluded.score);
end;
$$;

create or replace function public.top_scores(p_player uuid default null, p_limit integer default 20)
returns table (rank bigint, name text, score integer, products integer, you boolean)
language sql
security definer
set search_path = public
stable
as $$
  select row_number() over (order by s.score desc, s.updated_at asc),
         s.name, s.score, s.products, coalesce(s.player_id = p_player, false)
  from scores s
  order by s.score desc, s.updated_at asc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

revoke all on function public.submit_score(uuid, text, integer, integer) from public;
revoke all on function public.top_scores(uuid, integer) from public;
grant execute on function public.submit_score(uuid, text, integer, integer) to anon;
grant execute on function public.top_scores(uuid, integer) to anon;
```

## 2. Give the game the two settings

In Supabase open **Project Settings → API** and copy the **Project URL** and the
**anon / publishable** key. Both are meant to be public; do not use the
`service_role` key.

Create a file named `.env.local` in the project folder (it is not committed):

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Restart `npm run dev`, or run `npm run deploy` to publish a build that has the
shared board switched on.

## 3. Safeguards for a public release (run once, after step 1)

This adds a name filter, a limit of one post every 20 seconds per device, a
tighter ceiling on impossible scores, and a "This week" board. Paste it into
the **SQL Editor** and press **Run**. It keeps every score already on the board.

```sql
alter table public.scores
  add column if not exists week_start date,
  add column if not exists week_score integer not null default 0,
  add column if not exists week_products integer not null default 0,
  add column if not exists last_post timestamptz;

create or replace function public.submit_score(p_player uuid, p_name text, p_score integer, p_products integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(left(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 16));
  v_flat text;
  v_week date := date_trunc('week', now())::date;
  v_last timestamptz;
begin
  if p_player is null or v_name = '' or p_score < 0 or p_score > 60000 or p_products < 0 or p_products > 80 then
    raise exception 'invalid score';
  end if;
  -- More than this per product made is not possible in the game.
  if p_score > (p_products + 1) * 2500 then
    raise exception 'implausible score';
  end if;

  -- The same filter the game applies before posting: letters only, common swaps undone.
  v_flat := regexp_replace(translate(lower(v_name), '013457@$!', 'oieastasi'), '[^a-z]', '', 'g');
  if v_flat = '' or v_flat ~ '(fuck|shit|bitch|cunt|dick|cock|pussy|asshole|bastard|slut|whore|nigg|fag|retard|rape|nazi|hitler|porn|penis|vagina)' then
    v_name := 'Player';
  end if;

  select last_post into v_last from scores where player_id = p_player;
  if v_last is not null and now() - v_last < interval '20 seconds' then
    raise exception 'too many posts';
  end if;

  insert into scores (player_id, name, score, products, week_start, week_score, week_products, last_post)
  values (p_player, v_name, p_score, p_products, v_week, p_score, p_products, now())
  on conflict (player_id) do update
    set name = excluded.name,
        last_post = now(),
        products = case when excluded.score > scores.score then excluded.products else scores.products end,
        updated_at = case when excluded.score > scores.score then now() else scores.updated_at end,
        score = greatest(scores.score, excluded.score),
        week_products = case
          when scores.week_start is distinct from v_week or excluded.week_score > scores.week_score then excluded.week_products
          else scores.week_products end,
        week_score = case
          when scores.week_start is distinct from v_week then excluded.week_score
          else greatest(scores.week_score, excluded.week_score) end,
        week_start = v_week;
end;
$$;

drop function if exists public.top_scores(uuid, integer);

create or replace function public.top_scores(p_player uuid default null, p_limit integer default 20, p_period text default 'all')
returns table (rank bigint, name text, score integer, products integer, you boolean)
language sql
security definer
set search_path = public
stable
as $$
  with board as (
    select s.player_id,
           s.name,
           case when p_period = 'week' then s.week_score else s.score end as score,
           case when p_period = 'week' then s.week_products else s.products end as products,
           s.updated_at
    from scores s
    where p_period <> 'week' or s.week_start = date_trunc('week', now())::date
  ),
  ranked as (
    select row_number() over (order by b.score desc, b.updated_at asc) as rank, b.*
    from board b
    where b.score > 0
  )
  -- The top of the board, then the asking player's own row if it is further down.
  select r.rank, r.name, r.score, r.products, coalesce(r.player_id = p_player, false)
  from ranked r
  where r.rank <= least(greatest(coalesce(p_limit, 20), 1), 100) or r.player_id = p_player
  order by r.rank;
$$;

revoke all on function public.submit_score(uuid, text, integer, integer) from public;
revoke all on function public.top_scores(uuid, integer, text) from public;
grant execute on function public.submit_score(uuid, text, integer, integer) to anon;
grant execute on function public.top_scores(uuid, integer, text) to anon;
```

Until this is run the game still works: the all-time board shows, and
"This week" says it cannot be reached.

## What to know

- Scores are sent by the game itself. The database rejects impossible ones, but
  someone determined could still post a made-up plausible score.
- Names are what players type (up to 16 characters), minus a list of offensive
  words, and are visible to everyone with the link. To remove a row, delete it in Supabase's **Table Editor**.
- A player is recognised by a random id stored in their browser. Clearing site
  data, or playing on another device, makes them a new player on the board.
