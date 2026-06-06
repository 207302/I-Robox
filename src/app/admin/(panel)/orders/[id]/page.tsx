import { getAdminSession } from "@/lib/auth/session";
import { AdminOrderDetailClient } from "@/components/admin/AdminOrderDetailClient";

export default async function AdminOrderDetailPage() {
  const session = await getAdminSession();
  const canDeleteOrders = (session?.roles ?? []).includes("SUPER_ADMIN");

  return <AdminOrderDetailClient canDelete={canDeleteOrders} />;
}
