import { getAdminSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AdminCreateOrderClient } from "@/components/admin/AdminCreateOrderClient";

export const metadata = {
  title: "Create order | Admin",
};

export default async function AdminCreateOrderPage() {
  const session = await getAdminSession();
  const isSuperAdmin = (session?.roles ?? []).includes("SUPER_ADMIN");
  if (!isSuperAdmin) redirect("/admin/orders");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/orders" className="text-sm font-medium text-blue hover:underline">
          ← Orders
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-dark">Create order</h1>
        <p className="mt-2 text-sm text-meta-3 max-w-2xl">
          Super Admin only. Stock is reserved when the order is created. Leave the payment-link box
          unchecked if payment was already received offline.
        </p>
      </div>
      <AdminCreateOrderClient />
    </div>
  );
}
