import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * 自建图形验证码（零依赖、零外部请求、不依赖 Google，国内可正常加载）。
 *
 * 设计要点：
 * 1. 无状态签名 token：答案**摘要**（HMAC，绝不放明文）+ 过期时间 + 唯一 jti 打包后
 *    HMAC-SHA256 签名，服务端不落库即可校验，适配 Vercel Serverless 多实例。
 *    token 可被任何人 base64 解码，所以里面绝不能出现明文答案，否则验证码形同虚设。
 * 2. 一次性：每个 token 带唯一 jti，校验时复用数据库级限流桶做「只允许一次」标记，
 *    避免为此新增数据表 / 迁移（RateLimit 表已存在）。
 * 3. 先消耗后比对：即使输错，token 也立刻作废，攻击者无法用同一张图反复爆破。
 * 4. 有效期 3 分钟，4 位数字，字符以七段线段绘制（输出中不含可读文本）。
 */

const TTL_MS = 3 * 60 * 1000;
/** 只用数字：七段字模可无歧义绘制，输入法友好，手机端直接弹数字键盘 */
const ALPHABET = "0123456789";
const CODE_LENGTH = 4;

function getSecret(): string {
  return (
    process.env.CAPTCHA_SECRET ||
    process.env.JWT_SECRET ||
    process.env.ADMIN_PASSWORD ||
    "dev-only-captcha-secret-change-me"
  );
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

/**
 * 答案摘要：**绝不能把明文答案放进 token**。
 * token 是 base64url(JSON)，只做 HMAC 签名保证不可篡改，但可被任何人解码读取；
 * 若直接放明文，攻击者解 base64 就知道答案，验证码形同虚设。
 * 这里只存 HMAC(secret, 答案)，无密钥无法反推；答案空间虽小（26^4），
 * 但没有 secret 就无法离线枚举。
 */
function answerDigest(codeLower: string): string {
  return createHmac("sha256", getSecret()).update("ans:" + codeLower).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  try {
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/**
 * 七段描边字模（单位坐标 0..1）：**用线段画数字，输出里不出现任何可读文本**。
 * 早期版本用 <text> 渲染，机器人把 data URL 解 base64 正则抓 <text> 就能读出答案，
 * 验证码等于没做，所以这里改成纯线段几何。
 */
const SEGMENTS: Record<string, [number, number, number, number]> = {
  a: [0.18, 0.04, 0.82, 0.04], // 上横
  b: [0.82, 0.04, 0.82, 0.5], // 右上竖
  c: [0.82, 0.5, 0.82, 0.96], // 右下竖
  d: [0.18, 0.96, 0.82, 0.96], // 下横
  e: [0.18, 0.5, 0.18, 0.96], // 左下竖
  f: [0.18, 0.04, 0.18, 0.5], // 左上竖
  g: [0.18, 0.5, 0.82, 0.5], // 中横
};

const DIGIT_SEGMENTS: Record<string, string> = {
  "0": "abcdef",
  "1": "bc",
  "2": "abged",
  "3": "abgcd",
  "4": "fgbc",
  "5": "afgcd",
  "6": "afgecd",
  "7": "abc",
  "8": "abcdefg",
  "9": "abcdfg",
};

/** 生成一张 120x40 的干扰数字图，返回 SVG 字符串（纯线段，无可读字符） */
function renderSvg(code: string): string {
  const W = 120;
  const H = 40;
  const glyphColors = ["#1f2937", "#1e3a8a", "#7c2d12", "#134e4a", "#4c1d95", "#831843"];

  const bgs = ["#f8fafc", "#f1f5f9", "#fefce8", "#f0fdf4", "#eff6ff"];
  const bg = bgs[randomInt(0, bgs.length)];

  const parts: string[] = [];
  parts.push(`<rect width="${W}" height="${H}" fill="${bg}"/>`);

  // 背景干扰线
  const lineColors = ["#cbd5e1", "#bfdbfe", "#fde68a", "#bbf7d0", "#e9d5ff"];
  for (let i = 0; i < 6; i++) {
    parts.push(
      `<line x1="${randomInt(0, W)}" y1="${randomInt(0, H)}" x2="${randomInt(0, W)}" y2="${randomInt(0, H)}" ` +
        `stroke="${lineColors[randomInt(0, lineColors.length)]}" stroke-width="1.5" stroke-linecap="round"/>`
    );
  }

  // 干扰点
  for (let i = 0; i < 40; i++) {
    const r = 0.7 + randomInt(0, 9) / 10;
    parts.push(
      `<circle cx="${randomInt(0, W)}" cy="${randomInt(0, H)}" r="${r.toFixed(1)}" fill="#94a3b8" opacity="0.5"/>`
    );
  }

  // 数字：每位一个 20x28 的格子，段状线段 + 各自独立旋转/抖动
  const cellW = 24;
  const glyphW = 18;
  const glyphH = 26;
  const baseY = 6;

  for (let i = 0; i < code.length; i++) {
    const segs = DIGIT_SEGMENTS[code[i]] || DIGIT_SEGMENTS["8"];
    const ox = 10 + i * cellW + randomInt(-2, 3);
    const oy = baseY + randomInt(-2, 3);
    const rotate = randomInt(-12, 13);
    const skew = randomInt(-4, 5) / 100;
    const color = glyphColors[randomInt(0, glyphColors.length)];
    const strokeW = 2.6 + randomInt(0, 8) / 10;
    const cx = ox + glyphW / 2;
    const cy = oy + glyphH / 2;

    const strokes: string[] = [];
    for (const key of segs) {
      const [x1, y1, x2, y2] = SEGMENTS[key];
      // skew 让同一数字每次形状略不同，但仍是可读的七段外形
      const px1 = ox + (x1 + skew * (1 - y1)) * glyphW;
      const py1 = oy + y1 * glyphH;
      const px2 = ox + (x2 + skew * (1 - y2)) * glyphW;
      const py2 = oy + y2 * glyphH;
      strokes.push(`M${px1.toFixed(1)} ${py1.toFixed(1)}L${px2.toFixed(1)} ${py2.toFixed(1)}`);
    }

    parts.push(
      `<path d="${strokes.join("")}" fill="none" stroke="${color}" stroke-width="${strokeW.toFixed(1)}" ` +
        `stroke-linecap="round" transform="rotate(${rotate} ${cx.toFixed(1)} ${cy.toFixed(1)})"/>`
    );
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" ` +
    `role="img" aria-label="图形验证码">${parts.join("")}</svg>`
  );
}

export interface CreatedCaptcha {
  token: string;
  /** data:image/svg+xml;base64,... —— 前端直接塞 <img src>，不走 innerHTML */
  image: string;
}

export function createCaptcha(): CreatedCaptcha {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(0, ALPHABET.length)];
  }

  const payload = Buffer.from(
    JSON.stringify({
      h: answerDigest(code.toLowerCase()),
      e: Date.now() + TTL_MS,
      j: randomBytes(9).toString("base64url"),
    }),
    "utf8"
  ).toString("base64url");

  const token = `${payload}.${sign(payload)}`;
  const svg = renderSvg(code);
  const image = "data:image/svg+xml;base64," + Buffer.from(svg, "utf8").toString("base64");
  return { token, image };
}

export type CaptchaFailReason = "missing" | "invalid" | "expired" | "used";

export interface CaptchaResult {
  ok: boolean;
  reason?: CaptchaFailReason;
}

/** 校验验证码（一次性：无论对错，token 立刻作废） */
export async function verifyCaptcha(token: unknown, answer: unknown): Promise<CaptchaResult> {
  if (typeof answer !== "string" || !answer.trim()) return { ok: false, reason: "missing" };
  if (typeof token !== "string" || !token.trim()) return { ok: false, reason: "missing" };

  const dot = token.indexOf(".");
  if (dot <= 0) return { ok: false, reason: "invalid" };
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!safeEqual(sig, sign(payload))) return { ok: false, reason: "invalid" };

  let data: { h?: string; e?: number; j?: string };
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (!data?.h || !data?.j || typeof data?.e !== "number") return { ok: false, reason: "invalid" };
  if (Date.now() > data.e) return { ok: false, reason: "expired" };

  // 一次性消耗：复用 DB 级限流桶，同 jti 只放行 1 次（10 分钟后桶过期，与 token TTL 不冲突）
  const consumed = await checkRateLimit("captcha_use:" + data.j, 1, 10 * 60);
  if (!consumed.allowed) return { ok: false, reason: "used" };

  if (!safeEqual(data.h, answerDigest(answer.trim().toLowerCase()))) {
    return { ok: false, reason: "invalid" };
  }
  return { ok: true };
}

export function captchaErrorMessage(reason?: CaptchaFailReason): string {
  switch (reason) {
    case "missing":
      return "请输入验证码";
    case "expired":
    case "used":
      return "验证码已失效，请点击图片刷新后重试";
    default:
      return "验证码错误，请重新输入";
  }
}
