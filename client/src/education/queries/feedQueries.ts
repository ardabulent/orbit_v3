// Duyuru akışı, takvim duyuruları, gün planı görevleri ve etkinlikleri.
// `educationQueries.ts`ten bölündü (2026-10-25, ana plan 5.3).
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/useAuth";
import {
  DEFAULT_FEED_LIMIT,
  loadCalendarNotices,
  loadFeedPosts,
  type CalendarNotice,
  type FeedPostListResult,
} from "../feedService";
import { addDaysIso, getOrbitToday } from "../trDate";
import {
  DEFAULT_DAY_PLAN_LIMIT,
  loadTasks,
  loadCalendarEvents,
  type TaskListResult,
  type CalendarEventListResult,
} from "../dayPlanService";
import { educationKeys } from "./educationKeys";

export type UseFeedPostsOptions = {
  organizationId?: string;
  classId?: string | null;
  includeArchived?: boolean;
  limit?: number;
  enabled?: boolean;
};

/**
 * Gün Planı takvimi için tarihli duyurular (2026-09-30): bugünden 60 gün
 * geri, 180 gün ileri. Anahtar duyuru akışıyla aynı ailede
 * (`["education","feed",{organizationId,…}]`): duyuru formu akışı
 * yenilediğinde takvim de yenilenir.
 */
export function useCalendarNotices(options?: { enabled?: boolean }) {
  const { identity } = useAuth();
  const organizationId = identity?.membership?.organizationId;
  const today = getOrbitToday();
  const from = addDaysIso(today, -60);
  const to = addDaysIso(today, 180);

  return useQuery<CalendarNotice[], Error>({
    queryKey: [
      "education",
      "feed",
      {
        organizationId: organizationId ?? "",
        calendarFrom: from,
        calendarTo: to,
      },
    ] as const,
    queryFn: () => loadCalendarNotices(organizationId!, from, to),
    enabled: (options?.enabled ?? true) && Boolean(organizationId),
  });
}

/**
 * Aktif kurumun günlük akış duyurularını getiren React Query hook'u (#288).
 */
export function useFeedPosts(options?: UseFeedPostsOptions) {
  const { identity } = useAuth();
  const organizationId =
    options?.organizationId ?? identity?.membership?.organizationId;
  const limit = options?.limit ?? DEFAULT_FEED_LIMIT;
  const isEnabled = (options?.enabled ?? true) && Boolean(organizationId);

  return useQuery<FeedPostListResult, Error>({
    queryKey: organizationId
      ? educationKeys.feed(organizationId, {
          classId: options?.classId,
          includeArchived: options?.includeArchived,
        })
      : (["education", "feed", { organizationId: "" }] as const),
    queryFn: () =>
      loadFeedPosts(organizationId!, {
        classId: options?.classId,
        includeArchived: options?.includeArchived,
        limit,
      }),
    enabled: isEnabled,
  });
}

export type UseTasksOptions = {
  organizationId?: string;
  membershipId?: string;
  includeArchived?: boolean;
  limit?: number;
  enabled?: boolean;
};

export function useTasks(options?: UseTasksOptions) {
  const { identity } = useAuth();
  const organizationId =
    options?.organizationId ?? identity?.membership?.organizationId;
  const membershipId =
    options?.membershipId ?? identity?.membership?.membershipId;
  const limit = options?.limit ?? DEFAULT_DAY_PLAN_LIMIT;
  const isEnabled =
    (options?.enabled ?? true) &&
    Boolean(organizationId) &&
    Boolean(membershipId);

  return useQuery<TaskListResult, Error>({
    queryKey:
      organizationId && membershipId
        ? educationKeys.tasks(organizationId, membershipId, {
            includeArchived: options?.includeArchived,
          })
        : ([
            "education",
            "tasks",
            { organizationId: "", membershipId: "" },
          ] as const),
    queryFn: () =>
      loadTasks(organizationId!, membershipId!, {
        includeArchived: options?.includeArchived,
        limit,
      }),
    enabled: isEnabled,
  });
}

export type UseCalendarEventsOptions = {
  organizationId?: string;
  membershipId?: string;
  includeArchived?: boolean;
  limit?: number;
  enabled?: boolean;
};

export function useCalendarEvents(options?: UseCalendarEventsOptions) {
  const { identity } = useAuth();
  const organizationId =
    options?.organizationId ?? identity?.membership?.organizationId;
  const membershipId =
    options?.membershipId ?? identity?.membership?.membershipId;
  const limit = options?.limit ?? DEFAULT_DAY_PLAN_LIMIT;
  const isEnabled =
    (options?.enabled ?? true) &&
    Boolean(organizationId) &&
    Boolean(membershipId);

  return useQuery<CalendarEventListResult, Error>({
    queryKey:
      organizationId && membershipId
        ? educationKeys.calendarEvents(organizationId, membershipId, {
            includeArchived: options?.includeArchived,
          })
        : ([
            "education",
            "calendarEvents",
            { organizationId: "", membershipId: "" },
          ] as const),
    queryFn: () =>
      loadCalendarEvents(organizationId!, membershipId!, {
        includeArchived: options?.includeArchived,
        limit,
      }),
    enabled: isEnabled,
  });
}
