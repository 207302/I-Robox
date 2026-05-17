export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { prisma } = await import("@/lib/prisma");

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

  // Do NOT use beforeExit — on shared hosts it fires during normal traffic and drops pooled connections.
  process.once("SIGINT", () => void disconnect());
  process.once("SIGTERM", () => void disconnect());
}
