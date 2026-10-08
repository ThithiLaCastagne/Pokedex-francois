import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'

const { chromium } = createRequire(import.meta.url)('playwright')
const url = process.env.TEST_URL || 'http://127.0.0.1:5173'
const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined)
const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const failures = []
const check = message => process.stdout.write(`✓ ${message}\n`)

async function observations(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('pokedex-faune-private-v1', 1)
    request.onsuccess = () => {
      const db = request.result
      const read = db.transaction('observations', 'readonly').objectStore('observations').getAll()
      read.onsuccess = () => { resolve(read.result); db.close() }
      read.onerror = () => { reject(read.error); db.close() }
    }
    request.onerror = () => reject(request.error)
  }))
}

async function openPage(context) {
  const page = await context.newPage()
  page.on('pageerror', error => failures.push(error.message))
  await page.goto(url)
  await page.locator('.observation-card').first().waitFor()
  return page
}

async function focusStaysInDialog(page, count = 20) {
  for (let index = 0; index < count; index++) {
    await page.keyboard.press('Tab')
    assert(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]'))), 'Keyboard focus escaped the modal')
  }
}

try {
  const desktop = await browser.newContext({ viewport: { width: 1360, height: 1000 }, locale: 'fr-FR', acceptDownloads: true })
  const page = await openPage(desktop)
  await page.locator('.card-image').first().click()
  let dialog = page.getByRole('dialog')
  assert.equal(await dialog.getByRole('button', { name: 'Modifier', exact: true }).count(), 0)
  assert.equal(await dialog.getByRole('button', { name: 'Supprimer', exact: true }).count(), 0)
  assert.equal(await dialog.getByRole('button', { name: 'Ajouter aux favoris', exact: true }).count(), 0)
  await page.keyboard.press('Escape')
  check('Les exemples sont en lecture seule et se ferment au clavier')

  const data = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 80; canvas.height = 60
    const context = canvas.getContext('2d')
    context.fillStyle = '#507540'; context.fillRect(0, 0, 80, 60)
    return canvas.toDataURL('image/jpeg', 0.9)
  })
  const jpeg = Buffer.from(data.split(',')[1], 'base64')
  const gpsMarker = Buffer.from('Exif\0\0GPS_TEST_48.85_2.35')
  const markerLength = gpsMarker.length + 2
  const taggedPhoto = Buffer.concat([jpeg.subarray(0, 2), Buffer.from([0xff, 0xe1, markerLength >> 8, markerLength & 255]), gpsMarker, jpeg.subarray(2)])
  const photo = { name: 'rencontre.jpg', mimeType: 'image/jpeg', buffer: taggedPhoto }

  await page.getByRole('button', { name: 'Ajouter une observation', exact: true }).first().click()
  dialog = page.getByRole('dialog', { name: 'Nouvelle observation' })
  await dialog.getByRole('button', { name: 'Ajouter à mon carnet', exact: true }).click()
  await dialog.getByRole('alert').filter({ hasText: 'au moins une photo' }).waitFor()
  const upload = dialog.getByLabel('Importer des photos personnelles')
  await upload.setInputFiles(Array.from({ length: 6 }, (_, index) => ({ ...photo, name: `photo-${index}.jpg` })))
  await dialog.getByRole('alert').filter({ hasText: '5 photos' }).waitFor()
  await upload.setInputFiles({ name: 'unsupported.heic', mimeType: 'image/heic', buffer: jpeg })
  await dialog.getByRole('alert').filter({ hasText: 'Format non pris en charge' }).waitFor()
  await upload.setInputFiles([photo, { ...photo, name: 'seconde-rencontre.jpg' }])
  await page.waitForFunction(() => document.querySelectorAll('.photo-preview').length === 2)
  assert.match(await dialog.locator('.photo-uploader').innerText(), /15 Mo/)
  check('Import réel, formats et limite de cinq photos validés')

  await dialog.getByLabel('Choisir l’espèce', { exact: true }).selectOption('__custom')
  await dialog.getByLabel('Nom de l’espèce', { exact: true }).fill('Chouette de test')
  await dialog.getByLabel('Nom scientifique', { exact: false }).fill('Strix aluco')
  await dialog.locator('summary').click()
  await dialog.getByLabel('Habitat', { exact: true }).fill('Forêts et parcs, information personnelle à vérifier.')
  await dialog.getByLabel('Alimentation', { exact: true }).fill('Petits mammifères.')
  await dialog.getByLabel('Répartition', { exact: true }).fill('Europe.')
  await dialog.getByLabel('Classe', { exact: true }).fill('Aves')
  await dialog.getByLabel('Famille', { exact: true }).fill('Strigidae')
  await dialog.getByLabel('Genre', { exact: true }).fill('Strix')
  await dialog.getByLabel('Notes personnelles', { exact: false }).fill('Un souvenir à conserver. <script>test</script>')
  await desktop.grantPermissions(['geolocation'])
  await desktop.setGeolocation({ latitude: 48.85, longitude: 2.35 })
  await dialog.getByRole('button', { name: 'Suggérer ma région actuelle' }).click()
  await dialog.getByRole('status').filter({ hasText: 'Région suggérée' }).waitFor()
  await focusStaysInDialog(page)
  await dialog.getByRole('button', { name: 'Ajouter à mon carnet', exact: true }).click()
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  let saved = await observations(page)
  assert.equal(saved.length, 1)
  assert.equal(saved[0].customSpecies.name, 'Chouette de test')
  assert.equal(saved[0].customSpecies.scientificName, 'Strix aluco')
  assert.deepEqual(saved[0].customSpecies.taxonomy, [{ rank: 'Classe', name: 'Aves' }, { rank: 'Famille', name: 'Strigidae' }, { rank: 'Genre', name: 'Strix' }])
  assert.equal(saved[0].photos.length, 2)
  assert(saved[0].regionId)
  assert.equal('latitude' in saved[0], false)
  assert.equal('longitude' in saved[0], false)
  assert.equal(Buffer.from(saved[0].photos[0].split(',')[1], 'base64').includes(gpsMarker), false)
  check('Observation manuelle, région sans coordonnées et métadonnées GPS retirées')

  await page.reload()
  await page.getByRole('button', { name: 'Ouvrir Chouette de test', exact: true }).click()
  dialog = page.getByRole('dialog', { name: 'Chouette de test' })
  assert.match(await dialog.innerText(), /Non évalué/)
  assert.match(await dialog.innerText(), /Taxonomie renseignée manuellement/)
  assert.deepEqual(await dialog.locator('.taxonomy-node strong').allTextContents(), ['Aves', 'Strigidae', 'Strix'])
  assert.match(await dialog.getByRole('link', { name: /Wikipédia/ }).getAttribute('href'), /Strix%20aluco/)
  await dialog.getByRole('button', { name: 'Photo suivante' }).click()
  assert.match(await dialog.locator('.photo-controls').innerText(), /2 \/ 2/)
  await dialog.getByRole('button', { name: 'Ajouter aux favoris' }).click()
  await dialog.getByRole('button', { name: 'Retirer des favoris' }).waitFor()
  assert.equal((await observations(page))[0].favorite, true)
  await dialog.getByRole('button', { name: 'Modifier', exact: true }).click()
  dialog = page.getByRole('dialog', { name: 'Modifier l’observation' })
  assert.equal(await dialog.getByLabel('Nom de l’espèce', { exact: true }).inputValue(), 'Chouette de test')
  await dialog.locator('summary').click()
  assert.equal(await dialog.getByLabel('Classe', { exact: true }).inputValue(), 'Aves')
  assert.equal(await dialog.getByLabel('Famille', { exact: true }).inputValue(), 'Strigidae')
  assert.equal(await dialog.getByLabel('Genre', { exact: true }).inputValue(), 'Strix')
  await dialog.getByLabel('Notes personnelles', { exact: false }).fill('Rencontre au crépuscule, note modifiée.')
  await dialog.getByRole('button', { name: 'Retirer la photo 2' }).click()
  await dialog.getByRole('button', { name: 'Enregistrer les modifications' }).click()
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  saved = await observations(page)
  assert.equal(saved[0].photos.length, 1)
  assert.equal(saved[0].notes, 'Rencontre au crépuscule, note modifiée.')
  assert.equal(saved[0].favorite, true)
  check('Persistance au rechargement, galerie, favoris et modification conservés')

  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Sauvegarder', exact: true }).click()
  const download = await downloadEvent
  const backupBuffer = await readFile(await download.path())
  const backup = JSON.parse(backupBuffer.toString())
  assert.equal(backup.observations.length, 1)
  assert.equal(backup.observations[0].customSpecies.name, 'Chouette de test')

  await page.getByRole('button', { name: 'Ouvrir Chouette de test', exact: true }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Supprimer', exact: true }).click()
  assert.equal((await observations(page)).length, 1)
  await dialog.getByRole('button', { name: 'Conserver', exact: true }).click()
  assert.equal((await observations(page)).length, 1)
  await dialog.getByRole('button', { name: 'Supprimer', exact: true }).click()
  await dialog.getByRole('button', { name: 'Supprimer définitivement' }).click()
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  assert.equal((await observations(page)).length, 0)
  await page.getByLabel('Importer une sauvegarde', { exact: true }).setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: backupBuffer })
  await page.getByRole('button', { name: 'Ouvrir Chouette de test', exact: true }).waitFor()
  assert.equal((await observations(page)).length, 1)
  await page.getByLabel('Importer une sauvegarde', { exact: true }).setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: backupBuffer })
  await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent?.includes('0 observation'))
  assert.equal((await observations(page)).length, 1)
  check('Suppression confirmée, export complet, restauration et import sans doublons')

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR' })
  const mobilePage = await openPage(mobile)
  await mobilePage.getByRole('button', { name: 'Ajouter une observation', exact: true }).first().click()
  const mobileDialog = mobilePage.getByRole('dialog', { name: 'Nouvelle observation' })
  assert.equal(await mobileDialog.getByLabel('Prendre une photo avec l’appareil').getAttribute('capture'), 'environment')
  const submitButton = mobileDialog.getByRole('button', { name: 'Ajouter à mon carnet', exact: true })
  const buttonBounds = await submitButton.boundingBox()
  assert(buttonBounds.y >= 0 && buttonBounds.y + buttonBounds.height <= 844, 'Mobile submit button is outside the viewport')
  assert(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile layout overflows horizontally')
  await mobileDialog.getByLabel('Importer des photos personnelles').setInputFiles(photo)
  await mobilePage.waitForFunction(() => document.querySelectorAll('.photo-preview').length === 1)
  await submitButton.click()
  await mobilePage.getByRole('dialog').waitFor({ state: 'hidden' })
  assert.equal((await observations(mobilePage)).length, 1)
  await mobilePage.getByRole('button', { name: 'Ouvrir Espèce à identifier', exact: true }).click()
  await mobilePage.getByRole('dialog').getByRole('button', { name: 'Identifier l’espèce', exact: true }).click()
  await mobilePage.getByRole('dialog', { name: 'Modifier l’observation' }).waitFor()
  await mobilePage.keyboard.press('Escape')
  check('Parcours mobile, appareil photo, formulaire accessible et identification différée')
  assert.deepEqual(failures, [], 'Unexpected browser runtime errors')
  await desktop.close()
  await mobile.close()
  check('Aucune erreur JavaScript à l’exécution')
} finally {
  await browser.close()
}
