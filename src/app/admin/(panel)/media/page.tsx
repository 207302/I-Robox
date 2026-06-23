import { redirect } from "next/navigation";
import BulkCloudinaryUploadPanel from "@/components/admin/BulkCloudinaryUploadPanel";
import { requireSuperAdmin } from "@/lib/admin/rbac";

export const metadata = {
  title: "Media upload | Admin",
};

export default async function AdminMediaPage() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) redirect("/admin/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-dark">Bulk image upload</h1>
        <p className="mt-2 text-sm text-meta-3 max-w-3xl">
          Upload many images to Cloudinary at once. Choose a folder, add files (or drag and drop),
          then upload. Copy the returned URLs for CSV imports, product galleries, or marketing
          banners.
        </p>
      </div>
      <section className="rounded-2xl border border-gray-3 bg-white p-6">
        <BulkCloudinaryUploadPanel />
      </section>
    </div>
  );
}
