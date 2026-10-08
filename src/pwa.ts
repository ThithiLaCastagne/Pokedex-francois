let waitingWorker: ServiceWorker | null = null
let requested = false
const listeners = new Set<() => void>()
export function onUpdateAvailable(listener: () => void) {
  listeners.add(listener)
  if (waitingWorker) listener()
  return () => {
    listeners.delete(listener)
  }
}
export function applyUpdate() {
  if (!waitingWorker) return
  requested = true
  waitingWorker.postMessage({ type: 'ACTIVATE_UPDATE' })
}
export function registerOffline() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return
  const signal = (worker: ServiceWorker | null) => {
    if (worker && navigator.serviceWorker.controller) {
      waitingWorker = worker
      listeners.forEach((listener) => listener())
    }
  }
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (requested) location.reload()
  })
  navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`)
    .then((registration) => {
      signal(registration.waiting)
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing
        installing?.addEventListener('statechange', () => {
          if (installing.state === 'installed') signal(registration.waiting)
        })
      })
    })
    .catch((error) => {
      if (import.meta.env.DEV) console.warn('Offline cache unavailable', error)
    })
}
