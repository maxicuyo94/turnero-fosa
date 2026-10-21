import { createHash, randomUUID } from "node:crypto";
import { Prisma, type PrismaClient, type ShopOrderStatus } from "@prisma/client";
import { checkoutSchema } from "./storefront-schemas";
import { encryptOrderContact } from "./order-privacy";
import { decryptSensitive } from "@/src/lib/data-encryption";
import { retryPause, SERIALIZABLE_MAX_ATTEMPTS } from "@/src/lib/transaction-retry";
import type { MercadoPagoPort, ProviderPayment } from "@/src/modules/payments/service";

export class ShopOrderError extends Error {}
export const hashShopToken = (token: string) => createHash("sha256").update(token).digest("hex");
const orderInclude = { items: true, payments: true } as const;

async function transaction<T>(prisma: PrismaClient, run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try { return await prisma.$transaction(run, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
    catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || !["P2034", "P2002"].includes(error.code) || attempt >= SERIALIZABLE_MAX_ATTEMPTS) throw error;
      await retryPause(attempt);
    }
  }
}

export async function reserveShopOrder(prisma: PrismaClient, raw: unknown, now = new Date()) {
  const input = checkoutSchema.parse(raw);
  input.items.sort((a, b) => a.productId.localeCompare(b.productId));
  const fingerprint = hashShopToken(JSON.stringify(input));
  return transaction(prisma, async (tx) => {
    const existing = await tx.shopOrder.findUnique({ where: { requestKey: input.requestKey }, include: orderInclude });
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new ShopOrderError("Este intento ya corresponde a otro pedido. Reiniciá la compra.");
      return existing;
    }
    const config = await tx.shopSettings.findUnique({ where: { id: "shop" } });
    if (!config?.checkoutEnabled) throw new ShopOrderError("Las compras online todavía no están habilitadas.");
    if (input.deliveryKind === "SHIPPING" && (!config.shippingEnabled || !config.shippingPostalCodes.includes(input.postalCode!))) {
      throw new ShopOrderError("Todavía no enviamos a ese código postal. Elegí retiro en el taller.");
    }
    const products = await tx.shopProduct.findMany({ where: { id: { in: input.items.map((i) => i.productId) } } });
    const items = input.items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product?.isActive || !product.isPublished) throw new ShopOrderError("Un repuesto ya no está disponible. Actualizá el carrito.");
      if (product.priceCents !== item.unitPriceCents) throw new ShopOrderError(`Cambió el precio de ${product.name}. Actualizá el carrito antes de pagar.`);
      if (product.stock - product.reservedStock < item.quantity) throw new ShopOrderError(`No hay stock suficiente de ${product.name}. Actualizá el carrito.`);
      return { productId: product.id, sku: product.sku, name: product.name, unitPriceCents: product.priceCents, quantity: item.quantity };
    });
    const subtotalCents = items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0);
    const shippingFeeCents = input.deliveryKind === "SHIPPING" ? config.shippingFeeCents : 0;
    if (shippingFeeCents !== input.shippingFeeCents) throw new ShopOrderError("Cambió el costo de envío. Actualizá el carrito antes de pagar.");
    const totalCents = subtotalCents + shippingFeeCents;
    if (totalCents > 2_147_483_647) throw new ShopOrderError("El pedido supera el importe permitido. Dividilo en compras más pequeñas.");
    for (const item of items) {
      const product = products.find((p) => p.id === item.productId)!;
      const updated = await tx.shopProduct.updateMany({ where: { id: product.id, version: product.version },
        data: { reservedStock: { increment: item.quantity }, version: { increment: 1 } } });
      if (updated.count !== 1) throw new ShopOrderError("Cambió el stock. Actualizá el carrito.");
    }
    const { items: _items, accessToken, requestKey, shippingFeeCents: _shippingFee, ...buyer } = input;
    void _items;
    void _shippingFee;
    return tx.shopOrder.create({ data: {
      ...encryptOrderContact({ ...buyer,
        address: input.deliveryKind === "SHIPPING" ? buyer.address : null,
        city: input.deliveryKind === "SHIPPING" ? buyer.city : null,
        province: input.deliveryKind === "SHIPPING" ? buyer.province : null,
        postalCode: input.deliveryKind === "SHIPPING" ? buyer.postalCode : null,
      }),
      code: `REP-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
      accessTokenHash: hashShopToken(accessToken), requestKey, fingerprint,
      subtotalCents, shippingFeeCents, totalCents, expiresAt: new Date(now.getTime() + 30 * 60_000),
      items: { create: items }, events: { create: { status: "AWAITING_PAYMENT", note: "Pedido creado; stock reservado durante 30 minutos." } },
    }, include: orderInclude });
  });
}

export async function startShopPayment(prisma: PrismaClient, port: MercadoPagoPort, token: string, now = new Date()) {
  if (!/^[a-f0-9]{64}$/u.test(token)) throw new ShopOrderError("No se encontró el pedido.");
  const order = await prisma.shopOrder.findUnique({ where: { accessTokenHash: hashShopToken(token) } });
  if (!order || order.status !== "AWAITING_PAYMENT" || order.expiresAt <= now) throw new ShopOrderError("Este pedido ya no acepta pagos.");
  if (order.checkoutUrl) return order.checkoutUrl;
  // Claim checkout creation without holding a database transaction open over a network call.
  // A crashed worker's claim may be reclaimed after 45s (provider requests time out after 15s).
  const claim = `creating:${randomUUID()}`;
  const acquired = await prisma.shopOrder.updateMany({ where: { id: order.id, status: "AWAITING_PAYMENT", expiresAt: { gt: now }, checkoutUrl: null,
    OR: [{ preferenceId: null }, { preferenceId: { startsWith: "creating:" }, updatedAt: { lt: new Date(now.getTime() - 45_000) } }] }, data: { preferenceId: claim } });
  if (!acquired.count) {
    const current = await prisma.shopOrder.findUniqueOrThrow({ where: { id: order.id } });
    if (current.checkoutUrl && current.status === "AWAITING_PAYMENT" && current.expiresAt > new Date()) return current.checkoutUrl;
    throw new ShopOrderError("Estamos preparando el enlace de pago. Volvé a intentarlo en unos segundos.");
  }
  try {
    const preference = await port.createPreference({ externalReference: `shop:${order.id}`, title: `Repuestos · ${order.code}`,
      amountCents: order.totalCents, payerEmail: decryptSensitive(order.email, "shop-email"), expiresAt: order.expiresAt });
    const url = new URL(preference.checkoutUrl);
    if (url.protocol !== "https:" || !/(^|\.)mercadopago\.(com|com\.ar)$/u.test(url.hostname) || url.username || url.password) throw new ShopOrderError("El proveedor devolvió un enlace de pago inválido.");
    await prisma.shopOrder.updateMany({ where: { id: order.id, status: "AWAITING_PAYMENT", expiresAt: { gt: new Date() }, preferenceId: claim, checkoutUrl: null },
      data: { checkoutUrl: preference.checkoutUrl, preferenceId: preference.preferenceId } });
  } catch (error) {
    await prisma.shopOrder.updateMany({ where: { id: order.id, preferenceId: claim }, data: { preferenceId: null } });
    throw error;
  }
  const stored = await prisma.shopOrder.findUniqueOrThrow({ where: { id: order.id } });
  if (stored.status !== "AWAITING_PAYMENT" || stored.expiresAt <= new Date() || !stored.checkoutUrl) throw new ShopOrderError("Este pedido ya no acepta pagos.");
  return stored.checkoutUrl;
}

export async function applyShopPayment(prisma: PrismaClient, payment: ProviderPayment, expectedLiveMode: boolean) {
  if (!payment.externalReference?.startsWith("shop:")) return false;
  return transaction(prisma, async (tx) => {
    const order = await tx.shopOrder.findUnique({ where: { id: payment.externalReference!.slice(5) }, include: orderInclude });
    if (!order) return false;
    const amountCents = Math.round(payment.amount * 100);
    if (payment.currency !== "ARS" || amountCents !== order.totalCents || payment.liveMode !== expectedLiveMode) throw new ShopOrderError("El pago no coincide con el pedido.");
    const previous = await tx.shopPayment.findUnique({ where: { id: payment.id } });
    if (previous && previous.orderId !== order.id) throw new ShopOrderError("El pago ya corresponde a otro pedido.");
    // Refunded and charged-back payments never move backwards on an out-of-order event.
    const status = payment.status === "approved" && (payment.refundedAmount ?? 0) > 0 ? "partially_refunded" : payment.status;
    if (previous && (["refunded", "charged_back"].includes(previous.status) || previous.status === "partially_refunded" && !["partially_refunded", "refunded", "charged_back"].includes(status) || previous.status === "approved" && ["pending", "in_process", "rejected", "cancelled"].includes(status))) return true;
    await tx.shopPayment.upsert({ where: { id: payment.id }, create: { id: payment.id, orderId: order.id, status, amountCents }, update: { status } });
    if (status === "approved") {
      if (order.status === "AWAITING_PAYMENT" && order.reservationHeld) {
        await event(tx, order.id, "PAID", "Mercado Pago verificó el importe y acreditó el pago.");
      } else if (!previous || previous.status !== "approved") {
        await event(tx, order.id, "PAYMENT_REVIEW", "Pago adicional o recibido después de liberar la reserva. Revisar entrega o devolución.", undefined, { reviewReason: "Pago adicional o tardío" });
      }
    } else if (["refunded", "partially_refunded", "charged_back"].includes(status)) {
      await event(tx, order.id, "PAYMENT_REVIEW", "El proveedor informó una devolución o un contracargo. Revisar el pedido.", undefined, { reviewReason: status });
    }
    return true;
  });
}

async function event(tx: Prisma.TransactionClient, id: string, status: ShopOrderStatus, note: string, actorId?: string, data: Prisma.ShopOrderUpdateInput = {}) {
  await tx.shopOrder.update({ where: { id }, data: { ...data, status, events: { create: { status, note, actorId } } } });
}

export async function closeUnpaidOrder(prisma: PrismaClient, id: string, status: "EXPIRED" | "CANCELLED", actorId?: string, now = new Date()) {
  return transaction(prisma, async (tx) => {
    const order = await tx.shopOrder.findUnique({ where: { id }, include: orderInclude });
    if (!order || order.status === status) return;
    if (order.status !== "AWAITING_PAYMENT" || !order.reservationHeld) throw new ShopOrderError("Sólo se pueden cerrar pedidos sin pago acreditado.");
    if (status === "EXPIRED" && order.expiresAt > now) return;
    for (const item of order.items) {
      const result = await tx.shopProduct.updateMany({ where: { id: item.productId, reservedStock: { gte: item.quantity } },
        data: { reservedStock: { decrement: item.quantity }, version: { increment: 1 } } });
      if (result.count !== 1) throw new ShopOrderError("La reserva de stock requiere revisión.");
    }
    await event(tx, order.id, status, status === "EXPIRED" ? "Venció el pago; reserva liberada." : "El taller canceló el pedido; reserva liberada.", actorId, { reservationHeld: false });
  });
}

export async function fulfillShopOrder(prisma: PrismaClient, id: string, target: "READY" | "SHIPPED" | "COMPLETED", actorId: string, tracking?: string) {
  if (target === "SHIPPED" && (!tracking?.trim() || tracking.length > 250)) throw new ShopOrderError("Ingresá el transportista y el código de seguimiento (hasta 250 caracteres).");
  return transaction(prisma, async (tx) => {
    const order = await tx.shopOrder.findUnique({ where: { id }, include: orderInclude });
    if (!order) throw new ShopOrderError("No se encontró el pedido.");
    if (order.status === target) return;
    if (order.status === "PAYMENT_REVIEW") throw new ShopOrderError("Revisá el pago antes de entregar.");
    const allowed = target === "READY" ? order.deliveryKind === "PICKUP" && order.status === "PAID"
      : target === "SHIPPED" ? order.deliveryKind === "SHIPPING" && order.status === "PAID"
      : order.deliveryKind === "PICKUP" ? ["PAID", "READY"].includes(order.status) : order.status === "SHIPPED";
    if (!allowed) throw new ShopOrderError("Ese cambio no corresponde al estado actual del pedido.");
    if (target === "SHIPPED" || target === "COMPLETED" && order.deliveryKind === "PICKUP") {
      if (!order.reservationHeld) throw new ShopOrderError("El pedido no tiene una reserva de stock vigente.");
      for (const item of order.items) {
        const product = await tx.shopProduct.findUniqueOrThrow({ where: { id: item.productId } });
        if (product.stock < item.quantity || product.reservedStock < item.quantity) throw new ShopOrderError("El stock reservado requiere revisión.");
        await tx.shopProduct.update({ where: { id: product.id }, data: { stock: { decrement: item.quantity }, reservedStock: { decrement: item.quantity }, version: { increment: 1 } } });
        await tx.inventoryMovement.create({ data: { productId: product.id, kind: "SALE", quantityDelta: -item.quantity,
          stockBefore: product.stock, stockAfter: product.stock - item.quantity, reason: `Venta ${order.code}`, reference: order.code,
          actorId, requestKey: `shop-sale:${order.id}:${product.id}`, requestFingerprint: hashShopToken(`${order.id}:${product.id}:${item.quantity}`) } });
      }
    }
    await event(tx, order.id, target, target === "READY" ? "Listo para retirar en el taller." : target === "SHIPPED" ? "Despachado con seguimiento." : "Entrega confirmada.", actorId,
      { ...(target === "SHIPPED" ? { tracking: tracking!.trim() } : {}), ...(target !== "READY" ? { reservationHeld: false } : {}) });
  });
}

/** Staff may close a reviewed order only after the provider confirms no collectible payment remains. */
export async function closeReviewedShopOrder(prisma: PrismaClient, id: string, actorId: string) {
  return transaction(prisma, async (tx) => {
    const order = await tx.shopOrder.findUnique({ where: { id }, include: orderInclude });
    if (!order || order.status === "CANCELLED") return;
    if (order.status !== "PAYMENT_REVIEW" || !order.payments.length || order.payments.some((p) => !["refunded", "charged_back", "rejected", "cancelled"].includes(p.status))) {
      throw new ShopOrderError("Todavía hay un pago acreditado o pendiente. Gestioná la devolución en Mercado Pago y verificá su estado antes de cerrar.");
    }
    if (order.reservationHeld) {
      for (const item of order.items) {
        const result = await tx.shopProduct.updateMany({ where: { id: item.productId, reservedStock: { gte: item.quantity } }, data: { reservedStock: { decrement: item.quantity }, version: { increment: 1 } } });
        if (result.count !== 1) throw new ShopOrderError("La reserva de stock requiere revisión.");
      }
    }
    // Goods already dispatched are not returned to inventory without a physical receipt.
    await event(tx, id, "CANCELLED", "Revisión cerrada tras verificar devolución o contracargo. Reserva liberada; mercadería entregada no repuesta automáticamente.", actorId, { reservationHeld: false });
  });
}

// Search the provider BEFORE releasing expired stock. A failed lookup leaves the reservation intact.
export async function reconcileShopOrder(prisma: PrismaClient, port: MercadoPagoPort, id: string, expectedLiveMode: boolean, now = new Date()) {
  const payments = await port.searchPayments(`shop:${id}`);
  for (const payment of payments) await applyShopPayment(prisma, payment, expectedLiveMode);
  const order = await prisma.shopOrder.findUnique({ where: { id } });
  if (order?.status === "AWAITING_PAYMENT" && order.expiresAt <= now) await closeUnpaidOrder(prisma, id, "EXPIRED", undefined, now);
}
