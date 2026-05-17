export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { prisma, prismaReady } = await import("@/lib/prisma");

  try {
    await prismaReady();
  } catch (err) {
    console.error("[instrumentation] Prisma warm connect failed:", err);
  }

  let disconnecting = false;
  const disconnect = async () => {
    if (disconnecting) return;
    disconnecting = true;
    try {
      await prisma.$disconnect();
    } catch {
      /* process is exiting */
    }
  };

  process.once("SIGINT", () => void disconnect());
  process.once("SIGTERM", () => void disconnect());
}
