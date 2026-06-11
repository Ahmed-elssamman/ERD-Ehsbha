import { readFileSync } from 'fs'
import { execSync } from 'child_process'

let exitCode = 0

try {
  console.log('Checking web build for admin code...')
  const webBuild = execSync('npx tsc -b apps/web --noEmit 2>&1', { encoding: 'utf-8' })
  console.log('Web build typecheck passed')
} catch (e) {
  console.error('Web build has type errors')
  exitCode = 1
}

try {
  console.log('Checking admin build for web code...')
  const adminBuild = execSync('npx tsc -b apps/admin --noEmit 2>&1', { encoding: 'utf-8' })
  console.log('Admin build typecheck passed')
} catch (e) {
  console.error('Admin build has type errors')
  exitCode = 1
}

process.exit(exitCode)
