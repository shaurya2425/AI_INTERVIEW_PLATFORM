import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "./generated/prisma/client";

const globalForPrisma = globalThis;

function createPrismaClient() {
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
return new PrismaClient({ adapter });

}

// A regenerated client must replace the cached instance after schema changes in dev.
// Ordinary hot reloads keep the same generated constructor and reuse its connection pool.
export const db = globalForPrisma.prismaConstructor === PrismaClient
  ? globalForPrisma.prisma
  : createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
  globalForPrisma.prismaConstructor = PrismaClient;
}