import { PaymentAdapter, PaymentIntent, PaymentStatus, PaymentCallbackData } from "../types";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const log = logger.child({ module: 'MianQianProvider' });

// 站内「个人免签（码支付）」支付通道
// 不需要任何第三方平台：收款码由站长自行上传（微信/支付宝个人收款码），
// 顾客扫码付款后，由手机端监听 App（或通知转发器）POST 一条到账通知到本站的 notify 接口，
// 系统按金额匹配待支付订单并自动发货。资金直接进入站长个人微信/支付宝账户。
//
// 手机端通知协议（可复用于任意通知转发器 App）：
//   POST/GET {site}/api/payments/mianqian/notify?amount=10.00&type=alipay&sign=MD5(amount+token)
//   - amount: 到账金额，字符串，如 "10.00"
//   - type:   alipay | wxpay | qqpay
//   - sign:   md5(amount + token)，token 即后台设置的「通信密钥」

// 支付方式 -> 收款码配置键
const QR_KEY_MAP: Record<string, string> = {
  alipay: "mianqian_qr_alipay",
  wxpay: "mianqian_qr_wechat",
  qqpay: "mianqian_qr_qqpay",
};

// 通知转发器上报的包名 -> 支付类型
function mapPackageToType(pkg: string): string {
  const p = pkg.toLowerCase();
  if (p.includes("alipay")) return "alipay";
  if (p.includes("tencent.mm")) return "wxpay";
  if (p.includes("mobileqq") || p.includes("qq")) return "qqpay";
  return "";
}

// 从微信/支付宝到账通知文本里正则提取金额
function extractAmount(text: string): number {
  if (!text) return 0;
  const patterns = [
    /[¥￥]\s?(\d+(?:\.\d{1,2})?)/,
    /(\d+(?:\.\d{1,2})?)\s*元/,
    /收款[^\d]{0,6}?(\d+(?:\.\d{1,2})?)/,
    /收到[^\d]{0,6}?(\d+(?:\.\d{1,2})?)/,
    /到账[^\d]{0,6}?(\d+(?:\.\d{1,2})?)/,
    /金额[^\d]{0,6}?(\d+(?:\.\d{1,2})?)/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const v = parseFloat(m[1]);
      if (v > 0) return v;
    }
  }
  return 0;
}

export class MianQianProvider implements PaymentAdapter {
  name = "mianqian";

  private isEnabled: boolean = false;
  private token: string = "";
  private siteUrl: string = "";
  private qrUrls: Record<string, string> = {};

  constructor() {}

  private async loadConfig() {
    try {
      const settings = await prisma.systemSetting.findMany({
        where: {
          key: {
            in: [
              "mianqian_enabled",
              "mianqian_token",
              "mianqian_qr_alipay",
              "mianqian_qr_wechat",
              "mianqian_qr_qqpay",
              "site_url"
            ]
          }
        }
      });

      const config = settings.reduce((acc, curr) => {
        acc[curr.key] = curr.value;
        return acc;
      }, {} as Record<string, string>);

      this.isEnabled = config.mianqian_enabled === "true";
      this.token = config.mianqian_token || "";
      this.qrUrls = {
        alipay: config.mianqian_qr_alipay || "",
        wxpay: config.mianqian_qr_wechat || "",
        qqpay: config.mianqian_qr_qqpay || "",
      };

      let url = config.site_url || process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
      if (url.endsWith("/")) url = url.slice(0, -1);
      this.siteUrl = url;
    } catch (e) {
      log.error({ err: e }, "Failed to load mianqian config from DB");
      throw new Error("免签支付配置读取失败");
    }
  }

  /** 返回指定通道的收款码图片地址（供订单页展示） */
  async getQrUrl(channel: string): Promise<string> {
    await this.loadConfig();
    return this.qrUrls[channel] || this.qrUrls.alipay || this.qrUrls.wxpay || "";
  }

  async createPayment(
    orderNo: string,
    amount: number,
    description: string,
    options?: { channel?: string }
  ): Promise<PaymentIntent> {
    await this.loadConfig();

    if (!this.isEnabled) {
      throw new Error("免签支付渠道未开启，请在后台设置");
    }

    const channel = options?.channel || "alipay";
    const qrCode = await this.getQrUrl(channel);

    const payUrl = `${this.siteUrl}/orders/${orderNo}?ch=${channel}`;

    log.info({ orderNo, amount, channel }, "MianQian payment created (show personal QR)");

    return {
      orderId: orderNo,
      amount: amount,
      currency: "CNY",
      payUrl,
      qrCode,
    };
  }

  async verifyCallback(data: any, headers?: any): Promise<PaymentCallbackData> {
    // 兼容两种回调：
    //  1) 通知转发器路径：App 直接把微信/支付宝到账通知原文 POST 过来
    //     （JSON: packageName / title / text / bigText），由服务端提取金额、用请求头密钥鉴权
    //  2) 旧协议：?amount=10.00&type=alipay&sign=MD5(amount+token)
    await this.loadConfig();

    if (!this.isEnabled) {
      log.warn("Received mianqian callback but channel is disabled");
      throw new Error("免签支付渠道已停用");
    }

    if (!this.token) {
      throw new Error("通信密钥未配置");
    }

    // ---------- 1) 通知转发器路径 ----------
    const pkg = String(data.packageName || data.package || "");
    const blob = [data.title, data.text, data.bigText, data.subText, data.message, data.content, data.ticker]
      .filter((x) => typeof x === "string" && x.length)
      .join("\n");
    const fwdType = mapPackageToType(pkg);
    const fwdAmount = extractAmount(blob);

    const h = headers || {};
    const headerToken =
      (typeof h["x-mq-token"] === "string" ? h["x-mq-token"] : "") ||
      (typeof h["authorization"] === "string" ? h["authorization"].replace(/^Bearer\s+/i, "") : "") ||
      (typeof data.token === "string" ? data.token : "") ||
      "";

    if (fwdType && fwdAmount > 0 && headerToken) {
      if (headerToken !== this.token) {
        log.error("MianQian forwarder token mismatch");
        throw new Error("通信密钥验证失败");
      }
      data.amount = String(fwdAmount);
      data.type = fwdType;
      return {
        orderNo: "",
        status: PaymentStatus.PAID,
        transactionId: `${fwdType}-${Date.now()}`,
        raw: data,
      };
    }

    // ---------- 2) 旧协议：amount + type + sign=md5(amount+token) ----------
    const { amount, type, sign } = data;
    if (!amount || !sign) {
      throw new Error("缺少必要参数（amount / sign），且无法从通知文本识别到账金额");
    }

    const expected = crypto.createHash("md5").update(`${amount}${this.token}`).digest("hex");
    if (expected !== sign) {
      log.error({ expected, received: sign }, "MianQian signature verification failed");
      throw new Error("签名验证失败");
    }

    data.type = type || fwdType || "unknown";
    return {
      orderNo: "", // 免签按金额匹配，不直接带订单号
      status: PaymentStatus.PAID,
      transactionId: `${data.type}-${Date.now()}`,
      raw: data,
    };
  }
}
