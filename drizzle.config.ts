import { defineConfig } from 'drizzle-kit'
import { resolveDbPath } from './src/db/env'

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: resolveDbPath(),
  },
})
