import type { ExamListItem, SectionDraft } from "@/education/examNetService";

/** Formdaki puanlama seçimi: tek puan ya da netin kuralı (YKS 4, LGS 3). */
export type ScoringChoice = "score" | "4" | "3";

export const SCORING_OPTIONS: { value: ScoringChoice; label: string }[] = [
  { value: "score", label: "Tek puan" },
  { value: "4", label: "Ders ders net — YKS (4 yanlış 1 doğruyu götürür)" },
  { value: "3", label: "Ders ders net — LGS (3 yanlış 1 doğruyu götürür)" },
];

export function penaltyOf(choice: ScoringChoice): number | null {
  return choice === "score" ? null : Number(choice);
}

export function choiceOf(penalty: number | null | undefined): ScoringChoice {
  return penalty === 3 ? "3" : penalty ? "4" : "score";
}

/** Bölüm listesi kaydedilebilir mi; değilse kullanıcıya söylenecek cümle. */
export function validateSections(drafts: SectionDraft[]): string | null {
  if (drafts.length === 0) return "Ders ders net için en az bir ders ekleyin.";
  const seen = new Set<string>();
  for (const draft of drafts) {
    const name = draft.name.trim();
    if (!name) return "Her dersin bir adı olmalı.";
    if (name.length > 80) return "Ders adı en fazla 80 karakter olabilir.";
    const key = name.toLocaleLowerCase("tr");
    if (seen.has(key)) return `"${name}" iki kez yazılmış.`;
    seen.add(key);
    if (
      !Number.isInteger(draft.questionCount) ||
      draft.questionCount < 1 ||
      draft.questionCount > 200
    ) {
      return `"${name}" için soru sayısı 1 ile 200 arasında olmalı.`;
    }
  }
  return null;
}

export function totalQuestions(drafts: SectionDraft[]): number {
  return drafts.reduce((sum, d) => sum + (d.questionCount || 0), 0);
}

/** Yaklaşan (en yakın önce) ve geçmiş (en yeni önce) sınavlar. */
export function splitExams(rows: ExamListItem[], today: string) {
  return {
    upcoming: rows
      .filter(r => r.examDate >= today)
      .sort((a, b) => a.examDate.localeCompare(b.examDate)),
    past: rows.filter(r => r.examDate < today),
  };
}

export type ExamResultStatus =
  | { kind: "planned" }
  | { kind: "missing"; entered: number; expected: number | null }
  | { kind: "complete"; entered: number; expected: number };

/**
 * Listede her sınavın sonuç durumu (2026-09-30). Liste önceden yalnız sınavın
 * adını ve tarihini gösteriyordu; sonuç girişinin sınavın içinde olduğu
 * anlaşılmıyordu. Beklenen sayı sınıf sınavında sınıfın öğrenci sayısıdır;
 * kurum geneli sınavda bilinmez (`null`) ve uydurulmaz (K-03).
 */
export function examResultStatus(
  exam: ExamListItem,
  today: string,
  expected: number | null
): ExamResultStatus {
  if (exam.examDate > today) return { kind: "planned" };
  const entered = exam.resultCount ?? 0;
  if (expected !== null && expected > 0 && entered >= expected)
    return { kind: "complete", entered, expected };
  return { kind: "missing", entered, expected };
}

/** Net tablosunun bir hücresi: doğru ve yanlış, ekrandaki metin hâliyle. */
export type ResultCell = { correct: string; wrong: string };

const isBlank = (cell: ResultCell | undefined) =>
  !cell || (cell.correct.trim() === "" && cell.wrong.trim() === "");

/**
 * Kaydedilmiş bir sonucu olup şimdi boşaltılmış hücreler (2026-10-03,
 * v1.5-23). Ders sonucu veritabanından silinmez; eskiden boş hücre kayıtta
 * atlanıyor, ekran "kaydedildi" diyor, eski sonuç ve net yerinde kalıyordu.
 * Böyle bir hücre varken kayıt yapılmaz ve hücre işaretlenir.
 */
export function clearedSavedCells(
  initial: Record<string, ResultCell>,
  cells: Record<string, ResultCell>
): string[] {
  return Object.keys(initial).filter(
    k => !isBlank(initial[k]) && isBlank(cells[k])
  );
}
