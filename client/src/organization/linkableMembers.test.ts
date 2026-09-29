import { describe, expect, it } from "vitest";
import { linkableMembers } from "./linkableMembers";
import type { OrganizationMember } from "./memberService";

const uye = (
  id: string,
  role: OrganizationMember["role"],
  linkedPerson: OrganizationMember["linkedPerson"]
): OrganizationMember => ({
  membershipId: id,
  displayName: id,
  loginNumber: null,
  role,
  branchName: null,
  status: "active",
  linkedPerson,
});

describe("linkableMembers (2026-09-30)", () => {
  const liste = [
    uye("bos-ogrenci", "student", null),
    uye("bagli-ogrenci", "student", {
      type: "student",
      id: "s1",
      name: "Selin",
    }),
    uye("okunamadi", "student", undefined),
    uye("bos-veli", "parent", null),
    uye("ogretmen", "teacher", null),
  ];

  it("yalnız boştaki öğrenci hesapları; başkasına bağlı ve okunamayan listede yok", () => {
    expect(linkableMembers(liste, "student").map(m => m.membershipId)).toEqual([
      "bos-ogrenci",
    ]);
  });

  it("veli listesi yalnız boştaki veli hesapları", () => {
    expect(linkableMembers(liste, "parent").map(m => m.membershipId)).toEqual([
      "bos-veli",
    ]);
  });
});
