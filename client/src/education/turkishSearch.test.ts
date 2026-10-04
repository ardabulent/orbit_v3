import { describe, expect, it } from "vitest";
import {
  matchesSearch,
  searchFold,
  searchPattern,
  turkishNameKey,
} from "./turkishSearch";

/**
 * ⚠️ Bu tablo `supabase/tests/database/turkish_search.test.sql` ile AYNI
 * girdi → çıktı çiftlerini taşır. Biri değişirse öteki de değişmeli; aksi
 * halde istemci ve veritabanı farklı anahtar üretir.
 */
const FOLD_CASES: [string, string][] = [
  ["İlker", "ilker"],
  ["Işık", "isik"],
  ["IŞIK", "isik"],
  ["ışık", "isik"],
  ["Çağrı Öztürk", "cagri ozturk"],
  ["ŞÜKRÜ GÜNEŞ", "sukru gunes"],
  ["Ayşe Nur Koç-Yılmaz 9302", "ayse nur koc-yilmaz 9302"],
];

const NAME_KEY_CASES: [string, string][] = [
  ["  IŞIK  ", "işik"],
  ["Işık", "işik"],
  ["12-A SAYISAL", "12-a sayisal"],
  ["Hazırlık", "hazirlik"],
];

describe("Türkçe arama anahtarı (2026-10-03)", () => {
  it.each(FOLD_CASES)("search_fold(%s) = %s", (input, expected) => {
    expect(searchFold(input)).toBe(expected);
  });

  it.each(NAME_KEY_CASES)("turkish_name_key(%s) = %s", (input, expected) => {
    expect(turkishNameKey(input)).toBe(expected);
  });

  it("ilker İlker'i, isik Işık'ı, IŞIK ışık'ı bulur", () => {
    expect(matchesSearch("İlker Işık", "ilker")).toBe(true);
    expect(matchesSearch("İlker Işık", "isik")).toBe(true);
    expect(matchesSearch("ışık veli", "IŞIK")).toBe(true);
    expect(matchesSearch("Selin Koç", "ahmet")).toBe(false);
    expect(matchesSearch("Selin Koç", "   ")).toBe(true);
  });

  it("ilike deseni joker karakterleri kaçırır", () => {
    expect(searchPattern(" Işık ")).toBe("%isik%");
    expect(searchPattern("50%_a\\b")).toBe("%50\\%\\_a\\\\b%");
  });
});
