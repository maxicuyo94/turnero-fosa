import { z } from "zod";

export const catalogImageHosts = ["res.cloudinary.com", "images.unsplash.com"];
export const catalogImageUrl = z.string().trim().max(2000).refine((value) => {
  if (/^\/images\/[a-zA-Z0-9/_-]+\.(png|jpe?g|webp)$/u.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port && catalogImageHosts.includes(url.hostname);
  } catch { return false; }
}, "Usá una foto de Cloudinary, Unsplash o de la carpeta /images del sitio.");

const year = z.union([z.literal(""), z.coerce.number().int().min(1900).max(2100)]).transform((value) => value === "" ? null : value);
export const catalogDetailsSchema = z.object({
  id: z.string().min(1).max(128), version: z.coerce.number().int().min(0),
  images: z.array(z.object({ url: catalogImageUrl, alt: z.string().trim().min(1).max(160) })).max(6),
  fitments: z.array(z.object({
    brand: z.string().trim().min(1).max(80).transform((v) => v.toUpperCase()),
    model: z.string().trim().min(1).max(100).transform((v) => v.toUpperCase()),
    variant: z.string().trim().max(100).transform((v) => v.toUpperCase()),
    yearFrom: year, yearTo: year,
  }).refine((v) => v.yearFrom === null || v.yearTo === null || v.yearFrom <= v.yearTo, "El año final debe ser igual o posterior al inicial.")).max(20),
}).refine((v) => new Set(v.fitments.map((f) => [f.brand, f.model, f.variant].join("|"))).size === v.fitments.length, "No repitas la misma marca, modelo y versión.");

export function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es-AR").trim();
}
