import Link from "next/link";
import { getAdminSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Toaster } from "react-hot-toast";
import SiteTopLoader from "@/components/Common/SiteTopLoader";

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/coupons", label: "Coupons" },
  { href: "/admin/marketing", label: "Marketing" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/csv", label: "CSV Upload" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/users", label: "Admin Users" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  const roles = (session?.roles ?? []) as string[];
  const isAllowed =
    roles.includes("SUPER_ADMIN") ||
    roles.includes("MANAGER") ||
    roles.includes("STAFF") ||
    roles.includes("SUPPORT");

  // Middleware is disabled for Vercel stability; enforce auth here.
  if (!isAllowed) redirect("/admin/login");

  const roleLabel = roles[0] ?? "ADMIN";

  return (
    <div className="min-h-screen bg-gray-1">
      <SiteTopLoader />
      <div className="border-b border-gray-3 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" prefetch={false} className="text-sm font-semibold text-dark hover:text-blue">
              i-Robox
            </Link>
            <span className="text-xs rounded-full bg-gray-1 border border-gray-3 px-3 py-1 text-dark">
              {roleLabel}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <form action="/api/admin/auth/logout" method="post">
              <button className="text-sm font-medium text-meta-3 hover:text-dark">
                Logout
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 grid gap-6 lg:grid-cols-[260px_minmax(0,_1fr)]">
        <aside className="rounded-2xl border border-gray-3 bg-white p-4 h-fit">
          <nav className="space-y-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-dark hover:bg-gray-1 hover:text-blue transition"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="min-w-0">
          <Toaster position="top-center" reverseOrder={false} />
          {children}
        </main>
      </div>
    </div>
  );
}

