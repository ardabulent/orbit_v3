import { Badge } from "../shared";
import type { TodayAttendance } from "./classSummaries";

/** Sınıfın bugünkü yoklama durumu; bilinmeyen durum "alınmadı" gösterilmez. */
export function TodayAttendanceBadge({ today }: { today: TodayAttendance }) {
  if (today === "taken")
    return <Badge tone="green">Bugün yoklama alındı</Badge>;
  if (today === "pending")
    return <Badge tone="amber">Bugün yoklama bekliyor</Badge>;
  if (today === "unknown") return null;
  return <Badge tone="slate">Bugün ders yok</Badge>;
}
