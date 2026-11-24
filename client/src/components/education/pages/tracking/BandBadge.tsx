import type { Band } from "@/education/tracking/trackingBands";
import { BAND_META } from "./trackingFormat";

export function BandBadge({ band }: { band: Band }) {
  const meta = BAND_META[band];
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}
