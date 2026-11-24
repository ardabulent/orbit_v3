import type { ReportWeeks } from "../reportService";
import {
  isMetricKey,
  type Criterion,
  type Limits,
  type MetricKey,
} from "./trackingMetrics";

/**
 * Kişinin Takip ekranındaki son seçimi (karar 2026-11-24: kurum varsayılanı
 * + kişisel ayar tarayıcıda).
 *
 * Bu yalnız bir kolaylıktır: okunamazsa, bozuksa ya da tarayıcı izin
 * vermezse ekran kurum varsayılanıyla açılır. Güvenlik ya da kalıcılık
 * gerektiren hiçbir şey burada tutulmaz.
 */
export type TrackingPrefs = {
  criterion: Criterion;
  subjectId?: string;
  limits: Partial<Record<MetricKey, Limits>>;
  weeks?: ReportWeeks;
};

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem">;

/** Anahtar kurum ve üyelik taşır (`<kurum>:<üyelik>`): tercih kişiye aittir. */
const keyFor = (ownerKey: string) => `orbit:takip:${ownerKey}`;

const isLimits = (value: unknown): value is Limits =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Limits).risk === "number" &&
  typeof (value as Limits).safe === "number" &&
  Number.isFinite((value as Limits).risk) &&
  Number.isFinite((value as Limits).safe);

/** Tarayıcı deposu; erişim engelliyse (gizli pencere, site verisi kapalı) `undefined`. */
export function browserStorage(): Storage | undefined {
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined;
  } catch (error) {
    console.warn(
      "[takip] Tarayıcı deposuna erişilemiyor; tercih hatırlanmayacak.",
      error
    );
    return undefined;
  }
}

export function readTrackingPrefs(
  storage: ReadableStorage | undefined,
  ownerKey: string
): TrackingPrefs | null {
  if (!storage) return null;
  let raw: string | null;
  try {
    raw = storage.getItem(keyFor(ownerKey));
  } catch (error) {
    console.warn(
      "[takip] Kayıtlı tercih okunamadı; varsayılan kullanılıyor.",
      error
    );
    return null;
  }
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.warn(
      "[takip] Kayıtlı tercih bozuk; varsayılan kullanılıyor.",
      error
    );
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const record = parsed as Record<string, unknown>;
  const criterion = record.criterion;
  if (criterion !== "overall" && !isMetricKey(criterion)) return null;

  const limits: Partial<Record<MetricKey, Limits>> = {};
  if (typeof record.limits === "object" && record.limits !== null) {
    for (const [key, value] of Object.entries(record.limits)) {
      if (isMetricKey(key) && isLimits(value)) {
        limits[key] = { risk: value.risk, safe: value.safe };
      }
    }
  }

  const prefs: TrackingPrefs = { criterion, limits };
  if (typeof record.subjectId === "string" && record.subjectId) {
    prefs.subjectId = record.subjectId;
  }
  if (record.weeks === 4 || record.weeks === 8 || record.weeks === 12) {
    prefs.weeks = record.weeks;
  }
  return prefs;
}

/** Yazılamazsa `false` döner; çağıran bunu kullanıcıya göstermek zorunda değil. */
export function writeTrackingPrefs(
  storage: WritableStorage | undefined,
  ownerKey: string,
  prefs: TrackingPrefs
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(keyFor(ownerKey), JSON.stringify(prefs));
    return true;
  } catch (error) {
    console.warn(
      "[takip] Tercih kaydedilemedi; bir sonraki açılışta varsayılan gelir.",
      error
    );
    return false;
  }
}
