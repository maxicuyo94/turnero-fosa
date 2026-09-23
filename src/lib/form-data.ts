/** Reads server-action form fields; files and missing keys become empty strings. */
export function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function formOptionalString(formData: FormData, key: string): string | undefined {
  const value = formString(formData, key).trim();
  return value.length > 0 ? value : undefined;
}

export function formOptionalNumber(formData: FormData, key: string): number | undefined {
  const value = formString(formData, key).trim();
  return value ? Number(value) : undefined;
}

export function formValues(formData: FormData): Record<string, string> {
  return Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [key, typeof value === "string" ? value : ""]));
}
