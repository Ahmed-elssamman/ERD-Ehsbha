import { execSync } from 'child_process'

let exitCode = 0

try {
  console.log('Running ESLint boundary checks...')
  execSync('npx eslint . --max-warnings 0', { stdio: 'inherit' })
  console.log('ESLint passed')
} catch {
  console.error('ESLint found boundary violations')
  exitCode = 1
}

try {
  console.log('\nRunning dependency-cruiser checks...')
  execSync('npx depcruise --ts-config tsconfig.json --output-type dot apps packages | npx depcruise-wrap-stream-in-html > /dev/null', { stdio: 'inherit' })
  console.log('dependency-cruiser passed')
} catch {
  console.error('dependency-cruiser found violations')
  exitCode = 1
}

process.exit(exitCode)
