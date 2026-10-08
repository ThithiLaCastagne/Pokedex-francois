import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const db = new PGlite()
let checks = 0
const owner = '10000000-0000-4000-8000-000000000001'
const friend = '10000000-0000-4000-8000-000000000002'
const outsider = '10000000-0000-4000-8000-000000000003'
async function actor(id, role = 'authenticated') {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id || ''])
  await db.exec(`set role ${role}`)
}
async function rejects(sql, args = []) {
  await assert.rejects(db.query(sql, args))
  checks++
}
async function count(table, number) {
  assert.equal((await db.query(`select count(*)::int as n from public.${table}`)).rows[0].n, number)
  checks++
}
try {
  await db.exec(
    `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$; grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;`,
  )
  await db.query('insert into auth.users values ($1),($2),($3)', [owner, friend, outsider])
  await db.exec(
    await readFile(new URL('../supabase/migrations/001_private_circles.sql', import.meta.url), 'utf8'),
  )
  await actor(null, 'anon')
  for (const table of ['faune_circles', 'faune_members', 'faune_posts', 'faune_comments', 'faune_kudos'])
    await rejects(`select * from public.${table}`)
  await rejects("select public.faune_create_circle('test','hacker','#245a46')")
  await actor(owner)
  const circle = (await db.query("select public.faune_create_circle('Les curieux','Alice','#245a46') as id"))
    .rows[0].id
  const code = (await db.query('select invite_code from public.faune_circles where id = $1', [circle]))
    .rows[0].invite_code
  await count('faune_circles', 1)
  await count('faune_members', 1)
  await rejects('update public.faune_circles set owner_id=$1 where id=$2', [outsider, circle])
  await actor(outsider)
  await count('faune_circles', 0)
  await count('faune_members', 0)
  await rejects(
    "insert into public.faune_members(circle_id,user_id,display_name,color) values($1,$2,'Mallory','#245a46')",
    [circle, outsider],
  )
  await rejects("insert into public.faune_posts(circle_id,user_id,name) values($1,$2,'Secret')", [
    circle,
    outsider,
  ])
  await rejects('select public.faune_rotate_invite($1)', [circle])
  await rejects("select public.faune_join_circle('ffffffff-ffff-4fff-8fff-ffffffffffff','Mallory','#245a46')")
  await actor(friend)
  await db.query("select public.faune_join_circle($1,'Bob','#5a688a')", [code])
  checks++
  await db.query("select public.faune_join_circle($1,'Bob','#5a688a')", [code])
  await count('faune_members', 2)
  await rejects('update public.faune_members set user_id=$1 where user_id=$2', [outsider, friend])
  const ownPost = (
    await db.query(
      "insert into public.faune_posts(circle_id,user_id,species_id,name,scientific_name,caption) values($1,$2,'fox','Renard','Vulpes vulpes','Quel instant !') returning id",
      [circle, friend],
    )
  ).rows[0].id
  await rejects("insert into public.faune_posts(circle_id,user_id,name) values($1,$2,'Usurpation')", [
    circle,
    owner,
  ])
  await rejects(
    "insert into public.faune_posts(circle_id,user_id,name,created_at) values($1,$2,'Date forcée','2000-01-01')",
    [circle, friend],
  )
  await rejects(
    "insert into public.faune_posts(circle_id,user_id,name,photo) values($1,$2,'Image externe','https://tracker.example/image.jpg')",
    [circle, friend],
  )
  await db.query("update public.faune_members set display_name='Usurpation' where user_id=$1", [owner])
  checks++
  assert.equal(
    (await db.query('select display_name from public.faune_members where user_id=$1', [owner])).rows[0]
      .display_name,
    'Alice',
  )
  checks++
  await rejects('select public.faune_remove_member($1,$2)', [circle, owner])
  await actor(owner)
  await db.query('insert into public.faune_kudos(post_id,circle_id,user_id) values($1,$2,$3)', [
    ownPost,
    circle,
    owner,
  ])
  await rejects('insert into public.faune_kudos(post_id,circle_id,user_id) values($1,$2,$3)', [
    ownPost,
    circle,
    owner,
  ])
  await rejects('insert into public.faune_kudos(post_id,circle_id,user_id) values($1,$2,$3)', [
    ownPost,
    circle,
    friend,
  ])
  const comment = (
    await db.query(
      "insert into public.faune_comments(post_id,circle_id,user_id,body) values($1,$2,$3,'Superbe !') returning id",
      [ownPost, circle, owner],
    )
  ).rows[0].id
  const snap = {
    version: 1,
    id: 'profile-owner-123456',
    name: 'Alice',
    color: '#245a46',
    updatedAt: new Date().toISOString(),
    total: 2,
    speciesCount: 1,
    catalogIds: ['fox'],
  }
  await db.query('update public.faune_members set snapshot=$1 where circle_id=$2 and user_id=$3', [
    JSON.stringify(snap),
    circle,
    owner,
  ])
  checks++
  for (const bad of [
    { ...snap, notes: 'private' },
    { ...snap, photos: ['secret'] },
    { ...snap, latitude: 48 },
    { ...snap, total: -1 },
    { ...snap, speciesCount: 3 },
    { ...snap, catalogIds: ['fox', 'fox'] },
    { ...snap, catalogIds: [], updatedAt: '2026-99-99T00:00:00.000Z' },
  ])
    await rejects('update public.faune_members set snapshot=$1 where circle_id=$2 and user_id=$3', [
      JSON.stringify(bad),
      circle,
      owner,
    ])
  await actor(outsider)
  for (const table of ['faune_posts', 'faune_comments', 'faune_kudos']) await count(table, 0)
  await db.query('delete from public.faune_posts where id=$1', [ownPost])
  checks++
  await actor(friend)
  await count('faune_posts', 1)
  await db.query('delete from public.faune_comments where id=$1', [comment])
  await count('faune_comments', 1)
  const other = (await db.query("select public.faune_create_circle('Autre cercle','Bob','#245a46') as id"))
    .rows[0].id
  await rejects(
    "insert into public.faune_comments(post_id,circle_id,user_id,body) values($1,$2,$3,'Cross-circle')",
    [ownPost, other, friend],
  )
  await actor(owner)
  await db.query('select public.faune_rotate_invite($1)', [circle])
  checks++
  await actor(outsider)
  await rejects("select public.faune_join_circle($1,'Mallory','#245a46')", [code])
  await actor(friend)
  await db.query('select public.faune_leave_circle($1)', [circle])
  checks++
  assert.equal(
    (await db.query('select count(*)::int as n from public.faune_circles where id=$1', [circle])).rows[0].n,
    0,
  )
  checks++
  await actor(owner)
  await count('faune_posts', 0)
  await count('faune_comments', 0)
  await count('faune_kudos', 0)
  await rejects('select public.faune_leave_circle($1)', [circle])
  await db.query('delete from public.faune_circles where id=$1', [circle])
  await count('faune_members', 0)
  console.log(
    `✓ ${checks} assertions PostgreSQL : isolation des cercles, usurpation, invitations, modération, résumé privé et suppressions en cascade.`,
  )
} finally {
  await db.close()
}
