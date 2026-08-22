import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const password = process.env.LOCAL_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
if (!password) throw new Error("Set LOCAL_ADMIN_PASSWORD or ADMIN_PASSWORD before hashing the admin password");
const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64);
const encoded = `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;

await prisma.systemSetting.upsert({
  where: { key: "admin_password" },
  update: { value: encoded },
  create: { key: "admin_password", value: encoded },
});

console.log("管理员密码已升级为 scrypt 哈希格式。");
await prisma.$disconnect();
