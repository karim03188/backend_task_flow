import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Creates a dedicated SQLite test database (prisma/test.db) before the e2e
 * suite runs. This never touches the development database (prisma/dev.db).
 */
export default function globalSetup(): void {
  const backendRoot = join(__dirname, '..');
  const dbFile = join(backendRoot, 'prisma', 'test.db');

  for (const file of [dbFile, `${dbFile}-journal`]) {
    if (existsSync(file)) {
      rmSync(file);
    }
  }

  execSync('npx prisma migrate deploy', {
    cwd: backendRoot,
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
    stdio: 'inherit',
  });

  // eslint-disable-next-line no-console
  console.log('\n[e2e] Test database ready at prisma/test.db\n');
}
