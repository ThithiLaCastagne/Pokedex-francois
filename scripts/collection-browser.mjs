import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { readFile, mkdir } from 'node:fs/promises'
import { serveBuild } from './serve-test.mjs'
const server = await serveBuild()
const options = {
  executablePath: process.env.CHROMIUM_PATH || undefined,
  headless: true,
  args: process.env.CHROMIUM_ARGS
    ? JSON.parse(process.env.CHROMIUM_ARGS)
    : ['--no-sandbox', '--disable-dev-shm-usage'],
}
const browsers = []
const failures = []
const check = (label) => console.log(`✓ ${label}`)
async function client(width = 390) {
  const browser = await chromium.launch(options)
  browsers.push(browser)
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    locale: 'fr-FR',
    acceptDownloads: true,
  })
  const page = await context.newPage()
  page.on('pageerror', (error) => failures.push(error.message))
  await page.goto(server.url)
  await page.locator('.observation-card').first().waitFor()
  return { page, context }
}
async function add(page, species = 'fox', note = '') {
  await page.getByRole('button', { name: 'Ajouter une observation', exact: true }).first().click()
  const form = page.getByRole('dialog', { name: 'Nouvelle observation' })
  await form.getByLabel('Choisir l’espèce', { exact: true }).selectOption(species)
  if (note) await form.getByLabel('Notes personnelles', { exact: false }).fill(note)
  await form.getByRole('button', { name: 'Ajouter à mon carnet', exact: true }).click()
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
}
async function nav(page, name) {
  await page.locator('.mobile-nav').getByRole('button', { name, exact: true }).click()
}
async function profile(page, name) {
  await nav(page, 'Profil')
  await page.getByLabel('Votre pseudonyme').fill(name)
  await page.getByRole('button', { name: 'Enregistrer mon profil' }).click()
}
async function shareLink(page) {
  await page.getByRole('button', { name: 'Partager ma collection', exact: true }).first().click()
  const dialog = page.getByRole('dialog')
  const link = await dialog.getByLabel('Votre lien de collection').inputValue()
  await dialog.getByRole('button', { name: 'Fermer', exact: true }).click()
  return link
}
try {
  const alice = await client()
  const page = alice.page
  await profile(page, 'Alice 🦊')
  await add(page, 'fox', 'PRIVATE NOTE DO NOT SHARE')
  assert.equal(await page.locator('.observation-card').count(), 1)
  assert.deepEqual(await page.locator('.stat-value').allTextContents(), ['01', '01', '00', '00'])
  await add(page, 'fox')
  assert.deepEqual(await page.locator('.stat-value').allTextContents(), ['02', '01', '00', '00'])
  check('Ajout sans photo et décompte distinct des observations et des espèces')
  await page.getByRole('button', { name: 'Vue liste', exact: true }).click()
  await page.locator('.gallery.list-view').waitFor()
  await page.getByRole('button', { name: 'Chronologie', exact: true }).click()
  assert.equal(await page.locator('.timeline-item').count(), 2)
  await page.getByRole('button', { name: 'Vue grille', exact: true }).click()
  await page.getByLabel('Rechercher une observation').fill('aucun-resultat')
  await page.getByText('Aucune rencontre avec ces filtres.').waitFor()
  await page.getByRole('button', { name: 'Effacer les filtres', exact: true }).click()
  await page.getByRole('button', { name: 'Filtres', exact: true }).click()
  await page.getByLabel('Date de début').fill('2026-10-08')
  await page.getByLabel('Date de fin').fill('2026-01-01')
  await page.getByRole('alert').filter({ hasText: 'La date de fin' }).waitFor()
  await page.getByRole('button', { name: 'Tout réinitialiser', exact: true }).click()
  check('Vues, recherche, absence de résultats et période incohérente explicites')
  await nav(page, 'Explorer')
  await page.locator('.album-card').first().waitFor()
  assert.equal(await page.locator('.album-card.observed').count(), 1)
  await page.getByLabel('Rechercher dans le guide').fill('rougegorge')
  await page.getByRole('button', { name: 'Ajouter Rougegorge familier aux envies' }).click()
  await page.getByLabel('Rechercher dans le guide').fill('')
  await page.getByLabel('Filtrer l’album').selectOption('wishlist')
  assert.equal(await page.locator('.album-card').count(), 1)
  await page.reload()
  await page.getByLabel('Filtrer l’album').selectOption('wishlist')
  assert.equal(await page.locator('.album-card').count(), 1)
  await page
    .getByRole('button', { name: 'Ajouter une observation de Rougegorge familier', exact: true })
    .click()
  assert.equal(await page.getByLabel('Choisir l’espèce', { exact: true }).inputValue(), 'robin')
  await page.getByRole('dialog').getByRole('button', { name: 'Ajouter à mon carnet' }).click()
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  check('Album obtenu / à découvrir, envies persistantes et ajout prérempli depuis le guide')
  await nav(page, 'Progrès')
  await page.locator('.achievement-card').first().waitFor()
  assert.equal(await page.locator('.activity-cell[role="img"]').count(), 84)
  assert((await page.locator('.achievement-card.unlocked').count()) >= 1)
  check('Badges et calendrier calculés à partir du carnet, sans activité inventée')
  const aliceLink = await shareLink(page)
  const token = aliceLink.split('#collection=')[1]
  const payload = JSON.parse(Buffer.from(token, 'base64url').toString())
  assert.equal(payload.name, 'Alice 🦊')
  assert.equal(payload.total, 3)
  assert.equal(payload.speciesCount, 2)
  assert.deepEqual(payload.catalogIds, ['fox', 'robin'])
  assert(!JSON.stringify(payload).includes('PRIVATE'))
  assert(!('photos' in payload))
  assert(!('regionId' in payload))
  assert(!('observations' in payload))
  const bob = await client(375)
  await profile(bob.page, 'Bob')
  await add(bob.page, 'fox')
  await bob.page.goto(aliceLink)
  let received = bob.page.getByRole('dialog', { name: 'La collection de Alice 🦊' })
  await received.waitFor()
  assert.deepEqual(await received.locator('.comparison-stats strong').allTextContents(), ['1', '1', '2'])
  await received.getByRole('button', { name: 'Garder dans mes proches' }).click()
  await received.waitFor({ state: 'hidden' })
  assert.equal(await bob.page.locator('.friend-card').count(), 1)
  await bob.page.getByRole('button', { name: 'Comparer nos collections' }).click()
  await bob.page.keyboard.press('Escape')
  await bob.page.reload()
  await bob.page.locator('.friend-card').waitFor()
  assert.equal(await bob.page.locator('.friend-card').count(), 1)
  await nav(bob.page, 'Carnet')
  assert.equal(await bob.page.locator('.observation-card').count(), 1)
  check('Lien Unicode lu sur un autre appareil, comparaison et sauvegarde du proche sans altérer son carnet')
  await nav(bob.page, 'Cercle')
  await bob.page.getByRole('button', { name: 'J’ai reçu un lien', exact: true }).count()
  await bob.page.getByRole('button', { name: 'Ajouter un proche', exact: true }).click()
  await bob.page.getByLabel('Lien de collection').fill('https://example.org/#collection=INVALID')
  await bob.page.getByRole('button', { name: 'Découvrir sa collection' }).click()
  await bob.page.getByRole('alert').waitFor()
  await bob.page.keyboard.press('Escape')
  await bob.page.getByRole('button', { name: 'Cercle connecté', exact: true }).click()
  await bob.page.getByText('Le cercle connecté reste à activer', { exact: true }).waitFor()
  assert.equal(await bob.page.getByRole('button', { name: 'Recevoir mon email de connexion' }).count(), 0)
  check('Lien malformé refusé et absence de serveur annoncée sans faux réseau social')
  await page.getByRole('button', { name: 'Partager ma collection', exact: true }).first().click()
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('dialog').getByRole('button', { name: 'Carte souvenir' }).click()
  const download = await downloadEvent
  assert.equal((await readFile(await download.path())).subarray(1, 4).toString(), 'PNG')
  await page.keyboard.press('Escape')
  check('Carte de collection PNG téléchargeable')
  // The production worker must cache lazy views and relative asset paths on a project subpath.
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
  await alice.context.setOffline(true)
  await page.reload()
  await page.getByRole('button', { name: 'Partager ma collection', exact: true }).first().waitFor()
  await nav(page, 'Carnet')
  await page.locator('.observation-card').first().waitFor()
  assert.equal(await page.locator('.observation-card').count(), 3)
  await nav(page, 'Explorer')
  await page.locator('.album-card').first().waitFor()
  await nav(page, 'Profil')
  await page.getByLabel('Votre pseudonyme').waitFor()
  assert.equal(await page.getByLabel('Votre pseudonyme').inputValue(), 'Alice 🦊')
  await alice.context.setOffline(false)
  check('Hors-ligne : rechargement, données, profil et vues différées au sous-chemin GitHub Pages')
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const route of ['journal', 'explore', 'circle', 'progress', 'settings']) {
      await page.goto(server.url + '#' + route)
      await page.locator('h1').waitFor()
      assert(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${route} déborde à ${width}px`,
      )
    }
  }
  check('Aucun débordement horizontal sur cinq vues et six largeurs de 320 à 1440 px')
  assert.deepEqual(failures, [])
  await mkdir('test-results', { recursive: true })
  await page.goto(server.url + '#journal')
  await page.locator('.observation-card').first().waitFor()
  await page.evaluate(async () => {
    for (const image of document.images) image.loading = 'eager'
    await document.fonts.ready
    await Promise.all([...document.images].map((img) => img.decode().catch(() => {})))
  })
  await page.screenshot({ path: 'test-results/journal-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'test-results/journal-mobile.png', fullPage: true })
  check('Aucune erreur JavaScript dans les parcours collection et partage')
} finally {
  await Promise.all(browsers.map((browser) => browser.close()))
  await server.close()
}
