import { describe, expect, it } from "vitest";
import type { Role } from "../types";
import {
  SETTINGS_CATEGORIES,
  type SettingsCategoryId,
} from "./settingsCategories";

function visibleCategoryIds(role: Role): SettingsCategoryId[] {
  return SETTINGS_CATEGORIES.filter(item => item.roles.includes(role)).map(
    item => item.id
  );
}

describe("settingsCategories role visibility", () => {
  it("admin rolü için 11 kategorinin hepsini görünür kılar", () => {
    const adminCategories = visibleCategoryIds("admin");

    expect(adminCategories).toEqual([
      "profil",
      "kurum",
      "uyeler",
      "bildirimler",
      "roller",
      "sistem",
      "guvenlik",
      "tema",
      "arsiv",
      "veri-yonetimi",
      "veri-ice-aktarma",
    ]);
    expect(adminCategories).toHaveLength(11);
  });

  it("teacher rolü için tam olarak 4 kişisel kategoriyi gösterir (yönetim kategorileri gizli)", () => {
    const teacherCategories = visibleCategoryIds("teacher");

    expect(teacherCategories).toEqual([
      "profil",
      "bildirimler",
      "guvenlik",
      "tema",
    ]);
    expect(teacherCategories).not.toContain("uyeler");
    expect(teacherCategories).not.toContain("kurum");
    expect(teacherCategories).not.toContain("roller");
    expect(teacherCategories).not.toContain("sistem");
    expect(teacherCategories).not.toContain("veri-yonetimi");
    expect(teacherCategories).not.toContain("arsiv");
    expect(teacherCategories).not.toContain("veri-ice-aktarma");
  });

  it("student rolü için tam olarak 4 kişisel kategoriyi gösterir", () => {
    const studentCategories = visibleCategoryIds("student");

    expect(studentCategories).toEqual([
      "profil",
      "bildirimler",
      "guvenlik",
      "tema",
    ]);
  });

  it("parent rolü için tam olarak 4 kişisel kategoriyi gösterir", () => {
    const parentCategories = visibleCategoryIds("parent");

    expect(parentCategories).toEqual([
      "profil",
      "bildirimler",
      "guvenlik",
      "tema",
    ]);
  });

  it("her kategorinin en az bir geçerli rolü olduğunu doğrular", () => {
    for (const category of SETTINGS_CATEGORIES) {
      expect(category.roles.length).toBeGreaterThan(0);
    }
  });
});
