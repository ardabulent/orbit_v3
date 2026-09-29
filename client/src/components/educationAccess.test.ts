import { describe, expect, it } from "vitest";
import {
  availableEducationSections,
  canAccessEducationSection,
} from "./educationAccess";

describe("education role access", () => {
  it("gives the administrator access to the full Faz 1 MVP navigation", () => {
    // Otomasyon sekmesi kaldırıldı (v1.5-10, karar 2026-09-16).
    expect(availableEducationSections("admin")).not.toContain(
      "Otomasyonlar" as never
    );
    expect(availableEducationSections("admin")).toContain("Kayıt ve Ödemeler");
    // v1.2-12'de "Denetim Kaydı" eklendi: 13 -> 14.
    // 2026-09-29: "Otomasyonlar" kaldırıldı (v1.5-10, karar 2026-09-16): 14 -> 13.
    expect(availableEducationSections("admin")).toHaveLength(13);
  });

  it("gives the day-plan workspace to admin and teacher only", () => {
    expect(canAccessEducationSection("admin", "Gün Planı")).toBe(true);
    expect(canAccessEducationSection("teacher", "Gün Planı")).toBe(true);
    expect(canAccessEducationSection("student", "Gün Planı")).toBe(false);
    expect(canAccessEducationSection("parent", "Gün Planı")).toBe(false);
  });

  it("keeps the teacher inside academic and classroom operations", () => {
    expect(canAccessEducationSection("teacher", "Yoklama")).toBe(true);
    expect(canAccessEducationSection("teacher", "Öğrenciler")).toBe(true);
    expect(canAccessEducationSection("teacher", "Kayıt ve Ödemeler")).toBe(
      false
    );
  });

  it("limits student and parent views to their own operational context", () => {
    expect(availableEducationSections("student")).toEqual([
      "Genel Bakış",
      "Ders Programı",
      "Sınavlar",
      "Ödevler",
      "İletişim",
      "Ayarlar",
    ]);
    expect(canAccessEducationSection("parent", "Kayıt ve Ödemeler")).toBe(true);
    expect(canAccessEducationSection("parent", "Öğrenciler")).toBe(false);
  });

  it("gives every role access to Ödevler, with capability handled inside the page", () => {
    expect(canAccessEducationSection("admin", "Ödevler")).toBe(true);
    expect(canAccessEducationSection("teacher", "Ödevler")).toBe(true);
    expect(canAccessEducationSection("student", "Ödevler")).toBe(true);
    expect(canAccessEducationSection("parent", "Ödevler")).toBe(true);
  });

  // v1.2-12. Denetim kaydı YALNIZCA kurum yöneticisine açıktır ve bunun iki
  // ayrı kapısı var: bu erişim listesi ve `audit_events_select_admin`
  // politikası. İkisi de gerekli — istemci kapısı deneyim, RLS güvenliktir.
  //
  // Bu test istemci kapısını sabitliyor. Sunucu kapısı
  // `password_lock_boundary.test.sql` ve `tenant_rls.test.sql`'de.
  it("keeps the audit log visible to the institution admin only", () => {
    expect(canAccessEducationSection("admin", "Denetim Kaydı")).toBe(true);
    expect(canAccessEducationSection("teacher", "Denetim Kaydı")).toBe(false);
    expect(canAccessEducationSection("student", "Denetim Kaydı")).toBe(false);
    expect(canAccessEducationSection("parent", "Denetim Kaydı")).toBe(false);
  });

  it("gives every role access to Ayarlar, with category visibility handled inside the settings page", () => {
    expect(canAccessEducationSection("admin", "Ayarlar")).toBe(true);
    expect(canAccessEducationSection("teacher", "Ayarlar")).toBe(true);
    expect(canAccessEducationSection("student", "Ayarlar")).toBe(true);
    expect(canAccessEducationSection("parent", "Ayarlar")).toBe(true);
  });
});
