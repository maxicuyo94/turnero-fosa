import "dotenv/config";
import { request, type APIRequestContext } from "@playwright/test";
import { playwrightBaseUrl } from "./helpers/base-url";

// `next dev` compila cada ruta la primera vez que alguien la pide, y en frío eso tarda segundos:
// el costo cae sobre el primer `expect` que espera esa pantalla y lo vuelve intermitente. Acá
// pedimos todas las rutas antes de que empiece la suite, así los tests miden la app y no al
// compilador.
const publicRoutes = [
  "/",
  "/booking",
  "/booking/status",
  "/booking/payment",
  "/booking/cancel",
  "/internal/login",
];

// `proxy.ts` corta sin sesión antes de llegar a la página, así que estas se piden ya logueados.
const internalRoutes = [
  "/internal",
  "/internal/account",
  "/internal/shop",
  "/internal/shop/inventory",
  "/internal/shop/inventory/code",
  "/internal/shop/inventory/labels",
  "/internal/shop/counts",
  "/internal/vehicles",
  // Las rutas dinámicas se compilan aunque el id no exista.
  "/internal/shop/inventory/e2e-warmup",
  "/internal/shop/counts/e2e-warmup",
  "/internal/vehicles/e2e-warmup",
];

export default async function globalSetup() {
  const context = await request.newContext({ baseURL: playwrightBaseUrl });
  try {
    await warm(context, publicRoutes);
    if (await signIn(context)) {
      await warm(context, internalRoutes);
    } else {
      console.warn("e2e warmup: sin ADMIN_USERNAME/ADMIN_PASSWORD válidos, las rutas internas se compilan en el primer test.");
    }
  } finally {
    await context.dispose();
  }
}

async function warm(context: APIRequestContext, routes: string[]) {
  for (const route of routes) {
    await context.get(route, { maxRedirects: 0, failOnStatusCode: false });
  }
}

/** Inicia sesión con el admin del seed por la API de Auth.js; la cookie queda en el contexto. */
async function signIn(context: APIRequestContext): Promise<boolean> {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) return false;

  const { csrfToken } = (await (await context.get("/api/auth/csrf")).json()) as { csrfToken: string };
  await context.post("/api/auth/callback/credentials", {
    form: { csrfToken, username, password, callbackUrl: `${playwrightBaseUrl}/internal` },
    maxRedirects: 0,
    failOnStatusCode: false,
  });
  const session = (await (await context.get("/api/auth/session")).json()) as { user?: unknown } | null;
  return Boolean(session?.user);
}
