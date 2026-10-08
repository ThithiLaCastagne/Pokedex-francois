import assert from 'node:assert/strict'
import { mkdtemp, cp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { chromium } from 'playwright'
import { serveBuild } from './serve-test.mjs'
const temp = await mkdtemp(join(tmpdir(), 'faune-sw-test-'))
const buildWorker = resolve('scripts/build-sw.mjs')
await cp('dist', join(temp, 'dist'), { recursive: true })
await writeFile(join(temp, 'dist', 'qa-version.txt'), 'first')
execFileSync(process.execPath, [buildWorker], { cwd: temp })
const server = await serveBuild(join(temp, 'dist'))
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  headless: true,
  args: process.env.CHROMIUM_ARGS
    ? JSON.parse(process.env.CHROMIUM_ARGS)
    : ['--no-sandbox', '--disable-dev-shm-usage'],
})
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await page.goto(server.url)
  await page.locator('.observation-card').first().waitFor()
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
  assert.equal(await page.evaluate(() => fetch('./qa-version.txt').then((r) => r.text())), 'first')
  await page.getByRole('button', { name: 'Ajouter une observation', exact: true }).first().click()
  await page.getByLabel('Choisir l’espèce', { exact: true }).selectOption('fox')
  await page.getByRole('dialog').getByRole('button', { name: 'Ajouter à mon carnet' }).click()
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  await writeFile(join(temp, 'dist', 'qa-version.txt'), 'second')
  execFileSync(process.execPath, [buildWorker], { cwd: temp })
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration()
    await registration.update()
  })
  await page.getByRole('button', { name: 'Mettre à jour', exact: true }).waitFor()
  // Update stays waiting until the user chooses to apply it.
  assert.equal(await page.evaluate(() => fetch('./qa-version.txt').then((r) => r.text())), 'first')
  await page.getByRole('button', { name: 'Mettre à jour', exact: true }).click()
  await page.waitForFunction(() => !document.querySelector('.update-banner'))
  await page.locator('.observation-card').waitFor()
  assert.equal(await page.locator('.observation-card').count(), 1)
  assert.equal(await page.evaluate(() => fetch('./qa-version.txt').then((r) => r.text())), 'second')
  assert.equal(
    await page.evaluate(
      async () => (await caches.keys()).filter((key) => key.startsWith('faune-static:')).length,
    ),
    2,
  )
  await context.setOffline(true)
  await page.reload()
  await page.locator('.observation-card').waitFor()
  assert.equal(await page.locator('.observation-card').count(), 1)
  console.log(
    '✓ Mise à jour PWA explicite, carnet conservé, cache récent prioritaire et rechargement hors ligne',
  )
} finally {
  await browser.close()
  await server.close()
  await rm(temp, { recursive: true, force: true })
}
