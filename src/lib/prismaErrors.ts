import { Prisma } from "@prisma/client";

/** User-facing message for common Prisma failures; null if unknown. */
export function prismaErrorMessage(error: unknown): string | null {
  const msg = error instanceof Error ? error.message : "";

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2022") {
      return "Database schema is out of date. Redeploy the site so migrations can run.";
    }
    if (error.code === "P2025") {
      return "Record not found";
    }
  }
  if (error instanceof Prisma.PrismaClientValidationError) {
    if (/Unknown argument/i.test(msg)) {
      return "App is out of sync with the database schema. Run: npx prisma generate && npm run db:migrate, then restart the dev server.";
    }
    return "Invalid data for this update";
  }
  if (/column .* does not exist/i.test(msg) || /unknown column/i.test(msg)) {
    return "Database schema is out of date. Redeploy the site so migrations can run.";
  }
  return null;
}
