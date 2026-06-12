import { prisma } from "@/lib/prisma";
import { isSyntheticPhoneSignupEmail } from "@/lib/auth/signupIdentifier";

/** After password reset OTP, attach a real email to phone-only accounts. */
export async function linkRecoveryEmailAfterOtp(customerId: string, otpRecordId: string) {
  const [customer, otpRecord] = await Promise.all([
    prisma.customers.findUnique({
      where: { id: customerId },
      select: { email: true },
    }),
    prisma.signup_email_otps.findUnique({
      where: { id: otpRecordId },
      select: { email: true },
    }),
  ]);

  if (!customer || !otpRecord?.email) return;
  if (!isSyntheticPhoneSignupEmail(customer.email)) return;
  if (isSyntheticPhoneSignupEmail(otpRecord.email)) return;

  const taken = await prisma.customers.findFirst({
    where: { email: otpRecord.email, NOT: { id: customerId } },
    select: { id: true },
  });
  if (taken) return;

  await prisma.customers.update({
    where: { id: customerId },
    data: { email: otpRecord.email },
  });
}
