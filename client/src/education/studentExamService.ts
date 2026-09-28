import { supabase } from "@/lib/supabaseClient";
import { loadExamAverages, netOf } from "./examNetService";
import { translateExamError } from "./examService";

/**
 * Öğrenci ve velinin sınav görünümü (karar 2026-09-28): yaklaşan sınavlar
 * ve sonuçlar — kendi puanı/neti ve sınıf ortalaması.
 *
 * Kapsam RLS'tedir: `exam_results` ve `exam_section_results` öğrenciye
 * kendi, veliye çocuğunun satırını açar. Sınıf ortalaması
 * `exam_averages`'tan gelir (üç sonuç eşiği; tek tek puanlar açılmaz).
 * Sınavlar kurumun her üyesine görünür (`exams_select_member`); bu yüzden
 * öğrencinin sınıflarına ve kurum geneli sınavlara açıkça süzülür.
 */

export type StudentExamSection = {
  id: string;
  name: string;
  questionCount: number;
  correct: number | null;
  wrong: number | null;
  /** Yalnız netli sınavda ve sonuç varsa. */
  net: number | null;
  classAverage: number | null;
};

export type StudentExam = {
  id: string;
  name: string;
  examDate: string;
  maxScore: number | null;
  netPenalty: number | null;
  className: string | null;
  /** Öğrencinin puanı ya da toplam neti; girilmemişse `null`. */
  score: number | null;
  classAverage: number | null;
  sections: StudentExamSection[];
};

export type StudentExamOverview = {
  upcoming: StudentExam[];
  results: StudentExam[];
};

export const STUDENT_EXAM_LIMIT = 100;

function relationName(relation: unknown): string | null {
  const obj = Array.isArray(relation) ? relation[0] : relation;
  if (!obj || typeof obj !== "object") return null;
  return (obj as { name?: string }).name?.trim() || null;
}

export async function loadStudentExams(
  organizationId: string,
  studentId: string,
  today: string
): Promise<StudentExamOverview> {
  if (!organizationId || !studentId) return { upcoming: [], results: [] };

  const { data: enrollments, error: enrollmentError } = await supabase
    .from("class_enrollments")
    .select("class_id")
    .eq("organization_id", organizationId)
    .eq("student_id", studentId)
    .is("archived_at", null);
  if (enrollmentError) throw new Error(translateExamError(enrollmentError));
  const classIds = [
    ...new Set(
      ((enrollments ?? []) as { class_id: string }[]).map(e => e.class_id)
    ),
  ];

  let examQuery = supabase
    .from("exams")
    .select(
      "id, name, exam_date, max_score, net_penalty, class_id, classes(name)"
    )
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("exam_date", { ascending: false })
    .limit(STUDENT_EXAM_LIMIT);
  examQuery =
    classIds.length > 0
      ? examQuery.or(`class_id.is.null,class_id.in.(${classIds.join(",")})`)
      : examQuery.is("class_id", null);

  const [examsRes, resultsRes, sectionResultsRes] = await Promise.all([
    examQuery,
    supabase
      .from("exam_results")
      .select("exam_id, score")
      .eq("organization_id", organizationId)
      .eq("student_id", studentId),
    supabase
      .from("exam_section_results")
      .select("exam_id, section_id, correct, wrong")
      .eq("organization_id", organizationId)
      .eq("student_id", studentId),
  ]);
  for (const res of [examsRes, resultsRes, sectionResultsRes]) {
    if (res.error) throw new Error(translateExamError(res.error));
  }

  type RawExam = {
    id: string;
    name: string;
    exam_date: string;
    max_score: number | string | null;
    net_penalty: number | null;
    classes?: unknown;
  };
  const exams = (examsRes.data ?? []) as RawExam[];
  const scores = new Map(
    (
      (resultsRes.data ?? []) as { exam_id: string; score: number | string }[]
    ).map(r => [r.exam_id, Number(r.score)])
  );
  const sectionResults = (sectionResultsRes.data ?? []) as {
    exam_id: string;
    section_id: string;
    correct: number;
    wrong: number;
  }[];

  const netExamIds = exams.filter(e => e.net_penalty).map(e => e.id);
  const pastIds = exams
    .filter(e => e.exam_date < today || scores.has(e.id))
    .map(e => e.id);

  const [sectionsRes, averages] = await Promise.all([
    netExamIds.length > 0
      ? supabase
          .from("exam_sections")
          .select("id, exam_id, name, question_count, position")
          .in("exam_id", netExamIds)
          .is("archived_at", null)
          .order("position", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    loadExamAverages(pastIds),
  ]);
  if (sectionsRes.error) throw new Error(translateExamError(sectionsRes.error));
  const sections = (sectionsRes.data ?? []) as {
    id: string;
    exam_id: string;
    name: string;
    question_count: number;
  }[];

  const toExam = (row: RawExam): StudentExam => {
    const avg = averages.get(row.id);
    const penalty = row.net_penalty;
    return {
      id: row.id,
      name: row.name,
      examDate: row.exam_date,
      maxScore: row.max_score === null ? null : Number(row.max_score),
      netPenalty: penalty,
      className: relationName(row.classes),
      score: scores.get(row.id) ?? null,
      classAverage: avg?.average ?? null,
      sections: sections
        .filter(s => s.exam_id === row.id)
        .map(section => {
          const mine = sectionResults.find(r => r.section_id === section.id);
          return {
            id: section.id,
            name: section.name,
            questionCount: section.question_count,
            correct: mine?.correct ?? null,
            wrong: mine?.wrong ?? null,
            net:
              mine && penalty ? netOf(mine.correct, mine.wrong, penalty) : null,
            classAverage: avg?.sections.get(section.id)?.average ?? null,
          };
        }),
    };
  };

  return {
    upcoming: exams
      .filter(e => e.exam_date >= today && !scores.has(e.id))
      .map(toExam)
      .sort((a, b) => a.examDate.localeCompare(b.examDate)),
    results: exams.filter(e => scores.has(e.id)).map(toExam),
  };
}
