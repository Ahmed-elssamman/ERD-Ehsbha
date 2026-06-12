import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { resolve } from 'path'

let exitCode = 0

const webDist = resolve('apps/web/dist')
const adminDist = resolve('apps/admin/dist')

console.log('Checking web production artifact for admin code...')
if (existsSync(webDist)) {
  const webManifestPath = resolve(webDist, '.vite/manifest.json')
  if (existsSync(webManifestPath)) {
    const manifest = JSON.parse(execSync(`type "${webManifestPath}"`, { encoding: 'utf-8', shell: true }))
    for (const [key, entry] of Object.entries(manifest)) {
      if (entry.src && (entry.src.includes('/admin/') || entry.src.includes('admin-'))) {
        console.error(`Found admin source in web artifact: ${entry.src}`)
        exitCode = 1
      }
    }
    console.log('Web artifact contains no admin source')
  } else {
    console.log('No web build manifest found - build web first')
    exitCode = 1
  }
} else {
  console.log('No web build directory found - build web first')
  exitCode = 1
}

console.log('Checking admin production artifact for web code...')
if (existsSync(adminDist)) {
  const adminManifestPath = resolve(adminDist, '.vite/manifest.json')
  if (existsSync(adminManifestPath)) {
    const manifest = JSON.parse(execSync(`type "${adminManifestPath}"`, { encoding: 'utf-8', shell: true }))
    for (const [key, entry] of Object.entries(manifest)) {
      if (entry.src && (entry.src.includes('/web/') || entry.src.includes('web-'))) {
        console.error(`Found web source in admin artifact: ${entry.src}`)
        exitCode = 1
      }
    }
    console.log('Admin artifact contains no web source')
  } else {
    console.log('No admin build manifest found - build admin first')
    exitCode = 1
  }
} else {
  console.log('No admin build directory found - build admin first')
  exitCode = 1
}

if (exitCode === 0) {
  console.log('Frontend isolation check passed')
}

process.exit(exitCode)
