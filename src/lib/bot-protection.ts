type BotEnv = Record<string, string | undefined>;

/** Tokens are checked by the provider on the server; missing configuration fails closed in production. */
export async function verifyBotProtection(form: FormData, action: string, env: BotEnv = process.env): Promise<boolean> {
  if (form.get("website")) return false;
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) return env.NODE_ENV !== "production";
  const token = form.get("cf-turnstile-response");
  if (typeof token !== "string" || !token || token.length > 2048) return false;
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token }), signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;
    const result = await response.json() as { success?: boolean; hostname?: string; action?: string };
    const hostname = env.TURNSTILE_ALLOWED_HOSTNAME || (env.NEXT_PUBLIC_APP_URL ? new URL(env.NEXT_PUBLIC_APP_URL).hostname : undefined);
    return result.success === true && result.action === action && Boolean(hostname && result.hostname === hostname);
  } catch { return false; }
}
