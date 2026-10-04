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

## What to know

- Scores are sent by the game itself. The database rejects impossible ones, but
  someone determined could still post a made-up plausible score.
- Names are whatever players type (up to 16 characters) and are visible to
  everyone with the link. To remove a row, delete it in Supabase's **Table Editor**.
- A player is recognised by a random id stored in their browser. Clearing site
  data, or playing on another device, makes them a new player on the board.
