export async function register() {
  const disconnect = async () => {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$disconnect();
  };

  process.on("SIGINT", () => void disconnect());
  process.on("SIGTERM", () => void disconnect());
  process.on("beforeExit", () => void disconnect());
}
