import { describe, expect, it } from "vitest";
import { catalogDetailsSchema, catalogImageUrl, normalizeSearch } from "@/src/modules/shop/catalog-schemas";
describe("catalog data boundaries", () => {
  it("rejects unsafe image sources and credentials", () => {
    for (const url of ["javascript:alert(1)", "http://localhost/a.jpg", "https://user:pass@res.cloudinary.com/a.jpg", "https://res.cloudinary.com.attacker.invalid/a.jpg", "/images/../secret.jpg"]) expect(catalogImageUrl.safeParse(url).success).toBe(false);
    expect(catalogImageUrl.safeParse("https://res.cloudinary.com/shop/image/upload/photo.jpg").success).toBe(true);
    expect(catalogImageUrl.safeParse("/images/parts/filter.webp").success).toBe(true);
  });
  it("rejects inverted years and duplicate models after normalizing", () => {
    const fit = {brand:"Honda",model:"Wave",variant:"110",yearFrom:"2020",yearTo:"2024"};
    const input = {id:"part",version:0,images:[],fitments:[fit]};
    expect(catalogDetailsSchema.parse(input).fitments[0]).toMatchObject({brand:"HONDA",yearFrom:2020});
    expect(catalogDetailsSchema.safeParse({...input,fitments:[{...fit,yearTo:"2019"}]}).success).toBe(false);
    expect(catalogDetailsSchema.safeParse({...input,fitments:[fit,{...fit,brand:" honda "}]}).success).toBe(false);
    expect(normalizeSearch("  TRANSMISIÓN  ")).toBe("transmision");
  });
});
