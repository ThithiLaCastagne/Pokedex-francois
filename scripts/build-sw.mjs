import { readdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

async function files(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true })
  const result = []
  for (const entry of entries) {
    const relative = `${prefix}${entry.name}`
    if (entry.isDirectory()) result.push(...(await files(join(directory, entry.name), `${relative}/`)))
    else if (entry.name !== 'sw.js') result.push(relative)
  }
  return result.sort()
}
const assets = await files('dist')
const hash = createHash('sha256')
for (const asset of assets) hash.update(await readFile(join('dist', asset)))
const version = hash.digest('hex').slice(0, 16)
const worker = `const PREFIX = 'faune-static:' + new URL(self.registration.scope).pathname + ':';
const CACHE = PREFIX + '${version}';
const ASSETS = ${JSON.stringify(assets)};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(path => new URL(path, self.registration.scope).href))));
});
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).slice(0, -1).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  if (request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.open(CACHE).then(cache => cache.match(new URL('index.html', scope).href))));
    return;
  }
  const relative = url.pathname.slice(scope.pathname.length);
  if (ASSETS.includes(relative) || relative.startsWith('assets/')) event.respondWith(caches.keys().then(keys => Promise.all([CACHE, ...keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).reverse()].map(key => caches.open(key).then(cache => cache.match(request, { ignoreSearch: true }))))).then(hits => hits.find(Boolean) || fetch(request)));
});
`
await writeFile('dist/sw.js', worker)
console.log(`Service worker : ${assets.length} fichiers précachés (${version}).`)
