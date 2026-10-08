import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'

export async function serveBuild(directory = 'dist', prefix = '/Pokedex-francois/') {
  const root = resolve(directory)
  const types = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
    '.webmanifest': 'application/manifest+json',
    '.json': 'application/json',
  }
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://local').pathname)
      if (!pathname.startsWith(prefix)) {
        response.writeHead(404).end()
        return
      }
      let path = resolve(root, pathname.slice(prefix.length) || 'index.html')
      if (path !== root && !path.startsWith(root + sep)) {
        response.writeHead(403).end()
        return
      }
      if ((await stat(path)).isDirectory()) path = resolve(path, 'index.html')
      response.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream')
      response.setHeader('Cache-Control', 'no-cache')
      response.end(await readFile(path))
    } catch {
      response.writeHead(404).end()
    }
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return {
    url: `http://127.0.0.1:${server.address().port}${prefix}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  }
}
