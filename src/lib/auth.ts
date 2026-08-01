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
        username: { label: "Usuario", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const username = typeof credentials.username === "string" ? credentials.username.trim().toLowerCase() : "";
        const password = typeof credentials.password === "string" ? credentials.password : "";
        if (!username || !password) return null;

        const { db } = await import("@/src/lib/db");
        const user = await db.user.findUnique({ where: { username } });
        if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) return null;

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
