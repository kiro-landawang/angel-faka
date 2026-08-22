import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const orderNo = `RETENTION-TEST-${Date.now()}`
const oldDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)

try {
  const product = await prisma.product.findFirst()
  if (!product) throw new Error('No product available for retention test')

  const order = await prisma.order.create({
    data: {
      orderNo,
      email: 'retention-test@example.invalid',
      totalAmount: 0,
      status: 'PENDING',
      productId: product.id,
      createdAt: oldDate,
      updatedAt: oldDate,
    },
  })

  const license = await prisma.license.create({
    data: {
      code: `RETENTION-TEST-${Date.now()}`,
      productId: product.id,
      status: 'SOLD',
      orderId: order.id,
      createdAt: oldDate,
      updatedAt: oldDate,
    },
  })

  const expiredOrders = await prisma.order.findMany({
    where: { createdAt: { lt: cutoff } },
    select: { id: true },
  })
  const orderIds = expiredOrders.map((item) => item.id)
  await prisma.$transaction([
    prisma.license.updateMany({ where: { orderId: { in: orderIds } }, data: { orderId: null } }),
    prisma.order.deleteMany({ where: { id: { in: orderIds } } }),
  ])

  const remainingOrder = await prisma.order.findUnique({ where: { id: order.id } })
  const remainingLicense = await prisma.license.findUnique({ where: { id: license.id } })
  console.log(JSON.stringify({
    deletedOrders: expiredOrders.length,
    orderDeleted: !remainingOrder,
    licenseDetached: remainingLicense?.orderId === null,
  }))

  // Remove the detached test license after verification.
  if (remainingLicense) await prisma.license.delete({ where: { id: remainingLicense.id } })
} finally {
  await prisma.$disconnect()
}
