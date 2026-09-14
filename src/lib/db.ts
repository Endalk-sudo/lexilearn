import { PrismaClient } from '@prisma/client'
import path from 'path'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function getDbUrl(): string {
  const dbPath = path.resolve(process.cwd(), 'db/custom.db')
  return `file:${dbPath}`
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: getDbUrl() } },
    log: ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
