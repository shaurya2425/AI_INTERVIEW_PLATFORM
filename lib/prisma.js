import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "./generated/prisma/client";

const globalForPrisma = globalThis;

function createPrismaClient() {
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3, idleTimeoutMillis: 10000, connectionTimeoutMillis: 10000 });
const adapter = new PrismaPg(pool);
return new PrismaClient({ adapter });

}

// A regenerated client must replace the cached instance after schema changes in dev.
// Ordinary hot reloads keep the same generated constructor and reuse its connection pool.
const POOL_CONFIG_VERSION = 1;
const reuseClient = globalForPrisma.prismaConstructor === PrismaClient &&
  globalForPrisma.prismaPoolConfigVersion === POOL_CONFIG_VERSION;
// Schema regeneration/HMR can replace the constructor. Release the old
// adapter's pool instead of leaving session connections open indefinitely.
if (!reuseClient && globalForPrisma.prisma) {
  void globalForPrisma.prisma.$disconnect().catch(() => {});
}
export const db = reuseClient
  ? globalForPrisma.prisma
  : createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
  globalForPrisma.prismaConstructor = PrismaClient;
  globalForPrisma.prismaPoolConfigVersion = POOL_CONFIG_VERSION;
}
