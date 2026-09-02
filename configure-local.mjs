import { randomBytes, scryptSync } from 'node:crypto'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const rawAdminPassword = process.env.LOCAL_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || ''
const salt = randomBytes(16)
const adminPassword = rawAdminPassword
  ? `scrypt$${salt.toString('hex')}$${scryptSync(rawAdminPassword, salt, 64).toString('hex')}`
  : ''

const settings = [
  ['admin_username', process.env.LOCAL_ADMIN_USERNAME || 'admin'],
  ['admin_password', adminPassword],
  ['site_title', 'ANGEL旗舰 - 自动发货平台'],
  ['site_announcement', '欢迎来到 **ANGEL旗舰**。支付接口暂未配置，当前站点用于商品展示和流程测试。'],
  ['site_contact_info', '客服联系方式请在正式上线前补充。\n\n请保留订单号和下单邮箱，售后处理会更快。'],
  ['site_url', 'http://localhost:3000'],
  ['epay_enabled', 'false'],
  ['epay_channels', 'alipay,wxpay'],
  ['mianqian_enabled', 'true'],
  ['mianqian_channels', 'alipay,wxpay'],
  ['mianqian_fee', '0'],
  ['mianqian_token', ''],
  ['mianqian_qr_alipay', '/qr-codes/alipay.png'],
  ['mianqian_qr_wechat', '/qr-codes/wechat.png'],
  ['mianqian_qr_qqpay', '/qr-codes/qqpay.png'],
  ['resend_enabled', 'false'],
]

const articles = [
  {
    slug: 'how-to-buy',
    title: '购买与发货说明',
    content: `## 购买流程\n\n1. 选择商品并确认库存。\n2. 填写常用邮箱，用于接收订单通知。\n3. 完成支付后，系统会自动分配库存并展示卡密。\n4. 如未看到卡密，请使用订单查询功能，输入订单号和下单邮箱。\n\n> 当前站点支付接口尚未配置，正式上线前请以实际支付页面为准。`,
  },
  {
    slug: 'after-sales',
    title: '售后与常见问题',
    content: `## 常见问题\n\n### 没有收到邮件怎么办？\n\n先检查垃圾邮件，再使用订单查询功能。邮件通知需要站点开启邮件服务。\n\n### 卡密无法使用怎么办？\n\n请保留订单号、商品名称和错误截图，联系客服核验。不要公开完整卡密内容。\n\n### 订单号在哪里？\n\n下单完成后会显示订单号，也可以在订单查询页面找回。`,
  },
  {
    slug: 'service-terms',
    title: '服务条款',
    content: `## 服务条款\n\n1. 仅提供来源合法、具有销售授权的数字商品。\n2. 用户应确认商品适用范围和使用条件后再下单。\n3. 卡密属于数字商品，具体退款和换货规则以商品说明及客服核验结果为准。\n4. 请勿购买或传播来路不明的账号、密钥或其他违规内容。\n5. 站点正式运营前，应补充真实客服联系方式、支付说明和隐私政策。`,
  },
]

async function main() {
  for (const [key, value] of settings) {
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    })
  }

  for (const article of articles) {
    await prisma.article.upsert({
      where: { slug: article.slug },
      update: { title: article.title, content: article.content, isVisible: true },
      create: { ...article, isVisible: true },
    })
  }

  console.log('本地站点配置和帮助中心内容已完成。支付、邮件均保持关闭。')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
