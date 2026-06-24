import AdminTwoFactorCard from "@/components/admin/AdminTwoFactorCard";

export const metadata = {
  title: "Admin Security | i-Robox",
};

export default function AdminSecurityPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-dark">Security</h1>
      <AdminTwoFactorCard />
    </div>
  );
}
