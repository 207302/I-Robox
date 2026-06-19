import { redirect } from "next/navigation";
import { requireAdminWrite } from "@/lib/admin/rbac";
import ShopPopupSignupsPanel from "@/components/admin/ShopPopupSignupsPanel";

export const metadata = {
  title: "Shop popup signups | Admin",
};

export default async function ShopSignupsAdminPage() {
  const auth = await requireAdminWrite();
  if (!auth.ok) redirect("/admin/login");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-dark">Shop popup signups</h1>
      <section className="rounded-2xl border border-gray-3 bg-white p-6">
        <ShopPopupSignupsPanel />
      </section>
    </div>
  );
}
