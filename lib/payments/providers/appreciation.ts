import { PaymentAdapter, PaymentIntent, PaymentStatus, PaymentCallbackData } from "../types";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const log = logger.child({ module: 'AppreciationProvider' });

// 微信赞赏码支付通道
// 顾客下单后看到赞赏码二维码，手动扫码付款，站长在后台核对收款记录后手动「补单」发货。
// 适合没有第三方免签监控、只想用个人赞赏码收款的场景。

export class AppreciationProvider implements PaymentAdapter {
  name = "appreciation";

  private isEnabled: boolean = false;
  private qrUrl: string = "";
  private siteUrl: string = "";

  constructor() {}

  private async loadConfig() {
    try {
      const settings = await prisma.systemSetting.findMany({
        where: {
          key: {
            in: [
              "appreciation_enabled",
              "appreciation_qr_url",
              "site_url"
            ]
          }
        }
      });

      const config = settings.reduce((acc, curr) => {
        acc[curr.key] = curr.value;
        return acc;
      }, {} as Record<string, string>);

      this.isEnabled = config.appreciation_enabled === "true";
      // 优先使用后台填写的图片地址；未填写则 fallback 到项目内置赞赏码
      this.qrUrl = config.appreciation_qr_url || "/qr-codes/appreciation.png";

      let url = config.site_url || process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
      if (url.endsWith("/")) url = url.slice(0, -1);
      this.siteUrl = url;
    } catch (e) {
      log.error({ err: e }, "Failed to load appreciation config from DB");
      throw new Error("赞赏码配置读取失败");
    }
  }

  async createPayment(
    orderNo: string,
    amount: number,
    description: string,
    options?: { channel?: string }
  ): Promise<PaymentIntent> {
    await this.loadConfig();

    if (!this.isEnabled) {
      throw new Error("赞赏码支付未开启，请在后台设置");
    }

    const baseUrl = (options && (options as any).baseUrl) || this.siteUrl;
    const payUrl = `${baseUrl}/orders/${orderNo}`;

    log.info({ orderNo, amount }, "Appreciation payment created (manual confirmation)");

    return {
      orderId: orderNo,
      amount: amount,
      currency: "CNY",
      payUrl,
      qrCode: this.qrUrl,
    };
  }

  async verifyCallback(data: any, headers?: any): Promise<PaymentCallbackData> {
    // 赞赏码没有自动回调，永远抛错提示应走后台手动补单
    throw new Error("赞赏码支付不支持自动回调，请在后台手动确认收款并发货");
  }
}
