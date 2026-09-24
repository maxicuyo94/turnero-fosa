import { encode } from "uqr";

// Codigos de las etiquetas internas del taller. Codifican el SKU, no un GTIN del fabricante,
// y los lee el escaner del panel; el Code 128 tambien lo leen los lectores USB.

// Anchos de barra/espacio de cada simbolo 0..106, empezando por barra. 106 es el stop.
const PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
] as const;

const START_B = 104;
const STOP = 106;
/** Con mas caracteres las barras quedan demasiado finas en una etiqueta de 60 mm. */
export const CODE128_MAX_LENGTH = 20;

/**
 * Anchos alternados barra/espacio del codigo, en modulos y sin zona de silencio.
 * Devuelve null si el texto no es ASCII imprimible o no entra en una etiqueta.
 */
export function code128Widths(text: string): number[] | null {
  if (!text || text.length > CODE128_MAX_LENGTH || !/^[\x20-\x7e]+$/u.test(text)) return null;
  const values = [...text].map((character) => character.charCodeAt(0) - 32);
  const checksum = values.reduce((sum, value, index) => sum + value * (index + 1), START_B) % 103;
  return [START_B, ...values, checksum, STOP].flatMap((symbol) => [...PATTERNS[symbol]].map(Number));
}

export type LabelCode = { kind: "code128"; widths: number[] } | { kind: "qr"; modules: boolean[][] };

/**
 * Code 128 para SKU cortos, que tambien lee un lector USB; QR para los largos, como los
 * generados automaticamente. Null si el SKU no es ASCII imprimible: no se puede imprimir.
 */
export function labelCodeFor(sku: string): LabelCode | null {
  const widths = code128Widths(sku);
  if (widths) return { kind: "code128", widths };
  if (!/^[ -~]{1,80}$/u.test(sku)) return null;
  return { kind: "qr", modules: encode(sku, { ecc: "M", border: 0 }).data };
}

/** Patrones crudos, expuestos solo para validar la tabla en pruebas. */
export const code128Patterns: readonly string[] = PATTERNS;
