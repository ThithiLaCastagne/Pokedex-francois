export type Profile = {
  id: string
  name: string
  color: string
  goal: number
  demoDismissed: boolean
  wishlist: string[]
}
export const profileColors = ['#245a46', '#8b5c3b', '#5a688a', '#985567', '#6c7240']
const KEY = 'faune-profile-v2'

export function readProfile(): Profile {
  const defaults: Profile = {
    id: crypto.randomUUID(),
    name: 'Explorateur',
    color: profileColors[0],
    goal: 3,
    demoDismissed: false,
    wishlist: [],
  }
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (!value || typeof value !== 'object') return defaults
    return {
      id: typeof value.id === 'string' && /^[a-zA-Z0-9-]{10,80}$/.test(value.id) ? value.id : defaults.id,
      name:
        typeof value.name === 'string' && value.name.trim() ? value.name.trim().slice(0, 30) : defaults.name,
      color: profileColors.includes(value.color) ? value.color : defaults.color,
      goal: [1, 3, 5, 10].includes(value.goal) ? value.goal : defaults.goal,
      demoDismissed: value.demoDismissed === true,
      wishlist: Array.isArray(value.wishlist)
        ? ([
            ...new Set(
              value.wishlist.filter(
                (item: unknown): item is string => typeof item === 'string' && /^[a-z-]{1,40}$/.test(item),
              ),
            ),
          ].slice(0, 100) as string[])
        : [],
    }
  } catch {
    return defaults
  }
}

export function saveProfile(profile: Profile): void {
  localStorage.setItem(KEY, JSON.stringify(profile))
}
