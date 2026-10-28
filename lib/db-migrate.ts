import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * 抽奖 / 积分体系 —— 运行时幂等迁移。
 *
 * 背景：生产数据库是 Neon PostgreSQL，本地没有其连接串，无法离线 `prisma db push`。
 * 因此改为「运行时自愈」：首次触及抽奖相关接口时（支付回调发次数 / 用户登录 / 抽奖 /
 * 兑换），用应用自身 DATABASE_URL 执行一遍幂等 DDL（CREATE TABLE IF NOT EXISTS /
 * ADD COLUMN IF NOT EXISTS / DO 块加外键），把新表与字段补齐到线上库。
 *
 * 该模块对 SQLite（本地开发）同样兼容：语句逐条执行并吞掉「已存在」类错误，
 * 不影响本地 `prisma db push` 的常规流程。
 */

const log = logger.child({ module: "db-migrate" });

// Postgres 方言 DDL（生产环境）
const POSTGRES_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS "Customer" (
    "id" TEXT PRIMARY KEY,
    "email" TEXT NOT NULL UNIQUE,
    "password" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "drawsAvailable" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS "LotteryDraw" (
    "id" TEXT PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "resultType" TEXT NOT NULL,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT "LotteryDraw_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "PointLedger" (
    "id" TEXT PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "ref" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT "PointLedger_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "LotteryDraw_customerId_idx" ON "LotteryDraw"("customerId")`,
  `CREATE INDEX IF NOT EXISTS "PointLedger_customerId_idx" ON "PointLedger"("customerId")`,
  `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "lotteryDraws" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "isRedeemable" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "redeemCost" INTEGER`,
  `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customerId" TEXT`,
  `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "drawsGranted" BOOLEAN NOT NULL DEFAULT false`,
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.constraint_column_usage
      WHERE constraint_name = 'Order_customerId_fkey'
    ) THEN
      ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey"
        FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL;
    END IF;
  END $$`,
];

// SQLite 方言 DDL（本地开发 / 兜底）。SQLite 不支持 ADD COLUMN IF NOT EXISTS，
// 因此逐条执行并忽略「列已存在 / 表已存在」类错误。
const SQLITE_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS "Customer" (
    "id" TEXT PRIMARY KEY,
    "email" TEXT NOT NULL UNIQUE,
    "password" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "drawsAvailable" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "LotteryDraw" (
    "id" TEXT PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "resultType" TEXT NOT NULL,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "PointLedger" (
    "id" TEXT PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "ref" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `ALTER TABLE "Product" ADD COLUMN "lotteryDraws" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "Product" ADD COLUMN "isRedeemable" BOOLEAN NOT NULL DEFAULT 0`,
  `ALTER TABLE "Product" ADD COLUMN "redeemCost" INTEGER`,
  `ALTER TABLE "Order" ADD COLUMN "customerId" TEXT`,
  `ALTER TABLE "Order" ADD COLUMN "drawsGranted" BOOLEAN NOT NULL DEFAULT 0`,
];

let migrationPromise: Promise<void> | null = null;

export async function ensureLotterySchema(): Promise<void> {
  if (migrationPromise) return migrationPromise;

  migrationPromise = (async () => {
    const url = process.env.DATABASE_URL || "";
    const isPostgres = url.startsWith("postgresql://") || url.startsWith("postgres://");
    const statements = isPostgres ? POSTGRES_DDL : SQLITE_DDL;

    for (const sql of statements) {
      try {
        await prisma.$executeRawUnsafe(sql);
      } catch (err: any) {
        const msg = String(err?.message || err);
        // 吞掉「已存在」类错误（幂等），其余仅记录不阻断业务
        const benign =
          /already exists/i.test(msg) ||
          /duplicate column/i.test(msg) ||
          /column .* already exists/i.test(msg) ||
          /relation .* already exists/i.test(msg) ||
          /there is already an index/i.test(msg) ||
          /duplicate key/i.test(msg);
        if (!benign) {
          log.warn({ sql: sql.slice(0, 80), err: msg }, "db-migrate statement skipped");
        }
      }
    }
    log.info({ provider: isPostgres ? "postgresql" : "sqlite" }, "lottery schema ensured");
  })();

  return migrationPromise;
}
