import { prisma } from "@/lib/prisma";
import { randomBytes } from "node:crypto";

export interface LotteryConfig {
  w1: number; // 1 积分权重
  w2: number; // 2 积分权重
  w3: number; // 3 积分权重
  wEgg: number; // 彩蛋权重
  eggMin: number; // 彩蛋最小积分
  eggMax: number; // 彩蛋最大积分
}

const CONFIG_KEYS = [
  "lottery_w_p1",
  "lottery_w_p2",
  "lottery_w_p3",
  "lottery_w_egg",
  "lottery_egg_min",
  "lottery_egg_max",
];

// 默认值严格对齐需求：1积分 85% / 2积分 8% / 3积分 3% / 彩蛋 4%；彩蛋 5~20 积分。
// 后台「系统设置 - 抽奖积分」可随时调整。
const DEFAULT_CONFIG: LotteryConfig = {
  w1: 85,
  w2: 8,
  w3: 3,
  wEgg: 4,
  eggMin: 5,
  eggMax: 20,
};

export async function getLotteryConfig(): Promise<LotteryConfig> {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: { key: { in: CONFIG_KEYS } },
    });
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
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

// 加权随机：按权重出 1/2/3 积分或彩蛋（彩蛋为 [eggMin, eggMax] 随机整数）
export function rollLottery(cfg: LotteryConfig): DrawResult {
  const total = cfg.w1 + cfg.w2 + cfg.w3 + cfg.wEgg;
  let r = Math.random() * total;
  if ((r -= cfg.w1) < 0) return { resultType: "points_1", points: 1 };
  if ((r -= cfg.w2) < 0) return { resultType: "points_2", points: 2 };
  if ((r -= cfg.w3) < 0) return { resultType: "points_3", points: 3 };
  const span = Math.max(0, cfg.eggMax - cfg.eggMin);
  const egg = cfg.eggMin + (span > 0 ? Math.floor(Math.random() * (span + 1)) : 0);
  return { resultType: "egg", points: egg };
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
