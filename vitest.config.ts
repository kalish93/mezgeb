import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Integration tests run against a separate database (never the app's own data).
// Default: the docker-compose Postgres on :5433, database "mezgeb_test" (created automatically).
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://cone_user:cone_pass@localhost:5433/mezgeb_test'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/global-setup.ts'],
    env: { DATABASE_URL: TEST_DATABASE_URL },
    fileParallelism: false, // integration files share one database
  },
})
