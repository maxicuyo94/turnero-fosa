import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required for PostgreSQL access."),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters."),
  NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL must be a valid URL."),
  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required for email delivery."),
  EMAIL_FROM: z.string().min(1, "EMAIL_FROM is required for outbound email."),
});

export type AppEnv = z.infer<typeof envSchema>;

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

export const appEnvSchema = envSchema;
