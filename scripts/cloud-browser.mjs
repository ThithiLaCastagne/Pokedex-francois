// UI integration against a deterministic REST fixture. Database authorization is
// tested separately in test-circle-db.mjs. No real email or network publication.
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { serveBuild } from './serve-test.mjs'
const server = await serveBuild(process.env.CLOUD_TEST_DIST || '/tmp/faune-cloud-build')
const userId = '10000000-0000-4000-8000-000000000001'
const fixtureUser = {
  id: userId,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'explorer@example.test',
  email_confirmed_at: new Date().toISOString(),
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {},
  created_at: new Date().toISOString(),
}
const token = [
  { alg: 'HS256', typ: 'JWT' },
  {
    sub: userId,
    aud: 'authenticated',
    role: 'authenticated',
    email: fixtureUser.email,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  },
  'fixture-signature',
]
  .map((x, i) => (i === 2 ? x : Buffer.from(JSON.stringify(x)).toString('base64url')))
  .join('.')
const tables = { faune_circles: [], faune_members: [], faune_posts: [], faune_kudos: [], faune_comments: [] }
const unexpected = [],
  errors = []
let published
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  headless: true,
  args: process.env.CHROMIUM_ARGS
    ? JSON.parse(process.env.CHROMIUM_ARGS)
    : ['--no-sandbox', '--disable-dev-shm-usage'],
})
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR' })
  await context.addInitScript(
    ({ token, user }) => {
      localStorage.setItem(
        'sb-faune-test-auth-token',
        JSON.stringify({
          access_token: token,
          token_type: 'bearer',
          refresh_token: 'fixture-refresh',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user,
        }),
      )
    },
    { token, user: fixtureUser },
  )
  await context.route('https://faune-test.supabase.co/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      method = request.method(),
      data = request.postDataJSON()
    const respond = (value, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) })
    if (url.pathname === '/auth/v1/user') return respond(fixtureUser)
    if (url.pathname === '/auth/v1/logout') return respond({})
    if (url.pathname === '/rest/v1/rpc/faune_create_circle') {
      const id = '20000000-0000-4000-8000-000000000001'
      tables.faune_circles.push({
        id,
        name: data.circle_name,
        owner_id: userId,
        invite_code: '30000000-0000-4000-8000-000000000001',
        created_at: new Date().toISOString(),
      })
      tables.faune_members.push({
        circle_id: id,
        user_id: userId,
        display_name: data.member_name,
        color: data.member_color,
        snapshot: null,
        joined_at: new Date().toISOString(),
      })
      return respond(id)
    }
    if (url.pathname === '/rest/v1/rpc/faune_rotate_invite') {
      tables.faune_circles[0].invite_code = '30000000-0000-4000-8000-000000000002'
      return respond(tables.faune_circles[0].invite_code)
    }
    const name = url.pathname.split('/').at(-1),
      table = tables[name]
    if (!table) {
      unexpected.push(method + ' ' + url.pathname)
      return respond({ message: 'Unexpected fixture endpoint' }, 400)
    }
    const matches = (row) =>
      [...url.searchParams].every(
        ([key, value]) => !value.startsWith('eq.') || String(row[key]) === value.slice(3),
      )
    if (method === 'GET') {
      let rows = table.filter(matches)
      if (url.searchParams.get('select') === '*' && request.headers()['accept']?.includes('vnd.pgrst.object'))
        return rows.length ? respond(rows[0]) : respond({ message: 'Not found' }, 404)
      return respond(rows)
    }
    if (method === 'POST') {
      if (name === 'faune_posts') published = data
      table.push({ ...data, id: crypto.randomUUID(), created_at: new Date().toISOString() })
      return respond({}, 201)
    }
    if (method === 'PATCH') {
      table.filter(matches).forEach((row) => Object.assign(row, data))
      return respond({})
    }
    if (method === 'DELETE') {
      tables[name] = table.filter((row) => !matches(row))
      return respond({})
    }
    unexpected.push(method + ' ' + url.pathname)
    return respond({ message: 'Unsupported method' }, 400)
  })
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(server.url)
  await page.locator('.observation-card').first().waitFor()
  await page.getByRole('button', { name: 'Ajouter une observation', exact: true }).first().click()
  const form = page.getByRole('dialog')
  await form.getByLabel('Choisir l’espèce', { exact: true }).selectOption('fox')
  await form.getByLabel('Notes personnelles', { exact: false }).fill('SECRET NOTE, DO NOT UPLOAD')
  await form.getByLabel('Région (facultatif)', { exact: true }).selectOption('france')
  await form.getByRole('button', { name: 'Ajouter à mon carnet' }).click()
  await form.waitFor({ state: 'hidden' })
  await page.locator('.mobile-nav').getByRole('button', { name: 'Cercle', exact: true }).click()
  await page.getByRole('button', { name: 'Cercle connecté', exact: true }).click()
  await page.getByRole('button', { name: 'Créer mon premier cercle' }).click()
  await page.getByLabel('Un nom pour votre cercle').fill('Les curieux du dimanche')
  await page.getByRole('dialog').getByRole('button', { name: 'Créer le cercle', exact: true }).click()
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  await page.locator('.circle-members').getByRole('heading', { name: 'Les curieux du dimanche' }).waitFor()
  assert.equal(tables.faune_posts.length, 0)
  await page.getByRole('button', { name: 'Partager une rencontre', exact: true }).click()
  await page.getByLabel('Un mot pour vos proches', { exact: false }).fill('Un bel instant de nature.')
  await page.getByRole('button', { name: 'Publier dans ce cercle', exact: true }).click()
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  await page.locator('.feed-post').waitFor()
  assert.equal(tables.faune_posts.length, 1)
  assert.equal(published.caption, 'Un bel instant de nature.')
  assert.equal(published.photo, null)
  for (const key of ['notes', 'date', 'regionId', 'photos', 'observationId', 'latitude', 'longitude'])
    assert(!Object.hasOwn(published, key))
  assert(!JSON.stringify(published).includes('SECRET'))
  assert.equal(
    await page
      .locator('.feed-post')
      .getByText('Illustration du guide · pas une photo de cette rencontre', { exact: true })
      .count(),
    1,
  )
  console.log(
    '✓ Connexion restaurée, cercle créé, publication explicite sans notes, dates ou régions privées',
  )
  await page.getByRole('button', { name: '0 encouragement', exact: true }).click()
  await page.getByRole('button', { name: '1 encouragement', exact: true }).waitFor()
  await page.getByRole('button', { name: '1 encouragement', exact: true }).click()
  await page.getByRole('button', { name: '0 encouragement', exact: true }).waitFor()
  await page.getByRole('button', { name: '0 commentaire', exact: true }).click()
  await page.getByLabel('Commenter Renard roux').fill('Magnifique !')
  await page.getByRole('button', { name: 'Envoyer le commentaire' }).click()
  await page.getByText('Magnifique !', { exact: true }).waitFor()
  assert.equal(tables.faune_comments.length, 1)
  console.log('✓ Encouragement ajouté puis retiré et commentaire publié dans le fil')
  await page
    .locator('.circle-members')
    .getByRole('button', { name: 'Partager ma collection', exact: true })
    .click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmer', exact: true }).click()
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  assert.equal(tables.faune_members[0].snapshot.total, 1)
  await page.getByRole('button', { name: 'Voir sa collection', exact: true }).click()
  await page.getByRole('dialog').waitFor()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Retirer ma collection du cercle' }).click()
  await page.getByRole('button', { name: 'Partager ma collection', exact: true }).last().waitFor()
  assert.equal(tables.faune_members[0].snapshot, null)
  console.log('✓ Résumé de collection partagé, lu et retiré du cercle')
  await page.getByRole('button', { name: 'Inviter un proche', exact: true }).click()
  assert.match(await page.getByLabel('Code d’invitation', { exact: true }).inputValue(), /0001$/)
  await page.getByRole('button', { name: 'Renouveler le code' }).click()
  await page.waitForFunction(() => document.querySelector('#invite-code').value.endsWith('0002'))
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Supprimer ce commentaire' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmer' }).click()
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  assert.equal(tables.faune_comments.length, 0)
  await page.getByRole('button', { name: 'Supprimer la publication Renard roux' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmer' }).click()
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  await page.getByText('Le premier souvenir vous attend.', { exact: true }).waitFor()
  assert.equal(tables.faune_posts.length, 0)
  assert.deepEqual(unexpected, [])
  assert.deepEqual(errors, [])
  console.log('✓ Invitation renouvelée, modération et suppression confirmées ; aucune erreur JavaScript')
} finally {
  await browser.close()
  await server.close()
}
