/** Build links from the stored number without guessing a missing country or area code. */
export function contactLinks(phone: string): { call: string; whatsapp: string } | null {
  const digits = phone.replace(/\D/gu, "");
  if (digits.length < 6 || digits.length > 20) return null;
  return {
    call: `tel:${phone.trim().startsWith("+") ? "+" : ""}${digits}`,
    whatsapp: `https://wa.me/${digits}`,
  };
}
