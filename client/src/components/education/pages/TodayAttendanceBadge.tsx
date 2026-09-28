import { Badge } from "../shared";
import type { ClassSummary } from "./classSummaries";

/**
 * Sınıfın bugünkü yoklama durumu (ders başına). Bilinmeyen durum
 * "alınmadı" gösterilmez.
 */
export function TodayAttendanceBadge({
  summary,
}: {
  summary: Pick<ClassSummary, "today" | "todayLessons" | "todayTaken">;
}) {
  const { today } = summary;
  if (today === "taken")
    return <Badge tone="green">Bugün yoklama alındı</Badge>;
  if (today === "partial")
    return (
      <Badge tone="amber">
        Bugün yoklama {summary.todayTaken}/{summary.todayLessons}
      </Badge>
    );
  if (today === "pending")
    return <Badge tone="amber">Bugün yoklama bekliyor</Badge>;
  if (today === "unknown") return null;
  return <Badge tone="slate">Bugün ders yok</Badge>;
}
