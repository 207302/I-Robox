import { prisma } from "@/lib/prisma";

export async function writeAuditLog(input: {
  customerId?: string | null;
  adminUserId?: string | null;
  entityType: string;
  entityId?: string | null;
  action: string;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  try {
    await prisma.audit_logs.create({
      data: {
        customer_id: input.customerId ?? null,
        admin_user_id: input.adminUserId ?? null,
        entity_type: input.entityType,
        entity_id: input.entityId ?? null,
        action: input.action,
        old_values: input.oldValues ?? null,
        new_values: input.newValues ?? null,
        ip_address: input.ipAddress ?? null,
        user_agent: input.userAgent ?? null,
      },
    });
  } catch {
    // Audit logs should never break core flows.
  }
}

