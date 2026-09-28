import { describe, expect, it } from "vitest";
import { planSubjectNames, suggestSubjectGroups } from "./commonSubjects";

describe("suggestSubjectGroups", () => {
  it("kurumda olan dersi önermez; büyük/küçük harf farkı aynı sayılır", () => {
    const groups = suggestSubjectGroups(["matematik", "FİZİK"]);
    const all = groups.flatMap(g => g.subjects);
    expect(all).not.toContain("Matematik");
    expect(all).not.toContain("Fizik");
    expect(all).toContain("Kimya");
  });

  it("iki grupta geçen ders yalnız ilk grupta çıkar", () => {
    const groups = suggestSubjectGroups([]);
    const turkce = groups.flatMap(g => g.subjects).filter(s => s === "Türkçe");
    expect(turkce).toHaveLength(1);
    expect(groups[0].subjects).toContain("Türkçe");
  });

  it("bütün dersleri olan grup hiç dönmez", () => {
    const lgs = suggestSubjectGroups([]).find(g => g.label === "LGS");
    const groups = suggestSubjectGroups(lgs?.subjects ?? []);
    expect(groups.map(g => g.label)).not.toContain("LGS");
  });
});

describe("planSubjectNames", () => {
  it("seçilenleri ve yazılanı birleştirir, tekrarı atar", () => {
    expect(planSubjectNames(["Fizik", "Kimya"], "  kimya ", [])).toEqual({
      names: ["Fizik", "Kimya"],
      error: null,
    });
  });

  it("kurumda olan ad hata verir, sessizce atlanmaz", () => {
    const plan = planSubjectNames([], "Matematik", ["MATEMATİK"]);
    expect(plan.names).toEqual([]);
    expect(plan.error).toBe('"Matematik" dersi zaten var.');
  });

  it("hiçbir şey seçilmemişse ne yapılacağını söyler", () => {
    expect(planSubjectNames([], "   ", []).error).toMatch(/en az bir ders/);
  });

  it("80 karakteri aşan ad reddedilir", () => {
    expect(planSubjectNames([], "x".repeat(81), []).error).toMatch(/80/);
  });
});
