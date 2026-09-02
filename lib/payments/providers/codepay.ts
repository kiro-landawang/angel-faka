import { PaymentAdapter, PaymentIntent, PaymentStatus, PaymentCallbackData } from "../types";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const log = logger.child({ module: 'CodePayProvider' });

// 码支付（CodePay 个人免签支付）协议实现
// 文档参考：codepay.fateqq.com
// - 创建订单: GET {apiUrl}/creat_order/?id&type&price&pay_id&notify_url&return_url&sign
//   type: 1=支付宝 2=QQ钱包 3=微信支付
//   sign = md5(按参数名排序拼接 k=v&k=v + 通信密钥)，跳过空值和 sign
// - 异步通知: POST 表单，含 pay_id money price type pay_no param pay_time tag sign
//   有 pay_no 即为支付成功；验签方式同上

const DEFAULT_API_URL = "https://codepay.fateqq.com:51888";

// 支付渠道 -> 码支付 type 编码
const CHANNEL_TYPE_MAP: Record<string, string> = {
  alipay: "1",
  qqpay: "2",
  wxpay: "3",
};

export class CodePayProvider implements PaymentAdapter {
  name = "codepay";

  private apiUrl: string = "";
  private merchantId: string = "";
  private key: string = "";
  private isEnabled: boolean = false;
  private siteUrl: string = "";

  constructor() {}

  private async loadConfig() {
    try {
      const settings = await prisma.systemSetting.findMany({
        where: {
          key: {
            in: [
              "codepay_api_url",
              "codepay_id",
              "codepay_key",
              "codepay_enabled",
              "site_url"
            ]
          }
        }
      });

      const config = settings.reduce((acc, curr) => {
        acc[curr.key] = curr.value;
        return acc;
      }, {} as Record<string, string>);

      this.isEnabled = config.codepay_enabled === "true";
      this.apiUrl = config.codepay_api_url || DEFAULT_API_URL;
      this.merchantId = config.codepay_id || "";
      this.key = config.codepay_key || "";

      let url = config.site_url || process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
      if (url.endsWith("/")) url = url.slice(0, -1);
      this.siteUrl = url;

      if (this.apiUrl.endsWith("/")) {
        this.apiUrl = this.apiUrl.slice(0, -1);
      }
    } catch (e) {
      log.error({ err: e }, "Failed to load codepay config from DB");
      throw new Error("码支付配置读取失败");
    }
  }

  private getParamString(params: Record<string, string>): string {
    const sortedKeys = Object.keys(params).sort();
    return sortedKeys
      .filter(k => params[k] !== "" && params[k] !== undefined && k !== "sign")
      .map(k => `${k}=${params[k]}`)
      .join("&");
  }

  private signMD5(params: Record<string, string>): string {
    const paramStr = this.getParamString(params);
    return crypto.createHash("md5").update(paramStr + this.key).digest("hex");
  }

  async createPayment(
    orderNo: string,
    amount: number,
    description: string,
    options?: { channel?: string }
  ): Promise<PaymentIntent> {
    await this.loadConfig();

    if (!this.isEnabled) {
      throw new Error("码支付渠道已停用，请在后台开启");
    }

    if (!this.merchantId || !this.key) {
      throw new Error("码支付参数未配置，请在后台设置");
    }

    const channel = options?.channel || "alipay";
    const payType = CHANNEL_TYPE_MAP[channel] || "1";

    const notifyUrl = `${this.siteUrl}/api/payments/codepay/notify`;
    const returnUrl = `${this.siteUrl}/orders/${orderNo}`;

    const params: Record<string, string> = {
      id: this.merchantId,
      type: payType,
      price: amount.toFixed(2),
      pay_id: orderNo,
      param: orderNo,
      notify_url: notifyUrl,
      return_url: returnUrl
    };

    const sign = this.signMD5(params);
    const query = new URLSearchParams({ ...params, sign }).toString();
    const payUrl = `${this.apiUrl}/creat_order/?${query}`;

    log.info({ orderNo, amount, channel, payType }, "CodePay payment URL generated");

    return {
      orderId: orderNo,
      amount: amount,
      currency: "CNY",
      payUrl: payUrl
    };
  }

  async verifyCallback(data: any, headers?: any): Promise<PaymentCallbackData> {
    await this.loadConfig();

    if (!this.isEnabled) {
      log.warn("Received codepay callback but channel is disabled");
      throw new Error("码支付渠道已停用");
    }

    const { sign, ...params } = data;

    if (!sign) throw new Error("缺少签名参数");

    if (!this.key) throw new Error("通信密钥未配置");

    const calculated = this.signMD5(params as Record<string, string>);
    if (calculated !== sign) {
      log.error({ calculated, received: sign }, "CodePay MD5 signature verification failed");
      throw new Error("签名验证失败");
    }

    // 官方文档：必须验证 pay_no，只有付款成功才会返回该值
    const paid = !!params.pay_no;

    return {
      orderNo: params.pay_id,
      status: paid ? PaymentStatus.PAID : PaymentStatus.FAILED,
      transactionId: params.pay_no || undefined,
      raw: data
    };
  }
}
