import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { isSyntheticPhoneSignupEmail } from "@/lib/auth/signupIdentifier";
import LogoutButton from "@/components/Auth/LogoutButton";
import ChangePasswordCard from "@/components/Auth/ChangePasswordCard";
import WishlistAccountCard from "@/components/Account/WishlistAccountCard";
import AccountAddressesCard from "@/components/Account/AccountAddressesCard";
import AccountPhoneCard from "@/components/Account/AccountPhoneCard";
import AccountProfileCard from "@/components/Account/AccountProfileCard";
import { mapDbAddressToSaved } from "@/lib/account/savedAddress";

export const metadata = {
  title: "Account | i-Robox",
};

export default async function AccountPage() {
  const session = await getSession();
  if (!session) {
    return (
      <section className="pt-36 pb-16">
        <div className="w-full px-4 mx-auto max-w-3xl sm:px-6">
          <div className="rounded-2xl border border-gray-3 bg-white p-8 text-center">
            <p className="text-sm text-meta-3">Please sign in to access your account.</p>
            <Link href="/login" className="mt-4 inline-flex rounded-lg bg-blue px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-dark transition">
              Sign in
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const user = await prisma.customers.findUnique({
    where: { id: session.sub },
    select: { email: true, name: true, phone: true, google_sub: true },
  });

  const addresses = await prisma.addresses.findMany({
    where: { customer_id: session.sub },
    orderBy: [{ is_default_shipping: "desc" }, { created_at: "desc" }],
    take: 20,
    select: {
      id: true,
      full_name: true,
      phone: true,
      line1: true,
      line2: true,
      city: true,
      state: true,
      postal_code: true,
      country: true,
      is_default_shipping: true,
    },
  });

  const displayEmail =
    user?.email && !isSyntheticPhoneSignupEmail(user.email) ? user.email : null;
  const needsRecoveryEmail = Boolean(user?.email && isSyntheticPhoneSignupEmail(user.email));
  const emailManagedByGoogle = Boolean(user?.google_sub);

  return (
    <section className="pt-36 pb-16">
      <div className="w-full px-4 mx-auto max-w-5xl sm:px-8 xl:px-0">
        <div className="flex items-center justify-between gap-4 mb-8">
          <h1 className="text-2xl font-semibold text-dark">Account</h1>
          <div className="flex items-center gap-3">
            <Link href="/orders" className="text-sm font-medium text-blue hover:underline">
              View orders
            </Link>
            <LogoutButton />
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,_1fr)_360px]">
          <div className="space-y-8">
            <AccountProfileCard
              initialName={user?.name ?? null}
              initialEmail={displayEmail}
              emailManagedByGoogle={emailManagedByGoogle}
            />

            <AccountPhoneCard initialPhone={user?.phone ?? null} />
            <ChangePasswordCard userId={session.sub} needsRecoveryEmail={needsRecoveryEmail} />
          </div>

          <div className="flex flex-col gap-8">
            <AccountAddressesCard addresses={addresses.map(mapDbAddressToSaved)} />

            <section className="h-fit rounded-2xl border border-gray-3 bg-white p-6">
              <WishlistAccountCard />
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}
