import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isDemoMode } from "@/auth/runtime";
import { useAuth } from "@/auth/useAuth";
import { educationKeys } from "@/education/queries/educationKeys";
import {
  useTrackingDefaults,
  useTrackingMetrics,
} from "@/education/queries/trackingQueries";
import {
  REPORT_WEEK_OPTIONS,
  type ReportWeeks,
} from "@/education/reportService";
import { rankRows, type SortState } from "@/education/tracking/trackingBands";
import {
  METRIC_KEYS,
  resolveLimits,
  type Criterion,
  type Limits,
  type MetricKey,
} from "@/education/tracking/trackingMetrics";
import {
  browserStorage,
  readTrackingPrefs,
  writeTrackingPrefs,
} from "@/education/tracking/trackingPrefs";
import { saveTrackingDefaults } from "@/education/trackingService";
import { demoTrackingRows } from "../../demoData";
import { CardSkeleton, ErrorState } from "../../shared";
import type { Role } from "../../types";
import { TrackingClassProfile } from "./TrackingClassProfile";
import { TrackingCriteriaPanel } from "./TrackingCriteriaPanel";
import { TrackingList } from "./TrackingList";
import { TrackingStudentProfile } from "./TrackingStudentProfile";

/** Derleme anında belli olan demo bayrağı (bkz. `ReportsPage`). */
const DEMO_BUILD =
  typeof __ORBIT_DEMO_MODE__ === "boolean" ? __ORBIT_DEMO_MODE__ : isDemoMode;

const selectClass =
  "h-9 min-w-44 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-semibold text-slate-700";

const DEFAULT_SORT: SortState = { key: "criticality", dir: "desc" };

/**
 * Raporlar → Takip (karar 2026-11-24).
 *
 * 1. Kapsam: sınıf bazlı (bir sınıf ya da bütün görünür sınıflar) veya
 *    öğrenci bazlı. Kim hangi öğrenciyi görür veritabanında kararlaştırılır;
 *    buradaki listeler yalnız kolaylıktır.
 * 2. Ölçüt ve iki sınır; bant, genel durum ve sıra istemcide hesaplanır —
 *    sınır değişimi yeni istek doğurmaz.
 */
