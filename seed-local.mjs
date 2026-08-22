// 本地演示用示例数据：几个示例分类和商品
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('写入演示数据...')

  const cat1 = await prisma.category.upsert({
    where: { slug: 'game-cards' },
    update: {},
    create: { name: '游戏点卡', slug: 'game-cards', priority: 10 },
  })

  const cat2 = await prisma.category.upsert({
    where: { slug: 'vip-codes' },
    update: {},
    create: { name: '会员激活码', slug: 'vip-codes', priority: 5 },
  })

  await prisma.product.upsert({
    where: { id: 'demo-product-1' },
    update: {},
    create: {
      id: 'demo-product-1',
      name: '示例游戏 100 点卡',
      description: '演示商品：购买后自动发放一张 100 点充值卡密。',
      price: 9.9,
      categoryId: cat1.id,
      licenses: {
        create: [
          { code: 'DEMO-GAME-100-AAAA-BBBB' },
          { code: 'DEMO-GAME-100-CCCC-DDDD' },
          { code: 'DEMO-GAME-100-EEEE-FFFF' },
        ],
      },
    },
  })

  await prisma.product.upsert({
    where: { id: 'demo-product-2' },
    update: {},
    create: {
      id: 'demo-product-2',
      name: '示例游戏 500 点卡（9 折）',
      description: '演示商品：批量充值更划算，自动发货。',
      price: 45.0,
      categoryId: cat1.id,
      licenses: {
        create: [
          { code: 'DEMO-GAME-500-GGGG-HHHH' },
          { code: 'DEMO-GAME-500-IIII-JJJJ' },
        ],
      },
    },
  })

  await prisma.product.upsert({
    where: { id: 'demo-product-3' },
    update: {},
    create: {
      id: 'demo-product-3',
      name: '示例视频会员月卡激活码',
      description: '演示商品：付款后卡密自动发到你的邮箱。',
      price: 15.0,
      categoryId: cat2.id,
      licenses: {
        create: [
          { code: 'DEMO-VIP-M-KKKK-LLLL' },
          { code: 'DEMO-VIP-M-MMMM-NNNN' },
        ],
      },
    },
  })

  await prisma.product.upsert({
    where: { id: 'demo-product-4' },
    update: {},
    create: {
      id: 'demo-product-4',
      name: '示例网盘会员季卡激活码',
      description: '演示商品：极速下载 + 大容量空间。',
      price: 30.0,
      categoryId: cat2.id,
      licenses: {
        create: [{ code: 'DEMO-NET-Q-OOOO-PPPP' }],
    },
    },
  })

  console.log('演示数据写入完成。')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
