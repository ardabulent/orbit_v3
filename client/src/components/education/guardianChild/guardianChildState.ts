import { createContext, useContext, useState } from "react";
import {
  useStudentHomeworkContext,
  useStudents,
} from "@/education/educationQueries";
import type { Student } from "../types";

/**
 * Velinin seçili çocuğu (karar 2026-09-27, uygulama 2026-10-02).
 *
 * Seçici üst çubukta; seçim BÜTÜN veli sekmeleri için ortaktır ve sekme
 * değişince korunur. Tek çocuklu veliye seçici gösterilmez. "Tümü" seçeneği
 * yoktur (2026-10-02): her ekran tek bir çocuğa aittir, iki çocuğun bilgisi
 * hiçbir listede karışmaz. İletişim süzülmez (duyurular veliye yöneliktir).
 *
 * Çocuk listesi öğrenci listesinden gelir; RLS onu veliye yalnız bağlı
 * olduğu öğrenciler olarak döndürür. Buradaki süzme bir GÖRÜNÜM kararıdır,
 * güvenlik sınırı değildir.
 *
 * Seçim sekme belleğinde (`sessionStorage`) kullanıcıya göre tutulur: sayfa
 * yenilense de kalır, tarayıcı kapanınca silinir — ortak kullanılan bir
 * bilgisayarda bir sonraki kişiye iz bırakmaz.
 */

export type GuardianChildState = {
  /** Veli değilse ya da demo modundaysa false; diğer alanlar boştur. */
  active: boolean;
  children: Student[];
  child: Student | null;
  select: (studentId: string) => void;
  /** Seçili çocuğun etkin sınıfları; yüklenirken null. */
  classIds: Set<string> | null;
  isLoading: boolean;
  isError: boolean;
  retry: () => void;
};

const INACTIVE: GuardianChildState = {
  active: false,
  children: [],
  child: null,
  select: () => undefined,
  classIds: null,
  isLoading: false,
  isError: false,
  retry: () => undefined,
};

export const GuardianChildContext = createContext<GuardianChildState>(INACTIVE);

/** Sekmelerin okuduğu değer. */
export function useGuardianChild(): GuardianChildState {
  return useContext(GuardianChildContext);
}

const storageKey = (userId: string) => `orbit.veli.secili-cocuk.${userId}`;

function readStored(userId: string): string | null {
  try {
    return window.sessionStorage.getItem(storageKey(userId));
  } catch {
    // Gizli pencere ya da kapalı depo: seçim yalnız bu oturumda yaşar.
    return null;
  }
}

function writeStored(userId: string, studentId: string) {
  try {
    window.sessionStorage.setItem(storageKey(userId), studentId);
  } catch {
    // Depo yazılamıyorsa seçim yine ekranda geçerlidir; kalıcı olmaz.
  }
}

/** Seçim listede yoksa (ilk açılış, bağ kaldırıldı) ilk çocuğa düşülür. */
export function pickChild(
  children: Student[],
  selectedId: string | null
): Student | null {
  return (
    children.find(candidate => candidate.id === selectedId) ??
    children[0] ??
    null
  );
}

/** Ana çerçeve bir kez çağırır ve sonucu bağlamla aşağı verir. */
export function useGuardianChildState({
  enabled,
  userId,
}: {
  enabled: boolean;
  userId: string;
}): GuardianChildState {
  const studentsQuery = useStudents({ enabled });
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    enabled && userId ? readStored(userId) : null
  );
  const children = enabled ? (studentsQuery.data?.rows ?? []) : [];
  const child = pickChild(children, selectedId);
  const classQuery = useStudentHomeworkContext({
    studentId: child?.id ?? null,
    enabled: enabled && Boolean(child),
  });

  if (!enabled) return INACTIVE;

  return {
    active: true,
    children,
    child,
    select: studentId => {
      setSelectedId(studentId);
      if (userId) writeStored(userId, studentId);
    },
    classIds: classQuery.data?.classIds ?? null,
    isLoading:
      studentsQuery.isPending || (Boolean(child) && classQuery.isPending),
    isError: studentsQuery.isError || classQuery.isError,
    retry: () => {
      void studentsQuery.refetch();
      void classQuery.refetch();
    },
  };
}
