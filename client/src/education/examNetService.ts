import { supabase } from "@/lib/supabaseClient";
import { translateExamError } from "./examService";

/**
 * Sınav listesi ve deneme netleri (`20261007000000`, `20261008000000`).
 *
 * Net = doğru − yanlış / `netPenalty`. Toplam net veritabanında hesaplanıp
 * `exam_results.score`a yazılır; bu modül yalnız bölümleri ve doğru/yanlışı
 * okur ve yazar. Ekrandaki anlık net (`netOf`) yalnız önizlemedir; kayıtlı
 * değer her zaman veritabanınınkidir.
 */

export type ExamListItem = {
  id: string;
  name: string;
  examDate: string;
  maxScore: number | null;
  netPenalty: number | null;
  classId: string | null;
  className: string | null;
  subjectName: string | null;
  /** Girilmiş sonuç sayısı (`exam_averages`); yetkisizse `null`. */
  resultCount: number | null;
  /** Üçten az sonuçta `null` — tek tek puan açılmaz. */
  average: number | null;
};

export type ExamListResult = { rows: ExamListItem[]; truncated: boolean };

export const DEFAULT_EXAM_LIST_LIMIT = 200;

export type ExamSection = {
  id: string;
  examId: string;
  subjectId: string | null;
  name: string;
  questionCount: number;
  position: number;
};

export type SectionDraft = {
  /** Var olan bölümde dolu; yeni bölümde boş. */
  id?: string;
  subjectId?: string | null;
  name: string;
  questionCount: number;
};

export type SectionResult = {
  sectionId: string;
  studentId: string;
  correct: number;
  wrong: number;
};

export type SectionResultInput = SectionResult;

/** Ekran önizlemesi; veritabanıyla aynı formül ve yuvarlama. */
export function netOf(correct: number, wrong: number, penalty: number): number {
  return Math.round((correct - wrong / penalty) * 100) / 100;
}

type RawExamRow = {
  id: string;
  name: string;
  exam_date: string;
  max_score: number | string | null;
  net_penalty: number | null;
  class_id: string | null;
  classes?: unknown;
  subjects?: unknown;
};

function relationName(relation: unknown): string | null {
  const obj = Array.isArray(relation) ? relation[0] : relation;
  if (!obj || typeof obj !== "object") return null;
  const name = (obj as { name?: string }).name;
  return name?.trim() || null;
}

/**
 * Kurumun arşivlenmemiş sınavları (en yeni tarih önce), girilmiş sonuç
 * sayısı ve ortalamasıyla. Açık kurum süzgeci (K-19), üst sınır (K-03),
 * hata fırlatılır (K-22).
 */
export async function loadExams(
  organizationId: string,
  options?: { classId?: string | null },
  limit = DEFAULT_EXAM_LIST_LIMIT
): Promise<ExamListResult> {
  if (!organizationId) return { rows: [], truncated: false };

  let query = supabase
    .from("exams")
    .select(
      "id, name, exam_date, max_score, net_penalty, class_id, classes(name), subjects(name)"
    )
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("exam_date", { ascending: false })
    .limit(limit);
  if (options?.classId) query = query.eq("class_id", options.classId);

  const { data, error } = await query;
  if (error) throw new Error(translateExamError(error));

  const raw = (data ?? []) as RawExamRow[];
  const averages = await loadExamAverages(raw.map(r => r.id));

  const rows = raw.map(row => {
    const total = averages.get(row.id);
    return {
      id: row.id,
      name: row.name,
      examDate: row.exam_date,
      maxScore: row.max_score === null ? null : Number(row.max_score),
      netPenalty: row.net_penalty,
      classId: row.class_id,
      className: relationName(row.classes),
      subjectName: relationName(row.subjects),
      resultCount: total?.resultCount ?? null,
      average: total?.average ?? null,
    };
  });
  return { rows, truncated: rows.length === limit };
}

export type ExamAverage = {
  resultCount: number;
  average: number | null;
};

/**
 * Sınav ortalamaları (`exam_averages`). Anahtar sınav kimliği; bölüm
 * ortalamaları `sections` içinde bölüm kimliğiyle.
 */
export async function loadExamAverages(
  examIds: string[]
): Promise<Map<string, ExamAverage & { sections: Map<string, ExamAverage> }>> {
  const result = new Map<
    string,
    ExamAverage & { sections: Map<string, ExamAverage> }
  >();
  if (examIds.length === 0) return result;

  const { data, error } = await supabase.rpc("exam_averages", {
    target_exam_ids: examIds,
  });
  if (error) throw new Error(translateExamError(error));

  type Raw = {
    exam_id: string;
    section_id: string | null;
    result_count: number | string;
    average: number | string | null;
  };
  for (const row of (data ?? []) as Raw[]) {
    let entry = result.get(row.exam_id);
    if (!entry) {
      entry = { resultCount: 0, average: null, sections: new Map() };
      result.set(row.exam_id, entry);
    }
    const value = {
      resultCount: Number(row.result_count),
      average: row.average === null ? null : Number(row.average),
    };
    if (row.section_id) entry.sections.set(row.section_id, value);
    else {
      entry.resultCount = value.resultCount;
      entry.average = value.average;
    }
  }
  return result;
}

