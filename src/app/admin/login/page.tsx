import AdminLoginClient from "./admin-login-client";

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function AdminLoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const next =
    typeof params.next === "string" && params.next.startsWith("/admin")
      ? params.next
      : "/admin/dashboard";

  return <AdminLoginClient next={next} />;
}
