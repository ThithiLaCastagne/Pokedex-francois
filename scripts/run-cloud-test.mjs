import { execFileSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const directory = await mkdtemp(join(tmpdir(), 'faune-cloud-test-'))
try {
  const env = {
    ...process.env,
    VITE_SUPABASE_URL: 'https://faune-test.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture_only',
    VITE_SUPABASE_ANON_KEY: '',
  }
  execFileSync(
    process.execPath,
    ['node_modules/vite/bin/vite.js', 'build', '--outDir', directory, '--emptyOutDir'],
    { stdio: 'inherit', env },
  )
  execFileSync(process.execPath, ['scripts/cloud-browser.mjs'], {
    stdio: 'inherit',
    env: { ...process.env, CLOUD_TEST_DIST: directory },
  })
} finally {
  await rm(directory, { recursive: true, force: true })
}
