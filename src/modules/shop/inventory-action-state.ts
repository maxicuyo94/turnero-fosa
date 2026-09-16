export type ShopActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  productId?: string;
  values?: Record<string, string>;
};

export const shopInitialActionState: ShopActionState = { status: "idle" };
