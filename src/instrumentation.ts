export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Dev / `next dev`: env + Prisma init happen on first request, not during instrumentation.
  if (process.env.NODE_ENV !== "production") return;

  const { ensureDatabaseEnvLoaded, getDatabaseUrlFromEnv, resolveEnvRoot } = await import(
    "@/lib/loadDatabaseEnv"
  );
  ensureDatabaseEnvLoaded();

  if (!getDatabaseUrlFromEnv()) {
    console.warn(
      `[instrumentation] DATABASE_URL not set — skip Neon ping (looked in ${resolveEnvRoot()})`
    );
    return;
  }

  const { prisma, prismaReady } = await import("@/lib/prisma");

  try {
    await prismaReady();
  } catch (err) {
    console.error("[instrumentation] Prisma warm connect failed:", err);
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    console.info("[instrumentation] Neon wake-up ping OK");
  } catch (err) {
    console.error("[instrumentation] Neon wake-up ping failed:", err);
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

  const { registerPrismaSignalHandlers } = await import("./instrumentation.node");
  registerPrismaSignalHandlers(disconnect);
}