export function TrackingTab({
  role,
  isDemo = isDemoMode,
  classes,
  students,
  onOpenStudent,
  initialCriterion,
}: {
  role: Role;
  isDemo?: boolean;
  classes: { id: string; name: string }[];
  students: { id: string; name: string; group: string | null }[];
  onOpenStudent?: (studentId: string) => void;
  initialCriterion?: Criterion;
}) {
  const activeDemo = DEMO_BUILD && isDemo;
  const { identity } = useAuth();
  const organizationId = identity?.membership?.organizationId ?? "demo";
  // Tercih kişiye aittir: ortak bilgisayarda bir kişinin seçimi başkasına geçmesin.
  const prefsKey = `${organizationId}:${identity?.membership?.membershipId ?? "demo"}`;
  const queryClient = useQueryClient();

  const saved = useMemo(
    () => readTrackingPrefs(browserStorage(), prefsKey),
    [prefsKey]
  );

  const [mode, setMode] = useState<"class" | "student">("class");
  const [classId, setClassId] = useState<string | undefined>(undefined);
  const [studentId, setStudentId] = useState<string | undefined>(undefined);
  const [studentSearch, setStudentSearch] = useState("");
  const [weeks, setWeeks] = useState<ReportWeeks>(saved?.weeks ?? 4);
  const [criterion, setCriterion] = useState<Criterion>(
    initialCriterion ?? saved?.criterion ?? "overall"
  );
  const [subjectId, setSubjectId] = useState<string | undefined>(
    saved?.subjectId
  );
  const [personal, setPersonal] = useState<Partial<Record<MetricKey, Limits>>>(
    saved?.limits ?? {}
  );
  const [resetCount, setResetCount] = useState(0);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [profileId, setProfileId] = useState<string | undefined>(undefined);

  // Kişinin son seçimi tarayıcıda; yazılamazsa sessizce kurum varsayılanı.
  useEffect(() => {
    writeTrackingPrefs(browserStorage(), prefsKey, {
      criterion,
      limits: personal,
      weeks,
      ...(subjectId ? { subjectId } : {}),
    });
  }, [prefsKey, criterion, personal, weeks, subjectId]);

  const scope = {
    weeks,
    classId: mode === "class" ? classId : undefined,
    studentId: mode === "student" ? studentId : undefined,
  };
  const metricsQuery = useTrackingMetrics(scope, {
    enabled: !activeDemo && (mode === "class" || Boolean(studentId)),
  });
  const defaultsQuery = useTrackingDefaults({ enabled: !activeDemo });

  const rows = useMemo(() => {
    if (!activeDemo) return metricsQuery.data ?? [];
    return demoTrackingRows().filter(
      row => mode === "class" || row.studentId === studentId
    );
  }, [activeDemo, metricsQuery.data, mode, studentId]);

  const limits = useMemo(
    () => resolveLimits(defaultsQuery.data ?? {}, personal),
    [defaultsQuery.data, personal]
  );

  const subjects = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of rows) {
      for (const subject of row.subjectNets)
        seen.set(subject.subjectId, subject.subjectName);
    }
    return [...seen.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [rows]);

  const ranked = useMemo(
    () => rankRows(rows, { criterion, subjectId, limits, sort }),
    [rows, criterion, subjectId, limits, sort]
  );

  const studentMatches = useMemo(() => {
    const needle = studentSearch.trim().toLocaleLowerCase("tr");
    if (!needle) return [];
    return students
      .filter(s => s.name.toLocaleLowerCase("tr").includes(needle))
      .slice(0, 8);
  }, [students, studentSearch]);

  const saveDefaults = async () => {
    const complete: Partial<Record<MetricKey, Limits>> = {};
    for (const key of METRIC_KEYS) {
      const value = limits[key];
      if (value) complete[key] = value;
    }
    await saveTrackingDefaults(organizationId, complete);
    await queryClient.invalidateQueries({
      queryKey: educationKeys.trackingDefaults(organizationId),
    });
  };

  const allLabel = role === "teacher" ? "Bütün sınıflarım" : "Bütün sınıflar";
  const profileRow =
    mode === "student"
      ? rows[0]
      : profileId
        ? rows.find(row => row.studentId === profileId)
        : undefined;
  const error = metricsQuery.error ?? defaultsQuery.error;

  return (
    <>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div
            role="group"
            aria-label="İnceleme biçimi"
            className="flex gap-1 rounded-full border border-slate-200 bg-white p-1"
          >
            {(
              [
                ["class", "Sınıf bazlı"],
                ["student", "Öğrenci bazlı"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => {
                  setMode(value);
                  setProfileId(undefined);
                }}
                className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
                  mode === value
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {mode === "class" ? (
            <label className="grid gap-1 text-[11px] font-bold text-slate-500">
              Sınıf
              <select
                value={classId ?? ""}
                onChange={e => {
                  setClassId(e.target.value || undefined);
                  setProfileId(undefined);
                }}
                className={selectClass}
              >
                <option value="">{allLabel}</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="relative grid gap-1 text-[11px] font-bold text-slate-500">
              <label htmlFor="takip-ogrenci-ara">Öğrenci</label>
              <input
                id="takip-ogrenci-ara"
                value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
                placeholder="Ad yazın"
                className={`${selectClass} min-w-56`}
                autoComplete="off"
              />
              {studentMatches.length > 0 ? (
                <ul className="absolute top-full z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                  {studentMatches.map(s => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setStudentId(s.id);
                          setStudentSearch("");
                        }}
                        className="block w-full px-3 py-2 text-left text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {s.name}
                        {s.group ? (
                          <span className="font-normal text-slate-400">
                            {" "}
                            · {s.group}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </div>
        <div
          role="group"
          aria-label="Takip aralığı"
          className="flex gap-1 rounded-full border border-slate-200 bg-white p-1"
        >
          {REPORT_WEEK_OPTIONS.map(option => (
            <button
              key={option}
              type="button"
              aria-pressed={weeks === option}
              onClick={() => setWeeks(option)}
              className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
                weeks === option
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {option} hafta
            </button>
          ))}
        </div>
      </div>

      <TrackingCriteriaPanel
        key={`${criterion}-${resetCount}`}
        criterion={criterion}
        onCriterionChange={next => {
          setCriterion(next);
          setSort(DEFAULT_SORT);
        }}
        subjectId={subjectId}
        subjects={subjects}
        onSubjectChange={setSubjectId}
        limits={limits}
        onLimitsChange={(metric, value) =>
          setPersonal(current => ({ ...current, [metric]: value }))
        }
        onResetLimits={() => {
          setPersonal({});
          setResetCount(count => count + 1);
        }}
        canSetDefaults={!activeDemo && role === "admin"}
        onSaveDefaults={activeDemo ? undefined : saveDefaults}
      />

      {error ? (
        <ErrorState
          className="mt-4"
          title="Takip listesi görüntülenemedi"
          message={error.message}
          onRetry={() => {
            void metricsQuery.refetch();
            void defaultsQuery.refetch();
          }}
        />
      ) : mode === "student" && !studentId ? (
        <p className="mt-4 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-[12px] text-slate-500">
          İncelemek istediğiniz öğrencinin adını yazıp listeden seçin.
        </p>
      ) : !activeDemo && metricsQuery.isLoading ? (
        <div className="mt-4 grid gap-4">
          <CardSkeleton />
        </div>
      ) : profileRow ? (
        <TrackingStudentProfile
          row={profileRow}
          limits={limits}
          onBack={mode === "class" ? () => setProfileId(undefined) : undefined}
          onOpenStudent={onOpenStudent}
        />
      ) : mode === "student" ? (
        <p className="mt-4 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-[12px] text-slate-500">
          Bu öğrenci için takip verisi yok ya da öğrenciye erişiminiz
          bulunmuyor.
        </p>
      ) : (
        <>
          {rows.length > 0 ? (
            <TrackingClassProfile
              title={
                classId
                  ? (classes.find(c => c.id === classId)?.name ??
                    "Seçili sınıf")
                  : allLabel
              }
              ranked={ranked}
            />
          ) : null}
          <TrackingList
            ranked={ranked}
            criterion={criterion}
            sort={sort}
            onSortChange={setSort}
            onOpenProfile={setProfileId}
          />
        </>
      )}
    </>
  );
}
