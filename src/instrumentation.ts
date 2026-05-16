export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { prisma } = await import('@/lib/prisma')
    const disconnect = () => void prisma.$disconnect()
    process.on('SIGINT', disconnect)
    process.on('SIGTERM', disconnect)
    process.on('beforeExit', disconnect)
  }
}
