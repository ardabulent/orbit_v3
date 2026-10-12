import { describe, expect, it } from "vitest";
import {
  getAffectedQueryKeys,
  REALTIME_BATCH_DEBOUNCE_MS,
  type EducationTable,
} from "./realtimeMapping";
import { educationKeys } from "@/education/educationQueries";
import { settingsKeys } from "@/settings/settingsQueries";

describe("realtimeMapping (K-06 ve K-19 Sorgu Anahtarı Eşlemesi)", () => {
  const orgId = "org-uuid-test";

  it("birleştirme (debounce) penceresi 300 ms olarak tanımlıdır", () => {
    expect(REALTIME_BATCH_DEBOUNCE_MS).toBe(300);
  });

  it("kurum kimliği boş veya tanımsızken hiçbir sorgu döndürmez", () => {
    expect(getAffectedQueryKeys("students", "")).toEqual([]);
    expect(getAffectedQueryKeys("installments", "")).toEqual([]);
  });

  it("bilinmeyen veya dinlenmeyen tablolarda boş dizi döner", () => {
    expect(getAffectedQueryKeys("audit_events", orgId)).toEqual([]);
    expect(getAffectedQueryKeys("organization_memberships", orgId)).toEqual([]);
    expect(getAffectedQueryKeys("unknown_table", orgId)).toEqual([]);
  });

  // ⛔ Öğrenci ADI üç yerde okunuyor: öğrenci listesinde doğrudan, yoklama ve
  // ödeme servislerinin `select`'lerinde GÖMÜLÜ (`students ( full_name )`).
  // Yalnız öğrenci sorgusu tazelenirse yönetici bir adı düzelttiğinde ödeme
  // ekranı eski adı göstermeye devam eder — sessiz bayatlık.
  it("1. students: öğrenci, yoklama ve ödeme sorgularını tazeler (ad gömülü okunuyor)", () => {
    const keys = getAffectedQueryKeys("students", orgId);
    expect(keys).toHaveLength(3);
    expect(keys).toContainEqual(educationKeys.students(orgId));
    expect(keys).toContainEqual(educationKeys.attendance(orgId));
    expect(keys).toContainEqual(educationKeys.payments(orgId));
    // ⛔ Ders programı öğrenci adı okumuyor; oraya dokunulmamalı.
    expect(keys).not.toContainEqual(educationKeys.schedule(orgId));
  });

  // ⛔ Sınıf adı `scheduleService`'in `select`'inde de gömülü okunuyor.
  it("2. classes: sınıf, öğrenci ve ders programı sorgularını tazeler (sınıf adı gömülü)", () => {
    const keys = getAffectedQueryKeys("classes", orgId);
    expect(keys).toHaveLength(3);
    expect(keys).toContainEqual(educationKeys.classes(orgId));
    expect(keys).toContainEqual(educationKeys.students(orgId));
    expect(keys).toContainEqual(educationKeys.schedule(orgId));
  });

  it("3. class_enrollments: hem sınıf (studentCount) hem öğrenci (group) sorgusunu tazeler", () => {
    const keys = getAffectedQueryKeys("class_enrollments", orgId);
    expect(keys).toHaveLength(2);
    expect(keys).toContainEqual(educationKeys.classes(orgId));
    expect(keys).toContainEqual(educationKeys.students(orgId));
  });

  it("4. schedule_entries: yalnızca ders programı sorgusunu tazeler", () => {
    const keys = getAffectedQueryKeys("schedule_entries", orgId);
    expect(keys).toHaveLength(1);
    expect(keys[0]).toEqual(educationKeys.schedule(orgId));
  });

  it("5. attendance_sessions: hem yoklama hem öğrenci (Student.attendance) sorgusunu tazeler", () => {
    const keys = getAffectedQueryKeys("attendance_sessions", orgId);
    expect(keys).toHaveLength(2);
    expect(keys).toContainEqual(educationKeys.attendance(orgId));
    expect(keys).toContainEqual(educationKeys.students(orgId));
  });

  it("6. attendance_records: hem yoklama hem öğrenci (Student.attendance) sorgusunu tazeler", () => {
    const keys = getAffectedQueryKeys("attendance_records", orgId);
    expect(keys).toHaveLength(2);
    expect(keys).toContainEqual(educationKeys.attendance(orgId));
    expect(keys).toContainEqual(educationKeys.students(orgId));
  });

  it("7. exams: hem sınav hem öğrenci (Student.score) sorgusunu ve açık sınav detayını tazeler", () => {
    const keys = getAffectedQueryKeys("exams", orgId);
    expect(keys).toHaveLength(3);
    expect(keys).toContainEqual(["education", "examSheet"]);
    expect(keys).toContainEqual(educationKeys.exam(orgId));
    expect(keys).toContainEqual(educationKeys.students(orgId));
  });

  it("8. exam_results: hem sınav (katılımcı sayısı) hem öğrenci (Student.score) sorgusunu ve açık sınav detayını tazeler", () => {
    const keys = getAffectedQueryKeys("exam_results", orgId);
    expect(keys).toHaveLength(3);
    expect(keys).toContainEqual(["education", "examSheet"]);
    expect(keys).toContainEqual(educationKeys.exam(orgId));
    expect(keys).toContainEqual(educationKeys.students(orgId));
  });

  it("9. payment_plans: ödeme listesi, özet kartları ve öğrenci (Student.payment) sorgusunu tazeler", () => {
    const keys = getAffectedQueryKeys("payment_plans", orgId);
    expect(keys).toHaveLength(3);
    expect(keys).toContainEqual(educationKeys.payments(orgId));
    expect(keys).toContainEqual(educationKeys.paymentOverview(orgId));
    expect(keys).toContainEqual(educationKeys.students(orgId));
  });

  it("10. installments: ödeme, taksitler, özet ve öğrenci (Student.payment) sorgusunu tazeler", () => {
    const keys = getAffectedQueryKeys("installments", orgId);
    expect(keys).toHaveLength(4);
    expect(keys).toContainEqual(educationKeys.payments(orgId));
    expect(keys).toContainEqual(educationKeys.planInstallments(orgId));
    expect(keys).toContainEqual(educationKeys.paymentOverview(orgId));
    expect(keys).toContainEqual(educationKeys.students(orgId));
  });

  it("11. homework_assignments: hem ödev hem öğrenci (submissions_recorded_at) sorgusunu tazeler", () => {
    const keys = getAffectedQueryKeys("homework_assignments", orgId);
    expect(keys).toHaveLength(2);
    expect(keys).toContainEqual(educationKeys.homework(orgId));
    expect(keys).toContainEqual(educationKeys.students(orgId));
  });

  it("12. homework_submissions: hem ödev hem öğrenci (Student.homework) sorgusunu tazeler (v1.4-15 · #294)", () => {
    const keys = getAffectedQueryKeys("homework_submissions", orgId);
    expect(keys).toHaveLength(2);
    expect(keys).toContainEqual(educationKeys.homework(orgId));
    expect(keys).toContainEqual(educationKeys.students(orgId));
  });

  it("13. guardians: hem veli hem öğrenci (veli adı gömülü) sorgusunu tazeler (v1.4-10 #275)", () => {
    const keys = getAffectedQueryKeys("guardians", orgId);
    expect(keys).toHaveLength(2);
    expect(keys).toContainEqual(educationKeys.guardians(orgId));
    expect(keys).toContainEqual(educationKeys.students(orgId));
  });

  it("14. student_guardians: veli, öğrenci ve veli bağları sorgularını tazeler (v1.4-10 #275)", () => {
    const keys = getAffectedQueryKeys("student_guardians", orgId);
    expect(keys).toHaveLength(3);
    expect(keys).toContainEqual(educationKeys.guardians(orgId));
    expect(keys).toContainEqual(educationKeys.students(orgId));
    expect(keys).toContainEqual(educationKeys.studentGuardians(orgId));
  });

  it("15. branches: şube ve üye (şube adı görünür) sorgularını tazeler (v1.4-09 #284)", () => {
    const keys = getAffectedQueryKeys("branches", orgId);
    expect(keys).toHaveLength(2);
    expect(keys).toContainEqual(settingsKeys.branches(orgId));
    expect(keys).toContainEqual(settingsKeys.members(orgId));
  });

  it("16. subjects: ders, program, ödev ve sınav sorgularını tazeler (#287)", () => {
    const keys = getAffectedQueryKeys("subjects", orgId);
    expect(keys).toHaveLength(5);
    expect(keys).toContainEqual(educationKeys.subjects(orgId));
    expect(keys).toContainEqual(educationKeys.schedule(orgId));
    expect(keys).toContainEqual(educationKeys.homework(orgId));
    expect(keys).toContainEqual(educationKeys.exam(orgId));
    expect(keys).toContainEqual(educationKeys.exams(orgId));
  });

  it("17. class_teachers: atama, sınıf ve program sorgularını tazeler (#287)", () => {
    const keys = getAffectedQueryKeys("class_teachers", orgId);
    expect(keys).toHaveLength(3);
    expect(keys).toContainEqual(educationKeys.classTeachers(orgId));
    expect(keys).toContainEqual(educationKeys.classes(orgId));
    expect(keys).toContainEqual(educationKeys.schedule(orgId));
  });

  it("18. daily_feed_posts: günlük akış duyuru panosu sorgusunu tazeler (#288)", () => {
    const keys = getAffectedQueryKeys("daily_feed_posts", orgId);
    expect(keys).toHaveLength(1);
    expect(keys).toContainEqual(educationKeys.feed(orgId));
  });

  it("⛔ Hiçbir tekil tablo mesajı toptan tazeleme (educationKeys.all) döndürmez", () => {
    const tables: EducationTable[] = [
      "students",
      "classes",
      "class_enrollments",
      "schedule_entries",
      "attendance_sessions",
      "attendance_records",
      "exams",
      "exam_results",
      "payment_plans",
      "installments",
      "homework_assignments",
      "homework_submissions",
      "guardians",
      "student_guardians",
      "branches",
      "subjects",
      "class_teachers",
      "daily_feed_posts",
      "exam_absences",
      "exam_sections",
      "exam_section_results",
      "substitute_assignments",
      "schedule_templates",
      "schedule_template_slots",
    ];

    for (const tbl of tables) {
      const keys = getAffectedQueryKeys(tbl, orgId);
      expect(keys).not.toContainEqual(educationKeys.all);
    }
  });

  it("açık sınav detayı beş sınav tablosunun her değişikliğinde tazelenir (2026-10-12)", () => {
    for (const tbl of [
      "exams",
      "exam_results",
      "exam_absences",
      "exam_sections",
      "exam_section_results",
    ] as const) {
      expect(getAffectedQueryKeys(tbl, "org-1")).toContainEqual([
        "education",
        "examSheet",
      ]);
    }
  });

  it("yeni tablolar boş dönmez: sınav sonuç durumu, vekil ve şablon ekranları tazelenir", () => {
    expect(
      getAffectedQueryKeys("exam_section_results", "org-1")
    ).toContainEqual(["education", "examList"]);
    expect(getAffectedQueryKeys("exam_absences", "org-1")).toContainEqual(
      educationKeys.exam("org-1")
    );
    expect(
      getAffectedQueryKeys("substitute_assignments", "org-1")
    ).toContainEqual(educationKeys.substitutes("org-1"));
    expect(getAffectedQueryKeys("schedule_template_slots", "org-1")).toEqual([
      educationKeys.scheduleTemplates("org-1"),
    ]);
  });
});
