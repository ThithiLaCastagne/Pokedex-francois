import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from './preferences'
import type { Observation } from './types'
import type { CollectionSnapshot } from './sharing'
import { observationSpecies } from './lib'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as
  string | undefined
export const cloudConfigured = Boolean(url && key)
let client: SupabaseClient | undefined
export function cloud(): SupabaseClient {
  if (!url || !key) throw new Error('Le cercle connecté n’est pas activé pour cette application.')
  if (!client)
    client = createClient(url, key, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  return client
}

export interface Circle {
  id: string
  name: string
  owner_id: string
  invite_code: string
  created_at: string
}
export interface Member {
  circle_id: string
  user_id: string
  display_name: string
  color: string
  snapshot: CollectionSnapshot | null
  joined_at: string
}
export interface Post {
  id: string
  circle_id: string
  user_id: string
  species_id: string | null
  name: string
  scientific_name: string
  caption: string
  photo: string | null
  created_at: string
}
export interface Kudos {
  post_id: string
  circle_id: string
  user_id: string
}
export interface Comment {
  id: string
  post_id: string
  circle_id: string
  user_id: string
  body: string
  created_at: string
}
export interface Feed {
  circle: Circle
  members: Member[]
  posts: Post[]
  kudos: Kudos[]
  comments: Comment[]
}

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}
export async function listCircles(): Promise<Circle[]> {
  const { data, error } = await cloud()
    .from('faune_circles')
    .select('*')
    .order('created_at', { ascending: false })
  check(error)
  return (data || []) as Circle[]
}
export async function loadFeed(circleId: string): Promise<Feed> {
  const [circle, members, posts] = await Promise.all([
    cloud().from('faune_circles').select('*').eq('id', circleId).single(),
    cloud().from('faune_members').select('*').eq('circle_id', circleId).order('joined_at'),
    cloud()
      .from('faune_posts')
      .select('*')
      .eq('circle_id', circleId)
      .order('created_at', { ascending: false })
      .limit(50),
  ])
  check(circle.error)
  check(members.error)
  check(posts.error)
  const ids = (posts.data || []).map((item) => item.id)
  if (!ids.length)
    return {
      circle: circle.data as Circle,
      members: members.data as Member[],
      posts: [],
      kudos: [],
      comments: [],
    }
  const [kudos, comments] = await Promise.all([
    cloud().from('faune_kudos').select('*').eq('circle_id', circleId).in('post_id', ids).limit(2500),
    cloud()
      .from('faune_comments')
      .select('*')
      .eq('circle_id', circleId)
      .in('post_id', ids)
      .order('created_at')
      .limit(2500),
  ])
  check(kudos.error)
  check(comments.error)
  return {
    circle: circle.data as Circle,
    members: members.data as Member[],
    posts: posts.data as Post[],
    kudos: kudos.data as Kudos[],
    comments: comments.data as Comment[],
  }
}
export async function createCircle(name: string, profile: Profile): Promise<string> {
  const { data, error } = await cloud().rpc('faune_create_circle', {
    circle_name: name.trim(),
    member_name: profile.name,
    member_color: profile.color,
  })
  check(error)
  return data as string
}
export async function joinCircle(code: string, profile: Profile): Promise<string> {
  const { data, error } = await cloud().rpc('faune_join_circle', {
    invitation: code.trim(),
    member_name: profile.name,
    member_color: profile.color,
  })
  check(error)
  return data as string
}
export async function updateSnapshot(
  circleId: string,
  userId: string,
  profile: Profile,
  snapshot: CollectionSnapshot | null,
) {
  const { error } = await cloud()
    .from('faune_members')
    .update({ display_name: profile.name, color: profile.color, snapshot })
    .eq('circle_id', circleId)
    .eq('user_id', userId)
  check(error)
}

async function thumbnail(photo: string): Promise<string> {
  const img = new Image()
  const ready = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Cette photo ne peut pas être préparée.'))
  })
  img.src = photo
  await ready
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, 720 / Math.max(img.naturalWidth, img.naturalHeight))
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Impossible de préparer la photo.')
  context.fillStyle = '#fff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(img, 0, 0, canvas.width, canvas.height)
  let result = canvas.toDataURL('image/jpeg', 0.76)
  if (result.length > 320000) result = canvas.toDataURL('image/jpeg', 0.5)
  if (result.length > 320000)
    throw new Error(
      'Cette photo est trop détaillée pour le cercle. Publiez sans photo ou choisissez une image plus petite.',
    )
  return result
}
export async function publishObservation(
  circleId: string,
  userId: string,
  observation: Observation,
  caption: string,
  includePhoto: boolean,
) {
  const animal = observationSpecies(observation)
  const { error } = await cloud()
    .from('faune_posts')
    .insert({
      circle_id: circleId,
      user_id: userId,
      species_id: observation.speciesId,
      name: animal?.name || 'Une rencontre à identifier',
      scientific_name: animal?.scientificName || '',
      caption: caption.trim(),
      photo: includePhoto && observation.photos[0] ? await thumbnail(observation.photos[0]) : null,
    })
  check(error)
}
export async function toggleKudos(post: Post, userId: string, active: boolean) {
  const query = active
    ? cloud().from('faune_kudos').delete().eq('post_id', post.id).eq('user_id', userId)
    : cloud().from('faune_kudos').insert({ post_id: post.id, circle_id: post.circle_id, user_id: userId })
  const { error } = await query
  check(error)
}
export async function addComment(post: Post, userId: string, body: string) {
  const { error } = await cloud()
    .from('faune_comments')
    .insert({ post_id: post.id, circle_id: post.circle_id, user_id: userId, body: body.trim() })
  check(error)
}
export async function removePost(id: string) {
  const { error } = await cloud().from('faune_posts').delete().eq('id', id)
  check(error)
}
export async function removeComment(id: string) {
  const { error } = await cloud().from('faune_comments').delete().eq('id', id)
  check(error)
}
export async function leaveCircle(id: string) {
  const { error } = await cloud().rpc('faune_leave_circle', { target_circle: id })
  check(error)
}
export async function removeMember(circleId: string, userId: string) {
  const { error } = await cloud().rpc('faune_remove_member', { target_circle: circleId, target_user: userId })
  check(error)
}
export async function deleteCircle(id: string) {
  const { error } = await cloud().from('faune_circles').delete().eq('id', id)
  check(error)
}
export async function rotateInvite(id: string) {
  const { error } = await cloud().rpc('faune_rotate_invite', { target_circle: id })
  check(error)
}
