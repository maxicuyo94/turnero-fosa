import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verifyPassword } from "@/src/lib/password";

export { createPasswordHash, verifyPassword } from "@/src/lib/password";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/internal/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = typeof credentials.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        const { db } = await import("@/src/lib/db");
        const user = await db.user.findUnique({ where: { email } });
        if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      const tokenId = typeof token.id === "string" ? token.id : token.sub;
      if (session.user && tokenId) (session.user as { id?: string }).id = tokenId;
      return session;
    },
  },
});

export function isInternalSession(session: unknown): boolean {
  if (!session || typeof session !== "object") return false;
  const user = (session as { user?: { email?: unknown } }).user;
  return typeof user?.email === "string" && user.email.trim().length > 0;
}

export function getInternalSessionUserId(session: unknown): string | null {
  if (!session || typeof session !== "object") return null;
  const user = (session as { user?: { id?: unknown } }).user;
  return typeof user?.id === "string" && user.id.trim().length > 0 ? user.id : null;
}

export function getInternalSessionDisplayName(session: unknown): string | null {
  if (!isInternalSession(session)) return null;
  const user = (session as { user?: { name?: unknown; email?: unknown } }).user;
  if (typeof user?.name === "string" && user.name.trim().length > 0) return user.name;
  return typeof user?.email === "string" && user.email.trim().length > 0 ? user.email : null;
}
