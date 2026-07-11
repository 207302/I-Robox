export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { warnRazorpayWebhookSecretMissing } = await import("@/lib/payments/razorpay");
    warnRazorpayWebhookSecretMissing();
  } catch (err) {
    console.warn("[instrumentation] Razorpay webhook secret check skipped:", err);
  }

  try {
    const { warnEmailSmtpMissing } = await import("@/lib/email");
    warnEmailSmtpMissing();
  } catch (err) {
    console.warn("[instrumentation] SMTP env check skipped:", err);
  }

  try {
    const { getMissingCloudinaryEnvKeys } = await import("@/lib/cloudinary/adminImageUpload");
    const missingCloudinary = getMissingCloudinaryEnvKeys();
    if (missingCloudinary.length > 0) {
      console.error(
        "[instrumentation] Cloudinary not configured — bulk image upload will fail. " +
          `Missing: ${missingCloudinary.join(", ")}`
      );
    }
  } catch (err) {
    console.warn("[instrumentation] Cloudinary env check skipped:", err);
  }

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

  try {
    const { warmShopListingCache } = await import("./lib/shop/shopCacheWarm");
    await warmShopListingCache();
    console.info("[instrumentation] Shop listing cache warm OK");
  } catch (err) {
    console.warn("[instrumentation] Shop listing cache warm skipped:", err);
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

  try {
    const { startAbandonedCartScheduler } = await import("./lib/cron/abandonedCartScheduler");
    startAbandonedCartScheduler();
  } catch (err) {
    console.warn("[instrumentation] Abandoned cart scheduler skipped:", err);
  }

  try {
    const { startShipmozoTrackingScheduler } = await import("./lib/cron/shipmozoTrackingScheduler");
    startShipmozoTrackingScheduler();
    const { shipmozoConfigDiagnostics } = await import("./lib/shipping/shipmozo");
    const shipmozo = shipmozoConfigDiagnostics();
    if (shipmozo.configured) {
      console.info("[instrumentation] ShipMozo integration configured");
    } else {
      console.error("[instrumentation] ShipMozo NOT configured — paid orders will not appear in ShipMozo", shipmozo);
    }
  } catch (err) {
    console.warn("[instrumentation] ShipMozo tracking scheduler skipped:", err);
  }

  const { registerPrismaSignalHandlers } = await import("./instrumentation.node");
  registerPrismaSignalHandlers(async () => {
    try {
      const { stopAbandonedCartScheduler } = await import("./lib/cron/abandonedCartScheduler");
      stopAbandonedCartScheduler();
    } catch {
      /* shutting down */
    }
    try {
      const { stopShipmozoTrackingScheduler } = await import("./lib/cron/shipmozoTrackingScheduler");
      stopShipmozoTrackingScheduler();
    } catch {
      /* shutting down */
    }
    await disconnect();
  });
}
