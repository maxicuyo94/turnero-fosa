import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required for PostgreSQL access."),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters."),
  NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL must be a valid URL."),
  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required for email delivery."),
  EMAIL_FROM: z.string().min(1, "EMAIL_FROM is required for outbound email."),
  MERCADO_PAGO_ACCESS_TOKEN: z.preprocess((value) => value === "" ? undefined : value, z.string().min(1).optional()),
  MERCADO_PAGO_WEBHOOK_SECRET: z.preprocess((value) => value === "" ? undefined : value, z.string().min(1).optional()),
  MERCADO_PAGO_ENVIRONMENT: z.enum(["test", "production"]).optional(),
});

export type AppEnv = z.infer<typeof envSchema>;
export type NotificationEnv = Pick<AppEnv, "RESEND_API_KEY" | "EMAIL_FROM">;
export type MercadoPagoEnv = {
  MERCADO_PAGO_ACCESS_TOKEN: string;
  MERCADO_PAGO_WEBHOOK_SECRET: string;
  MERCADO_PAGO_ENVIRONMENT: "test" | "production";
  /** Origin that checkout return links and payment notifications point back to. */
  NEXT_PUBLIC_APP_URL: string;
  /** Vercel "Protection Bypass for Automation" secret, set only on protected preview deployments. */
  VERCEL_PROTECTION_BYPASS?: string;
};

export function getEnv(input: Record<string, string | undefined> = process.env): AppEnv {
  const result = envSchema.safeParse(input);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    throw new Error(`Invalid application configuration. ${details}`);
  }

  return result.data;
}

export function getDatabaseUrl(input: Record<string, string | undefined> = process.env): string {
  return envSchema.shape.DATABASE_URL.parse(input.DATABASE_URL);
}

export function getNotificationEnv(input: Record<string, string | undefined> = process.env): NotificationEnv | null {
  if (!input.RESEND_API_KEY?.trim() && !input.EMAIL_FROM?.trim()) return null;

  return {
    RESEND_API_KEY: envSchema.shape.RESEND_API_KEY.parse(input.RESEND_API_KEY),
    EMAIL_FROM: envSchema.shape.EMAIL_FROM.parse(input.EMAIL_FROM),
  };
}

export function getMercadoPagoEnv(input: Record<string, string | undefined> = process.env): MercadoPagoEnv | null {
  const accessToken = input.MERCADO_PAGO_ACCESS_TOKEN?.trim();
  const webhookSecret = input.MERCADO_PAGO_WEBHOOK_SECRET?.trim();
  if (!accessToken && !webhookSecret) return null;
  if (!accessToken || !webhookSecret) {
    throw new Error("Mercado Pago requires both MERCADO_PAGO_ACCESS_TOKEN and MERCADO_PAGO_WEBHOOK_SECRET.");
  }

  return {
    MERCADO_PAGO_ACCESS_TOKEN: accessToken,
    MERCADO_PAGO_WEBHOOK_SECRET: webhookSecret,
    MERCADO_PAGO_ENVIRONMENT: envSchema.shape.MERCADO_PAGO_ENVIRONMENT.parse(input.MERCADO_PAGO_ENVIRONMENT) ?? "test",
    NEXT_PUBLIC_APP_URL: envSchema.shape.NEXT_PUBLIC_APP_URL.parse(previewBranchOrigin(input) ?? input.NEXT_PUBLIC_APP_URL),
    ...(isVercelPreview(input) && input.VERCEL_AUTOMATION_BYPASS_SECRET?.trim()
      ? { VERCEL_PROTECTION_BYPASS: input.VERCEL_AUTOMATION_BYPASS_SECRET.trim() }
      : {}),
  };
}

function isVercelPreview(input: Record<string, string | undefined>): boolean {
  return input.VERCEL_ENV === "preview";
}

/**
 * On a Vercel preview, the stable branch URL (`<project>-git-<branch>-….vercel.app`). A preview
 * must send customers and Mercado Pago back to itself, never to the production domain that
 * NEXT_PUBLIC_APP_URL or the workshop settings hold.
 */
function previewBranchOrigin(input: Record<string, string | undefined>): string | undefined {
  const branchUrl = input.VERCEL_BRANCH_URL?.trim();
  return isVercelPreview(input) && branchUrl ? `https://${branchUrl}` : undefined;
}

export const appEnvSchema = envSchema;
