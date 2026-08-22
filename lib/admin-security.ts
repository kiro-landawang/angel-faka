import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { verifyAdminAccessToken } from "@/lib/admin-access-token";

const SETTING_PREFIX = "admin_access_block:";
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

type BlockRecord = {
  stage: 0 | 1 | 2;
  failures: number;
  lockedUntil: string | null;
  permanent: boolean;
  updatedAt: string;
};

export type AccessCheck =
  | { ok: true }
  | { ok: false; status: 401 | 429 | 500; error: string };

function fingerprint(value: string) {
  const secret = process.env.ADMIN_ACCESS_TOKEN || process.env.JWT_SECRET || "local-security-secret";
  return createHash("sha256").update(`${secret}:${value}`, "utf8").digest("hex");
}

function parseRecord(value: string | undefined): BlockRecord {
  if (!value) {
    return { stage: 0, failures: 0, lockedUntil: null, permanent: false, updatedAt: new Date(0).toISOString() };
  }
  try {
    const parsed = JSON.parse(value) as Partial<BlockRecord>;
    const failures = typeof parsed.failures === "number" ? parsed.failures : 0;
    return {
      stage: parsed.stage === 1 || parsed.stage === 2 ? parsed.stage : 0,
      failures: Number.isInteger(failures) && failures > 0 ? failures : 0,
      lockedUntil: typeof parsed.lockedUntil === "string" ? parsed.lockedUntil : null,
      permanent: parsed.permanent === true,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date(0).toISOString(),
    };
  } catch {
    return { stage: 0, failures: 0, lockedUntil: null, permanent: false, updatedAt: new Date(0).toISOString() };
  }
}

async function read(key: string) {
  const setting = await prisma.systemSetting.findUnique({ where: { key } });
  return parseRecord(setting?.value);
}

async function save(key: string, record: BlockRecord) {
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value: JSON.stringify(record) },
    create: {
      key,
      value: JSON.stringify(record),
      description: "Hashed admin access lock state; does not contain raw IP or device data",
    },
  });
}

function lockMessage(record: BlockRecord) {
  if (record.permanent) return "当前 IP/设备已永久封锁";
  if (!record.lockedUntil) return null;
  const remaining = Date.parse(record.lockedUntil) - Date.now();
  if (remaining <= 0) return null;
  const days = Math.max(1, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
  return `当前 IP/设备已被封锁，剩余约 ${days} 天`;
}

function nextFailure(record: BlockRecord) {
  const now = Date.now();
  const limit = record.stage === 0 ? 3 : record.stage === 1 ? 2 : 1;
  const updated = { ...record, failures: record.failures + 1, updatedAt: new Date(now).toISOString() };
  if (updated.failures < limit) return updated;

  if (updated.stage === 0) {
    updated.stage = 1;
    updated.lockedUntil = new Date(now + SEVEN_DAYS).toISOString();
  } else if (updated.stage === 1) {
    updated.stage = 2;
    updated.lockedUntil = new Date(now + THIRTY_DAYS).toISOString();
  } else {
    updated.permanent = true;
    updated.lockedUntil = null;
  }
  updated.failures = 0;
  return updated;
}

export async function checkAdminAccess(input: {
  token: unknown;
  ip: string;
  userAgent: string;
  deviceId?: string;
}): Promise<AccessCheck> {
  if (!process.env.ADMIN_ACCESS_TOKEN) {
    return { ok: false, status: 500, error: "服务器尚未配置管理员认证令牌" };
  }

  const ipKey = `${SETTING_PREFIX}ip:${fingerprint(input.ip)}`;
  const deviceKey = `${SETTING_PREFIX}device:${fingerprint(`${input.userAgent}|${input.deviceId || "no-device-id"}`)}`;
  const [ipRecord, deviceRecord] = await Promise.all([read(ipKey), read(deviceKey)]);
  const existingBlock = lockMessage(ipRecord) || lockMessage(deviceRecord);
  if (existingBlock) return { ok: false, status: 429, error: existingBlock };

  if (verifyAdminAccessToken(input.token)) {
    await Promise.all([
      save(ipKey, { ...ipRecord, failures: 0, lockedUntil: null, updatedAt: new Date().toISOString() }),
      save(deviceKey, { ...deviceRecord, failures: 0, lockedUntil: null, updatedAt: new Date().toISOString() }),
    ]);
    return { ok: true };
  }

  const nextIp = nextFailure(ipRecord);
  const nextDevice = nextFailure(deviceRecord);
  await Promise.all([save(ipKey, nextIp), save(deviceKey, nextDevice)]);

  return {
    ok: false,
    status: nextIp.permanent || nextDevice.permanent || nextIp.lockedUntil || nextDevice.lockedUntil ? 429 : 401,
    error: lockMessage(nextIp) || lockMessage(nextDevice) || "认证令牌错误",
  };
}
