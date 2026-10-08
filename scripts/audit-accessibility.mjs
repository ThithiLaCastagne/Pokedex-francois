import { serveBuild } from './serve-test.mjs'
import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'
import { mkdir, writeFile } from 'node:fs/promises'
const server = await serveBuild()
const args = process.env.CHROMIUM_ARGS
  ? JSON.parse(process.env.CHROMIUM_ARGS)
  : ['--no-sandbox', '--disable-dev-shm-usage']
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  headless: true,
  args,
})
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR' })
const page = await context.newPage()
await page.emulateMedia({ reducedMotion: 'reduce' })
const reports = []
const routes = ['journal', 'explore', 'circle', 'progress', 'settings']
try {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const route of routes) {
      await page.goto(server.url + '#' + route)
      await page.locator('h1').waitFor()
      await page.evaluate(() => document.fonts.ready)
      const report = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
      reports.push({
        route,
        width,
        violations: report.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.map((n) => ({ html: n.html, summary: n.failureSummary, target: n.target })),
        })),
      })
      console.log(width, route, report.violations.map((v) => `${v.id}: ${v.nodes.length}`).join(', '))
    }
  }
  await page.getByRole('button', { name: 'Ajouter une observation', exact: true }).first().click()
  await page.getByRole('dialog').waitFor()
  const modal = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  reports.push({ route: 'observation-form', width: 1440, violations: modal.violations })
  console.log(
    'form',
    modal.violations.map((v) => v.id),
  )
  await mkdir('test-results', { recursive: true })
  await writeFile('test-results/accessibility.json', JSON.stringify(reports, null, 2))
  if (reports.some((report) => report.violations.length)) process.exitCode = 1
} finally {
  await browser.close()
  await server.close()
}
