import { prisma } from "@/lib/prismaDB";

/** Ensures a shipment row exists after the order is committed (avoid upsert inside long transactions). */
export async function ensureOrderShipmentCreated(orderId: string) {
  await prisma.shipments.upsert({
    where: { order_id: orderId },
    update: { status: "CREATED" },
    create: {
      order_id: orderId,
      status: "CREATED",
      tracking_number: null,
      carrier: null,
    },
  });
}
