import type { ReactNode } from "react";
import { InternalShell, InternalSubNav } from "@/src/modules/internal/internal-shell";

export function ShopShell({ active, children, signedInUserName, canManageWorkshop }: { active: "summary" | "inventory" | "counts" | "orders" | "store"; children: ReactNode; signedInUserName?: string | null; canManageWorkshop?: boolean }) {
  return <InternalShell active="shop" canManageWorkshop={canManageWorkshop} signedInUserName={signedInUserName}>
    <InternalSubNav label="Secciones de repuestos" items={[
      { label: "Resumen", href: "/internal/shop", active: active === "summary" },
      { label: "Inventario", href: "/internal/shop/inventory", active: active === "inventory" },
      { label: "Conteos", href: "/internal/shop/counts", active: active === "counts" },
      { label: "Pedidos", href: "/internal/shop/orders", active: active === "orders" },
      ...(canManageWorkshop ? [{ label: "Tienda online", href: "/internal/shop/store", active: active === "store" }] : []),
    ]} />{children}
  </InternalShell>;
}
