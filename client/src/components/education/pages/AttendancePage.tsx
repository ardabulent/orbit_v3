import * as React from "react";
import { useState } from "react";
import { isDemoMode } from "@/auth/runtime";
import type { TodayLesson } from "@/education/overviewService";
import { formatTrDate, getOrbitToday } from "@/education/trDate";
import { PageHeader } from "../shared";
import type {
  AttendanceState,
  ClassGroup,
  Role,
  ScheduleItem,
  Section,
  Student,
} from "../types";
import { AttendanceDemo } from "./AttendanceDemo";
import { AttendanceHistory } from "./AttendanceHistory";
import { AttendanceSheetView } from "./AttendanceSheetView";
import { AttendanceToday } from "./AttendanceToday";
import { targetFromLesson, type AttendanceTarget } from "./attendanceSheet";

/**
 * Yoklama (karar 2026-09-28): ders başına yoklama.
 *
 *   Bugün   — günün dersleri, her biri "alındı / bekliyor"; tıklayınca o
 *             dersin yoklaması açılır.
 *   Geçmiş  — son 30 günün oturumları (düzeltmek için açılır) ve başka bir
 *             günün yoklamasını alma.
 *
 * Bugünün dersleri sayfaya verilir (öğretmende `my_lessons_today`, yönetici
 * `today_lessons`); `isLoading`/`error`/`onRetry` o listenin durumudur.
 * Yazma yetkisi sunucudadır (`current_user_can_record_attendance`).
 */
export function AttendancePage({
  role,
  attendances,
  setAttendances,
  students,
  classes = [],
  schedule = [],
  lessons = [],
  isLoading = false,
  error = null,
  onRetry,
  isDemo = isDemoMode,
  organizationId,
  onNavigate,
  onSaved,
  onDirtyChange,
  onRequestConfirm,
}: {
  role: Role;
  attendances: Record<string, AttendanceState>;
  setAttendances: React.Dispatch<
    React.SetStateAction<Record<string, AttendanceState>>
  >;
  students?: Student[];
  classes?: ClassGroup[];
  schedule?: ScheduleItem[];
  lessons?: TodayLesson[];
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  isDemo?: boolean;
  organizationId?: string;
  onNavigate?: (section: Section) => void;
  onSaved?: () => Promise<void> | void;
  onDirtyChange?: (isDirty: boolean) => void;
  onRequestConfirm?: (action: () => void) => void;
}) {
  // Güvenlik kapısı: isDemo prop'u üretimde (isDemoMode === false) demoyu
  // AÇAMAZ; yalnız test ya da demo modunda demoyu kapatmak için kullanılır.
  const activeDemo = isDemoMode && isDemo;
  const today = getOrbitToday();
  const [tab, setTab] = useState<"today" | "history">("today");
  const [target, setTarget] = useState<AttendanceTarget | null>(null);

  if (activeDemo) {
    return (
      <AttendanceDemo
        role={role}
        attendances={attendances}
        setAttendances={setAttendances}
        students={students}
      />
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Ders operasyonu"
        title="Yoklama"
        description={`Her dersin yoklaması ayrı alınır. Bugün: ${formatTrDate(today)}.`}
      />

      {target && organizationId ? (
        <AttendanceSheetView
          key={`${target.classId}-${target.sessionDate}-${target.subjectId}-${target.startsAt}`}
          organizationId={organizationId}
          target={target}
          onBack={() => setTarget(null)}
          onSaved={onSaved}
          onDirtyChange={onDirtyChange}
          onRequestConfirm={onRequestConfirm}
          onNavigate={onNavigate}
        />
      ) : (
        <>
          <div className="mt-4 flex border-b border-slate-200">
            <SubTab active={tab === "today"} onClick={() => setTab("today")}>
              Bugün
            </SubTab>
            <SubTab
              active={tab === "history"}
              onClick={() => setTab("history")}
            >
              Geçmiş
            </SubTab>
          </div>
          <div className="mt-6">
            {tab === "today" ? (
              <AttendanceToday
                lessons={lessons}
                isLoading={isLoading}
                error={error}
                onRetry={onRetry}
                showTeacher={role === "admin"}
                canOpen={lesson =>
                  Boolean(targetFromLesson(lesson, schedule, today))
                }
                onOpen={lesson =>
                  setTarget(targetFromLesson(lesson, schedule, today))
                }
              />
            ) : (
              <AttendanceHistory
                today={today}
                classes={classes.map(c => ({ id: c.id, name: c.name }))}
                schedule={schedule}
                onOpen={setTarget}
              />
            )}
          </div>
        </>
      )}
    </>
  );
}

function SubTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-4 py-2.5 transition ${
        active
          ? "border-slate-900 text-slate-900"
          : "border-transparent text-slate-500 hover:text-slate-800"
      }`}
    >
      <span className="text-xs font-bold">{children}</span>
    </button>
  );
}
