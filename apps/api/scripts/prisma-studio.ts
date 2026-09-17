import { spawn } from 'child_process';
import { resolvePrismaCliUrl } from '../src/prisma/database-url';

const env = {
  ...process.env,
  DATABASE_URL: resolvePrismaCliUrl(process.env),
};
const forwardedArgs = process.argv.slice(2);

const child = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['prisma', 'studio', ...forwardedArgs],
  {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
  },
);

console.log('[prisma:studio] Starting Prisma Studio with the direct Neon URL');

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
