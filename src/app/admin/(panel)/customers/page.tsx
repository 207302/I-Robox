import { AdminCustomersTable } from "@/components/admin/AdminCustomersTable";

export const metadata = {
  title: "Admin Customers | i-Robox",
};

export default function AdminCustomersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-dark">Customers</h1>
        <p className="mt-2 text-sm text-meta-3 max-w-2xl">
          View storefront accounts, edit email and phone, and send a password reset link to the
          customer&apos;s registered email. The link opens a page where they enter and confirm a new
          password.
        </p>
      </div>

      <AdminCustomersTable />
    </div>
  );
}
