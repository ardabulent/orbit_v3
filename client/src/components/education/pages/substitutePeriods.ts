import { formatTrWeekLabel } from "@/education/trDate";
import type { SubstituteAssignment } from "@/education/substituteService";

/**
 * Vekilliklerin zamana göre ayrımı. "Bugün" kurum saatiyle verilir
 * (`getOrbitToday`); veritabanı da aynı tanımı kullanır (`orbit_today()`),
 * yani ekranda "süren" görünen vekillik gerçekten yetki taşıyandır.
 * Tarihler "YYYY-MM-DD" olduğundan dizge karşılaştırması doğrudur.
 */

export type SubstitutePeriod = "current" | "upcoming" | "past";

export function substitutePeriod(
  row: Pick<SubstituteAssignment, "startsOn" | "endsOn">,
  today: string
): SubstitutePeriod {
  if (row.endsOn < today) return "past";
  if (row.startsOn > today) return "upcoming";
  return "current";
}

export function groupSubstitutes(
  rows: SubstituteAssignment[],
  today: string
): Record<SubstitutePeriod, SubstituteAssignment[]> {
  const groups: Record<SubstitutePeriod, SubstituteAssignment[]> = {
    current: [],
    upcoming: [],
    past: [],
  };
  for (const row of rows) groups[substitutePeriod(row, today)].push(row);
  // Süren ve yaklaşan: en yakın önce. Geçmiş: en yeni önce.
  groups.current.sort((a, b) => a.endsOn.localeCompare(b.endsOn));
  groups.upcoming.sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  groups.past.sort((a, b) => b.endsOn.localeCompare(a.endsOn));
  return groups;
}

/** "5 Eki", ya da "5 Eki – 20 Eki". */
export function formatDateRange(startsOn: string, endsOn: string): string {
  const start = formatTrWeekLabel(startsOn);
  return startsOn === endsOn
    ? start
    : `${start} – ${formatTrWeekLabel(endsOn)}`;
}

/**
 * Bugün süren vekillikler, izinli öğretmenin üyeliğine göre. Ders
 * programında izinli öğretmenin dersinin üstüne "Vekil: …" yazmak için.
 */
export function currentCoverByAbsent(
  rows: SubstituteAssignment[],
  today: string
): Map<string, SubstituteAssignment> {
  const map = new Map<string, SubstituteAssignment>();
  for (const row of rows) {
    if (substitutePeriod(row, today) === "current") {
      map.set(row.absentMembershipId, row);
    }
  }
  return map;
}
