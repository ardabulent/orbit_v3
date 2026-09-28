import { describe, expect, it } from "vitest";
import type { Homework } from "../types";
import {
  groupStaffHomework,
  groupStudentHomework,
  studentHomeworkStatus,
} from "./homeworkGroups";

const TODAY = "2026-09-29";

const hw = (id: string, due: string, recorded = false): Homework => ({
  id,
  classGroup: "12-A",
  subject: null,
  title: id,
  description: "",
  assignedDate: "",
  dueDate: due,
  rawDueDate: due,
  status: "Aktif",
  submissionsRecordedAt: recorded ? "2026-09-28T10:00:00Z" : null,
});

describe("groupStaffHomework", () => {
  it("kontrol bekleyen (geçmiş, işaretlenmemiş) · aktif · tamamlanan", () => {
    const groups = groupStaffHomework(
      [
        hw("gecmis-yeni", "2026-09-28"),
        hw("gecmis-eski", "2026-09-20"),
        hw("bugun", TODAY),
        hw("ileri", "2026-10-05"),
        hw("bitti", "2026-09-25", true),
      ],
      TODAY
    );
    expect(groups.toCheck.map(h => h.id)).toEqual([
      "gecmis-eski",
      "gecmis-yeni",
    ]);
    expect(groups.active.map(h => h.id)).toEqual(["bugun", "ileri"]);
    expect(groups.done.map(h => h.id)).toEqual(["bitti"]);
  });
});

describe("studentHomeworkStatus", () => {
  it("işaretleme bittiyse satırın varlığı karar verir", () => {
    expect(
      studentHomeworkStatus(hw("a", "2026-09-25", true), true, TODAY).label
    ).toBe("Teslim edildi");
    expect(
      studentHomeworkStatus(hw("a", "2026-09-25", true), false, TODAY).label
    ).toBe("Getirilmedi");
  });

  it("işaretleme bitmeden 'getirilmedi' denmez", () => {
    expect(
      studentHomeworkStatus(hw("a", "2026-09-25"), false, TODAY).label
    ).toBe("Kontrol bekleniyor");
    // Bitmeden teslim alınmışsa teslim edildi.
    expect(
      studentHomeworkStatus(hw("a", "2026-09-25"), true, TODAY).label
    ).toBe("Teslim edildi");
  });

  it("yaklaşan: bugün, yarın, N gün kaldı", () => {
    expect(studentHomeworkStatus(hw("a", TODAY), false, TODAY).label).toBe(
      "Bugün teslim"
    );
    expect(
      studentHomeworkStatus(hw("a", "2026-09-30"), false, TODAY).label
    ).toBe("Yarın teslim");
    expect(
      studentHomeworkStatus(hw("a", "2026-10-04"), false, TODAY).label
    ).toBe("5 gün kaldı");
  });
});

describe("groupStudentHomework", () => {
  it("yaklaşan · getirilmedi · geçmiş", () => {
    const groups = groupStudentHomework(
      [
        hw("ileri", "2026-10-02"),
        hw("getirmedi", "2026-09-25", true),
        hw("getirdi", "2026-09-24", true),
        hw("bekliyor", "2026-09-27"),
      ],
      new Set(["getirdi"]),
      TODAY
    );
    expect(groups.upcoming.map(h => h.id)).toEqual(["ileri"]);
    expect(groups.missed.map(h => h.id)).toEqual(["getirmedi"]);
    expect(groups.past.map(h => h.id)).toEqual(["bekliyor", "getirdi"]);
  });
});
