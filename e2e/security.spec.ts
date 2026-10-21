import { expect, test } from "@playwright/test";

test("pages deliver a nonce CSP without blocking hydration", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (message) => { if (/Content Security Policy|violates.*directive/iu.test(message.text())) violations.push(message.text()); });
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  const csp = response?.headers()["content-security-policy"] ?? "";
  const nonce = csp.match(/'nonce-([^']+)'/u)?.[1];
  expect(nonce).toBeTruthy();
  expect(csp).toContain("frame-ancestors 'none'");
  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  const scripts = await page.locator("script").evaluateAll((nodes) => nodes.map((node) => node as HTMLScriptElement).filter((node) => node.type !== "application/json" && node.type !== "application/ld+json").map((node) => node.nonce));
  expect(scripts).toContain(nonce);
  await page.goto("/booking/status");
  await page.getByText("¿Perdiste el código?", { exact: true }).click();
  await page.getByRole("textbox", { name: "Email de la reserva" }).fill("security-probe@example.invalid");
  // A trapped submission proves the interactive action runs while preventing any outbound email.
  await page.locator('input[name="website"]').evaluate((node) => { (node as HTMLInputElement).value = "bot-probe"; });
  await page.getByRole("button", { name: "Enviar códigos por email" }).click();
  await expect(page.getByText(/Completá la verificación|El envío de emails no está disponible|Alcanzaste el límite|No pudimos procesar/u)).toBeVisible();
  expect(violations).toEqual([]);
});

test("private pages reject unauthenticated users and secret-link pages avoid caching", async ({ page, request }) => {
  await page.goto("/internal");
  await expect(page).toHaveURL(/\/internal\/login/u);
  await expect(page.getByRole("heading", { name: "Acceso interno" })).toBeVisible();
  const response = await request.get("/booking/status");
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  for (const route of ["/api/cron/emails", "/api/cron/deposits", "/api/cron/shop"]) {
    expect((await request.get(route)).status()).toBeGreaterThanOrEqual(400);
  }
});
