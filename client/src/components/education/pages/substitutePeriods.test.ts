import { describe, expect, it } from "vitest";
import type { SubstituteAssignment } from "@/education/substituteService";
import {
  currentCoverByAbsent,
  formatDateRange,
  groupSubstitutes,
  substitutePeriod,
} from "./substitutePeriods";

const row = (
  id: string,
  startsOn: string,
  endsOn: string,
  absent = "m1"
): SubstituteAssignment => ({
  id,
  organizationId: "org",
  absentMembershipId: absent,
  substituteMembershipId: "v1",
  startsOn,
  endsOn,
  note: null,
  archivedAt: null,
});

const TODAY = "2026-10-10";

describe("substitutePeriod", () => {
  it("iki uç dahildir: başlangıç ve bitiş günü sürer", () => {
    expect(substitutePeriod(row("a", TODAY, TODAY), TODAY)).toBe("current");
    expect(substitutePeriod(row("b", "2026-10-05", TODAY), TODAY)).toBe(
      "current"
    );
    expect(substitutePeriod(row("c", "2026-10-11", "2026-10-12"), TODAY)).toBe(
      "upcoming"
    );
    expect(substitutePeriod(row("d", "2026-10-01", "2026-10-09"), TODAY)).toBe(
      "past"
    );
  });
});

describe("groupSubstitutes", () => {
  it("süren ve yaklaşan en yakın önce, geçmiş en yeni önce", () => {
    const groups = groupSubstitutes(
      [
        row("up-far", "2026-10-20", "2026-10-21"),
        row("up-near", "2026-10-11", "2026-10-11"),
        row("past-old", "2026-09-01", "2026-09-02"),
        row("past-new", "2026-10-01", "2026-10-09"),
        row("cur", "2026-10-09", "2026-10-12"),
      ],
      TODAY
    );
    expect(groups.current.map(r => r.id)).toEqual(["cur"]);
    expect(groups.upcoming.map(r => r.id)).toEqual(["up-near", "up-far"]);
    expect(groups.past.map(r => r.id)).toEqual(["past-new", "past-old"]);
  });
});

describe("formatDateRange", () => {
  it("tek gün tek tarih, aralık iki tarih yazılır", () => {
    expect(formatDateRange("2026-10-05", "2026-10-05")).toBe("5 Eki");
    expect(formatDateRange("2026-10-05", "2026-10-20")).toBe("5 Eki – 20 Eki");
  });
});

describe("currentCoverByAbsent", () => {
  it("yalnız bugün süren vekillikler izinli öğretmene göre döner", () => {
    const map = currentCoverByAbsent(
      [
        row("cur", "2026-10-09", "2026-10-12", "m1"),
        row("up", "2026-10-11", "2026-10-12", "m2"),
      ],
      TODAY
    );
    expect([...map.keys()]).toEqual(["m1"]);
  });
});
