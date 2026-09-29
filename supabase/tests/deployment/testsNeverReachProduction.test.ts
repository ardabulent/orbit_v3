import { describe, expect, it } from "vitest";
import { supabaseConfigured } from "../../../client/src/lib/supabaseClient";

/**
 * Kapı (2026-09-30): testler gerçek bir Supabase sunucusuna istek atamaz.
 *
 * Yerel .env üretim adresini taşıyordu ve vitest onu okuyordu; taklit
 * edilmemiş bir `functions.invoke` her test çalıştırmasında üretimdeki
 * switch-account'a gitti. `vitest.config.ts` artık .env okumuyor; bu test o
 * ayarın geri alınmasını yakalar.
 */
describe("testler üretime ulaşmaz", () => {
  it("test ortamında Supabase adresi tanımlı değildir", () => {
    expect(import.meta.env.VITE_SUPABASE_URL ?? "").toBe("");
    expect(supabaseConfigured).toBe(false);
  });
});
