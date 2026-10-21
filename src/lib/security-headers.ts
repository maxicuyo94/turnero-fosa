export function contentSecurityPolicy(nonce: string, production: boolean): string {
  return [
    "default-src 'self'", "base-uri 'none'", "object-src 'none'", "frame-ancestors 'none'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com${production ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob: https://res.cloudinary.com https://images.unsplash.com", "font-src 'self'",
    `connect-src 'self' https://challenges.cloudflare.com${production ? "" : " ws: wss:"}`,
    "frame-src https://challenges.cloudflare.com", "worker-src 'self' blob:",
    // Auth.js sign-out/sign-in and Mercado Pago checkout use cross-origin navigation.
    "form-action 'self' https://*.mercadopago.com https://*.mercadopago.com.ar",
    ...(production ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}
