-- faune. Optional private social layer. Run once in a fresh Supabase project.
-- Private notebook data is never synced by this schema.
begin;

create schema if not exists faune_private;
revoke all on schema faune_private from public;
grant usage on schema faune_private to authenticated;

create table public.faune_circles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  invite_code uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);
create table public.faune_members (
  circle_id uuid not null references public.faune_circles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 30),
  color text not null check (color in ('#245a46', '#8b5c3b', '#5a688a', '#985567', '#6c7240')),
  snapshot jsonb,
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);
create index faune_members_user on public.faune_members(user_id);

-- This check rejects hidden data fields from shared collection summaries.
create function faune_private.valid_snapshot(value jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare k text; n numeric; total numeric; item jsonb;
begin
  if value is null then return true; end if;
  if jsonb_typeof(value) <> 'object' or octet_length(value::text) > 10000 then return false; end if;
  if not (value ?& array['version','id','name','color','updatedAt','total','speciesCount','catalogIds']) then return false; end if;
  for k in select jsonb_object_keys(value) loop
    if not k = any(array['version','id','name','color','updatedAt','total','speciesCount','catalogIds']) then return false; end if;
  end loop;
  if value->>'version' <> '1' or jsonb_typeof(value->'version') <> 'number' then return false; end if;
  if jsonb_typeof(value->'id') <> 'string' or not (value->>'id' ~ '^[a-zA-Z0-9-]{10,80}$') then return false; end if;
  if jsonb_typeof(value->'name') <> 'string' or char_length(btrim(value->>'name')) not between 1 and 30 then return false; end if;
  if jsonb_typeof(value->'color') <> 'string' or not (value->>'color' = any(array['#245a46','#8b5c3b','#5a688a','#985567','#6c7240'])) then return false; end if;
  if jsonb_typeof(value->'updatedAt') <> 'string' or not (value->>'updatedAt' ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$') then return false; end if;
  perform (value->>'updatedAt')::timestamptz;
  if jsonb_typeof(value->'total') <> 'number' or jsonb_typeof(value->'speciesCount') <> 'number' then return false; end if;
  total := (value->>'total')::numeric; n := (value->>'speciesCount')::numeric;
  if total < 0 or total > 5000 or total <> trunc(total) or n < 0 or n > total or n <> trunc(n) then return false; end if;
  if jsonb_typeof(value->'catalogIds') <> 'array' then return false; end if;
  if jsonb_array_length(value->'catalogIds') > 100 or jsonb_array_length(value->'catalogIds') > n then return false; end if;
  for item in select jsonb_array_elements(value->'catalogIds') loop
    if jsonb_typeof(item) <> 'string' or not (item #>> '{}' ~ '^[a-z-]{1,40}$') then return false; end if;
  end loop;
  if (select count(*) <> count(distinct x) from jsonb_array_elements(value->'catalogIds') x) then return false; end if;
  return true;
exception when others then return false;
end $$;
alter table public.faune_members add constraint faune_snapshot_valid check (faune_private.valid_snapshot(snapshot));

create table public.faune_posts (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null,
  user_id uuid not null default auth.uid(),
  species_id text check (species_id is null or species_id ~ '^[a-z-]{1,40}$'),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  scientific_name text not null default '' check (char_length(scientific_name) <= 150),
  caption text not null default '' check (char_length(caption) <= 1000),
  photo text check (photo is null or (octet_length(photo) between 30 and 320000 and photo ~ '^data:image/jpeg;base64,/9j/[A-Za-z0-9+/]*={0,2}$')),
  created_at timestamptz not null default now(),
  unique(id, circle_id),
  foreign key(circle_id, user_id) references public.faune_members(circle_id, user_id) on delete cascade
);
create index faune_posts_feed on public.faune_posts(circle_id, created_at desc);
create table public.faune_kudos (
  post_id uuid not null,
  circle_id uuid not null,
  user_id uuid not null default auth.uid(),
  primary key(post_id, user_id),
  foreign key(post_id, circle_id) references public.faune_posts(id, circle_id) on delete cascade,
  foreign key(circle_id, user_id) references public.faune_members(circle_id, user_id) on delete cascade
);
create index faune_kudos_circle on public.faune_kudos(circle_id);
create table public.faune_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null,
  circle_id uuid not null,
  user_id uuid not null default auth.uid(),
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now(),
  foreign key(post_id, circle_id) references public.faune_posts(id, circle_id) on delete cascade,
  foreign key(circle_id, user_id) references public.faune_members(circle_id, user_id) on delete cascade
);
create index faune_comments_post on public.faune_comments(post_id, created_at);
create index faune_comments_circle on public.faune_comments(circle_id);

-- Helpers run as the migration owner to avoid recursive member-table policies.
-- They take the caller identity from auth.uid(), never from a supplied user ID.
create function faune_private.is_member(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.faune_members where circle_id = target and user_id = (select auth.uid()));
$$;
create function faune_private.is_owner(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.faune_circles where id = target and owner_id = (select auth.uid()));
$$;

alter table public.faune_circles enable row level security;
alter table public.faune_members enable row level security;
alter table public.faune_posts enable row level security;
alter table public.faune_kudos enable row level security;
alter table public.faune_comments enable row level security;
revoke all on public.faune_circles, public.faune_members, public.faune_posts, public.faune_kudos, public.faune_comments from public, anon, authenticated;
grant select, delete on public.faune_circles to authenticated;
grant select on public.faune_members to authenticated;
grant update(display_name, color, snapshot) on public.faune_members to authenticated;
grant select, delete on public.faune_posts to authenticated;
grant insert(circle_id, user_id, species_id, name, scientific_name, caption, photo) on public.faune_posts to authenticated;
grant select, delete on public.faune_kudos to authenticated;
grant insert(post_id, circle_id, user_id) on public.faune_kudos to authenticated;
grant select, delete on public.faune_comments to authenticated;
grant insert(post_id, circle_id, user_id, body) on public.faune_comments to authenticated;

create policy circles_read on public.faune_circles for select to authenticated using (faune_private.is_member(id));
create policy circles_delete on public.faune_circles for delete to authenticated using (owner_id = (select auth.uid()));
create policy members_read on public.faune_members for select to authenticated using (faune_private.is_member(circle_id));
create policy members_update on public.faune_members for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy posts_read on public.faune_posts for select to authenticated using (faune_private.is_member(circle_id));
create policy posts_insert on public.faune_posts for insert to authenticated with check (user_id = (select auth.uid()) and faune_private.is_member(circle_id));
create policy posts_delete on public.faune_posts for delete to authenticated using (user_id = (select auth.uid()) or faune_private.is_owner(circle_id));
create policy kudos_read on public.faune_kudos for select to authenticated using (faune_private.is_member(circle_id));
create policy kudos_insert on public.faune_kudos for insert to authenticated with check (user_id = (select auth.uid()) and faune_private.is_member(circle_id));
create policy kudos_delete on public.faune_kudos for delete to authenticated using (user_id = (select auth.uid()));
create policy comments_read on public.faune_comments for select to authenticated using (faune_private.is_member(circle_id));
create policy comments_insert on public.faune_comments for insert to authenticated with check (user_id = (select auth.uid()) and faune_private.is_member(circle_id));
create policy comments_delete on public.faune_comments for delete to authenticated using (user_id = (select auth.uid()) or faune_private.is_owner(circle_id));

create function public.faune_create_circle(circle_name text, member_name text, member_color text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid; actor uuid := auth.uid();
begin
  if actor is null then raise exception 'Connexion requise.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text, 1));
  if (select count(*) from public.faune_circles where owner_id = actor) >= 5 then raise exception 'Vous pouvez créer cinq cercles au maximum.'; end if;
  if (select count(*) from public.faune_members where user_id = actor) >= 20 then raise exception 'Vous faites déjà partie de vingt cercles.'; end if;
  insert into public.faune_circles(name, owner_id) values (btrim(circle_name), actor) returning id into result;
  insert into public.faune_members(circle_id, user_id, display_name, color) values(result, actor, btrim(member_name), member_color);
  return result;
end $$;
create function public.faune_join_circle(invitation uuid, member_name text, member_color text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid; actor uuid := auth.uid();
begin
  if actor is null then raise exception 'Connexion requise.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text, 1));
  select id into result from public.faune_circles where invite_code = invitation for update;
  if result is null then raise exception 'Ce code d’invitation est invalide ou a expiré.'; end if;
  if exists(select 1 from public.faune_members where circle_id = result and user_id = actor) then return result; end if;
  if (select count(*) from public.faune_members where user_id = actor) >= 20 then raise exception 'Vous faites déjà partie de vingt cercles.'; end if;
  if (select count(*) from public.faune_members where circle_id = result) >= 50 then raise exception 'Ce cercle accueille déjà cinquante membres.'; end if;
  insert into public.faune_members(circle_id, user_id, display_name, color) values(result, actor, btrim(member_name), member_color);
  return result;
end $$;
create function public.faune_rotate_invite(target_circle uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if not faune_private.is_owner(target_circle) then raise exception 'Seul le créateur peut renouveler l’invitation.'; end if;
  update public.faune_circles set invite_code = gen_random_uuid() where id = target_circle returning invite_code into result;
  return result;
end $$;
create function public.faune_leave_circle(target_circle uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Connexion requise.'; end if;
  if faune_private.is_owner(target_circle) then raise exception 'Le créateur doit supprimer le cercle pour le quitter.'; end if;
  delete from public.faune_members where circle_id = target_circle and user_id = auth.uid();
end $$;
create function public.faune_remove_member(target_circle uuid, target_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not faune_private.is_owner(target_circle) then raise exception 'Seul le créateur peut retirer un membre.'; end if;
  if target_user = auth.uid() then raise exception 'Le créateur ne peut pas se retirer du cercle.'; end if;
  delete from public.faune_members where circle_id = target_circle and user_id = target_user;
end $$;

revoke all on function faune_private.is_member(uuid), faune_private.is_owner(uuid), faune_private.valid_snapshot(jsonb) from public, anon;
grant execute on function faune_private.is_member(uuid), faune_private.is_owner(uuid), faune_private.valid_snapshot(jsonb) to authenticated;
revoke all on function public.faune_create_circle(text,text,text), public.faune_join_circle(uuid,text,text), public.faune_rotate_invite(uuid), public.faune_leave_circle(uuid), public.faune_remove_member(uuid,uuid) from public, anon;
grant execute on function public.faune_create_circle(text,text,text), public.faune_join_circle(uuid,text,text), public.faune_rotate_invite(uuid), public.faune_leave_circle(uuid), public.faune_remove_member(uuid,uuid) to authenticated;

commit;
