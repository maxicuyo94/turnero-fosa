import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import {
  PrismaLoginThrottleStore,
  checkLoginAllowed,
  clientIpFromHeaders,
  loginThrottleKeys,
  recordLoginFailure,
  recordLoginSuccess,
} from "@/src/lib/login-throttle";
import { verifyPassword, verifyPasswordAgainstDummy } from "@/src/lib/password";

export { createPasswordHash, verifyPassword } from "@/src/lib/password";

/** Surfaces a lockout to the login page; the code never says whether the username exists. */
export class TooManyLoginAttemptsError extends CredentialsSignin {
  code = "too_many_attempts";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/internal/login" },
  providers: [
    Credentials({
      credentials: {
        username: { label: "Usuario", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const username = typeof credentials.username === "string" ? credentials.username.trim().toLowerCase() : "";
        const password = typeof credentials.password === "string" ? credentials.password : "";
        if (!username || !password) return null;

        const { db } = await import("@/src/lib/db");
        const throttle = new PrismaLoginThrottleStore(db);
        const keys = loginThrottleKeys({ username, ip: clientIpFromHeaders(request?.headers) });
        if (!(await checkLoginAllowed(throttle, keys))) throw new TooManyLoginAttemptsError();

        const user = await db.user.findUnique({ where: { username } });
        // Unknown users still pay for a scrypt run, so response time does not reveal valid usernames.
        const valid = user?.passwordHash
          ? await verifyPassword(password, user.passwordHash)
          : await verifyPasswordAgainstDummy(password);
        if (!user || !valid) {
          await recordLoginFailure(throttle, keys);
          return null;
        }

        await recordLoginSuccess(throttle, username);
        return { id: user.id, email: user.email, name: user.name, username: user.username };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      const username = (user as { username?: unknown } | undefined)?.username;
      if (typeof username === "string") token.username = username;
      return token;
    },
    session({ session, token }) {
      const tokenId = typeof token.id === "string" ? token.id : token.sub;
      if (session.user && tokenId) {
        const sessionUser = session.user as { id?: string; username?: string };
        sessionUser.id = tokenId;
        if (typeof token.username === "string") sessionUser.username = token.username;
      }
      return session;
    },
  },
});

export function isInternalSession(session: unknown): boolean {
  if (!session || typeof session !== "object") return false;
  const user = (session as { user?: { id?: unknown; username?: unknown; email?: unknown } }).user;
  return [user?.id, user?.username, user?.email].some((value) => typeof value === "string" && value.trim().length > 0);
}

export function getInternalSessionUserId(session: unknown): string | null {
  if (!session || typeof session !== "object") return null;
  const user = (session as { user?: { id?: unknown } }).user;
  return typeof user?.id === "string" && user.id.trim().length > 0 ? user.id : null;
}

export function getInternalSessionDisplayName(session: unknown): string | null {
  if (!isInternalSession(session)) return null;
  const user = (session as { user?: { name?: unknown; username?: unknown; email?: unknown } }).user;
  if (typeof user?.name === "string" && user.name.trim().length > 0) return user.name;
  if (typeof user?.username === "string" && user.username.trim().length > 0) return user.username;
  return typeof user?.email === "string" && user.email.trim().length > 0 ? user.email : null;
}
