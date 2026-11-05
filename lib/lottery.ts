import { prisma } from "@/lib/prisma";
import { randomBytes } from "node:crypto";

export interface LotteryConfig {
  w1: number; // 1 积分权重
  w2: number; // 2 积分权重
  w3: number; // 3 积分权重
  wEgg: number; // 彩蛋权重
  eggMin: number; // 彩蛋积分（固定值，2026-11 起不再随机）
  eggMax: number; // 兼容旧配置保留，rollLottery 已不再使用
}

const CONFIG_KEYS = [
  "lottery_w_p1",
  "lottery_w_p2",
  "lottery_w_p3",
  "lottery_w_egg",
  "lottery_egg_min",
  "lottery_egg_max",
];

const CONFIG_VERSION_KEY = "lottery_config_version";
const CONFIG_VERSION = "2";

// 2026-11-05 调整：整体中奖价值调低 —— 大概率 1 积分、中等概率 2、小概率 3、极小概率彩蛋，
// 彩蛋固定 5 积分（原来是 5~20 随机，价值占比过高）。
// 权重之和恰为 100，可直接读作百分比：1 分 90% / 2 分 7% / 3 分 2% / 彩蛋 1%。
// 期望值约 1.15 积分/次（旧配置约 1.60），高价值档位概率明显下降。
const DEFAULT_CONFIG: LotteryConfig = {
  w1: 90,
  w2: 7,
  w3: 2,
  wEgg: 1,
  eggMin: 5,
  eggMax: 5,
};

/**
 * 一次性把配置迁移到当前版本。
 * 为什么需要：老部署的数据库里已经存了旧权重（85/8/3/4 + 彩蛋 5~20），
 * 只改 DEFAULT_CONFIG 对生产库不生效。这里用版本号做幂等迁移：
 * 版本不匹配时写入推荐值并打标，之后站长在后台自行修改不会再被覆盖。
 */
async function migrateConfigToCurrentVersion() {
  const rows: Array<[string, string]> = [
    ["lottery_w_p1", String(DEFAULT_CONFIG.w1)],
    ["lottery_w_p2", String(DEFAULT_CONFIG.w2)],
    ["lottery_w_p3", String(DEFAULT_CONFIG.w3)],
    ["lottery_w_egg", String(DEFAULT_CONFIG.wEgg)],
    ["lottery_egg_min", String(DEFAULT_CONFIG.eggMin)],
    ["lottery_egg_max", String(DEFAULT_CONFIG.eggMax)],
    [CONFIG_VERSION_KEY, CONFIG_VERSION],
  ];
  await prisma.$transaction(
    rows.map(([key, value]) =>
      prisma.systemSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value, description: "抽奖概率配置" },
      })
    )
  );
}

export async function getLotteryConfig(): Promise<LotteryConfig> {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: { key: { in: [...CONFIG_KEYS, CONFIG_VERSION_KEY] } },
    });
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));

    // 旧版本配置（或从未配置过）→ 迁移到当前推荐概率，保证调低后的概率真正生效
    if (map[CONFIG_VERSION_KEY] !== CONFIG_VERSION) {
      await migrateConfigToCurrentVersion();
      return DEFAULT_CONFIG;
    }

    const num = (key: string, fallback: number) => {
      const v = Number(map[key]);
      return Number.isFinite(v) && v >= 0 ? v : fallback;
    };
    return {
      w1: num("lottery_w_p1", DEFAULT_CONFIG.w1),
      w2: num("lottery_w_p2", DEFAULT_CONFIG.w2),
      w3: num("lottery_w_p3", DEFAULT_CONFIG.w3),
      wEgg: num("lottery_w_egg", DEFAULT_CONFIG.wEgg),
      eggMin: num("lottery_egg_min", DEFAULT_CONFIG.eggMin),
      eggMax: num("lottery_egg_max", DEFAULT_CONFIG.eggMax),
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export interface DrawResult {
  resultType: "points_1" | "points_2" | "points_3" | "egg";
  points: number;
}

// 加权随机：按权重出 1/2/3 积分或彩蛋
// 彩蛋积分固定为 eggMin（默认 5 积分），不再在区间内随机 —— 旧配置的 eggMax 已不再参与计算
export function rollLottery(cfg: LotteryConfig): DrawResult {
  const total = cfg.w1 + cfg.w2 + cfg.w3 + cfg.wEgg;
  const r = Math.random() * (total > 0 ? total : 1);
  let rest = r;
  if ((rest -= cfg.w1) < 0) return { resultType: "points_1", points: 1 };
  if ((rest -= cfg.w2) < 0) return { resultType: "points_2", points: 2 };
  if ((rest -= cfg.w3) < 0) return { resultType: "points_3", points: 3 };
  return { resultType: "egg", points: Math.max(0, Math.floor(cfg.eggMin)) };
}

// 支付成功后发放抽奖次数（在支付回调的事务内调用，按订单幂等）
export async function grantLotteryDraws(
  tx: any,
  order: { id: string; customerId: string | null; drawsGranted: boolean; quantity: number; product?: { lotteryDraws?: number | null } | null }
): Promise<number> {
  if (!order.customerId) return 0;
  if (order.drawsGranted) return 0;
  const perItem = order.product?.lotteryDraws ?? 0;
  const draws = perItem * order.quantity;
  if (draws <= 0) return 0;
  await tx.customer.update({
    where: { id: order.customerId },
    data: { drawsAvailable: { increment: draws } },
  });
  return draws;
}

export function newId(): string {
  return randomBytes(12).toString("hex");
}
