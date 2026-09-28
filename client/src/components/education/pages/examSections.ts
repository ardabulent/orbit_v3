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
