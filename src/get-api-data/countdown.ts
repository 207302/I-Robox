import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";


export const getCountdowns = unstable_cache(
  async () => {
    return await prisma.countdown.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        product: {
          select: {
            title: true,
          }
        }
      }
    });
  },
  ['countdowns'], { tags: ['countdowns'] }
);