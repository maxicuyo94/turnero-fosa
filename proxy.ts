import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";

/**
 * First line of defence for the internal area: no page or action under /internal runs without a
 * session. Pages and actions still call `requireStaff()`, which checks the account and its role.
 */
export default auth((request) => {
  if (request.auth || request.nextUrl.pathname === "/internal/login") return NextResponse.next();
  return NextResponse.redirect(new URL("/internal/login", request.nextUrl));
});

export const config = {
  matcher: ["/internal", "/internal/:path*"],
};
