import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { contentSecurityPolicy } from "@/src/lib/security-headers";

/**
 * First line of defence for the internal area: no page or action under /internal runs without a
 * session. Pages and actions still call `requireStaff()`, which checks the account and its role.
 */
export default auth((request) => {
  const production = process.env.NODE_ENV === "production";
  // Vercel overwrites this header. Self-hosted TLS proxies must also overwrite it.
  const protocol = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  if (production && protocol === "http") {
    const target = request.nextUrl.clone();
    target.protocol = "https:";
    return NextResponse.redirect(target, 308);
  }
  if (request.nextUrl.pathname.startsWith("/internal") && !request.auth && request.nextUrl.pathname !== "/internal/login") {
    return NextResponse.redirect(new URL("/internal/login", request.nextUrl));
  }
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce, production);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", csp);
  requestHeaders.set("x-nonce", nonce);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|vendor/|.*\\.(?:png|jpg|svg|ico|webmanifest|xlsx)$).*)"],
};
