import { prisma } from "@/lib/prisma";

/** Ensures a shipment row exists after the order is committed (avoid upsert inside long transactions). */
export async function ensureOrderShipmentCreated(orderId: string) {
  await prisma.shipments.upsert({
    where: { order_id: orderId },
    update: {},
    create: {
      order_id: orderId,
      status: "PENDING",
      tracking_number: null,
      carrier: null,
    },
  });
}