export async function loadExamSections(examId: string): Promise<ExamSection[]> {
  const { data, error } = await supabase
    .from("exam_sections")
    .select("id, exam_id, subject_id, name, question_count, position")
    .eq("exam_id", examId)
    .is("archived_at", null)
    .order("position", { ascending: true });
  if (error) throw new Error(translateExamError(error));

  return (
    (data ?? []) as {
      id: string;
      exam_id: string;
      subject_id: string | null;
      name: string;
      question_count: number;
      position: number;
    }[]
  ).map(row => ({
    id: row.id,
    examId: row.exam_id,
    subjectId: row.subject_id,
    name: row.name,
    questionCount: row.question_count,
    position: row.position,
  }));
}

/**
 * Formdaki bölüm listesini kaydeder: yeniler eklenir, var olanlar
 * güncellenir, listeden çıkarılanlar arşivlenir (silinmez). Kuralları
 * veritabanı uygular (son sonuçlu bölüm kaldırılamaz, soru sayısı girilmiş
 * sonucun altına inemez — ORB06).
 */
export async function saveExamSections(
  organizationId: string,
  examId: string,
  drafts: SectionDraft[],
  existing: ExamSection[]
): Promise<void> {
  const keptIds = new Set(drafts.map(d => d.id).filter(Boolean) as string[]);

  for (const removed of existing.filter(s => !keptIds.has(s.id))) {
    const { error } = await supabase
      .from("exam_sections")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", removed.id)
      .eq("organization_id", organizationId);
    if (error) throw new Error(translateExamError(error));
  }

  for (const [index, draft] of drafts.entries()) {
    const fields = {
      subject_id: draft.subjectId ?? null,
      name: draft.name.trim(),
      question_count: draft.questionCount,
      position: index + 1,
    };
    if (draft.id) {
      const { error } = await supabase
        .from("exam_sections")
        .update(fields)
        .eq("id", draft.id)
        .eq("organization_id", organizationId);
      if (error) throw new Error(translateExamError(error));
    } else {
      const { error } = await supabase.from("exam_sections").insert({
        organization_id: organizationId,
        exam_id: examId,
        ...fields,
      });
      if (error) throw new Error(translateExamError(error));
    }
  }
}

export async function loadSectionResults(
  examId: string
): Promise<SectionResult[]> {
  const { data, error } = await supabase
    .from("exam_section_results")
    .select("section_id, student_id, correct, wrong")
    .eq("exam_id", examId);
  if (error) throw new Error(translateExamError(error));
  return (
    (data ?? []) as {
      section_id: string;
      student_id: string;
      correct: number;
      wrong: number;
    }[]
  ).map(row => ({
    sectionId: row.section_id,
    studentId: row.student_id,
    correct: row.correct,
    wrong: row.wrong,
  }));
}

/** Tek işlemde kaydeder; değişmeyen satıra dokunulmaz. Kaç satır yazıldı. */
export async function saveSectionResults(
  examId: string,
  entries: SectionResultInput[]
): Promise<number> {
  const { data, error } = await supabase.rpc("record_exam_section_results", {
    target_exam_id: examId,
    entries: entries.map(e => ({
      section_id: e.sectionId,
      student_id: e.studentId,
      correct: e.correct,
      wrong: e.wrong,
    })),
  });
  if (error) throw new Error(translateExamError(error));
  return typeof data === "number" ? data : Number(data) || 0;
}

/** Hazır deneme şablonları (yalnız öneri; kurum düzenler). */
export const EXAM_TEMPLATES: {
  label: string;
  penalty: number;
  sections: { name: string; questionCount: number }[];
}[] = [
  {
    label: "TYT",
    penalty: 4,
    sections: [
      { name: "Türkçe", questionCount: 40 },
      { name: "Sosyal Bilimler", questionCount: 20 },
      { name: "Temel Matematik", questionCount: 40 },
      { name: "Fen Bilimleri", questionCount: 20 },
    ],
  },
  {
    label: "AYT Sayısal",
    penalty: 4,
    sections: [
      { name: "Matematik", questionCount: 40 },
      { name: "Fizik", questionCount: 14 },
      { name: "Kimya", questionCount: 13 },
      { name: "Biyoloji", questionCount: 13 },
    ],
  },
  {
    label: "AYT Eşit Ağırlık",
    penalty: 4,
    sections: [
      { name: "Matematik", questionCount: 40 },
      { name: "Türk Dili ve Edebiyatı", questionCount: 24 },
      { name: "Tarih-1", questionCount: 10 },
      { name: "Coğrafya-1", questionCount: 6 },
    ],
  },
  {
    label: "LGS",
    penalty: 3,
    sections: [
      { name: "Türkçe", questionCount: 20 },
      { name: "Matematik", questionCount: 20 },
      { name: "Fen Bilimleri", questionCount: 20 },
      { name: "T.C. İnkılap Tarihi ve Atatürkçülük", questionCount: 10 },
      { name: "Din Kültürü ve Ahlak Bilgisi", questionCount: 10 },
      { name: "İngilizce", questionCount: 10 },
    ],
  },
];
