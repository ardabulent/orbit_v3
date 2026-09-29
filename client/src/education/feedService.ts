import { supabase } from "@/lib/supabaseClient";

/**
 * Duyurunun hedef kitlesi (`20261009000000`): herkes, yalnız veliler, yalnız
 * öğrenciler. Uygulayan veritabanı (kısıtlayıcı politika); ekran yalnız
 * seçtirir ve gösterir.
 */
export type FeedAudience = "all" | "guardians" | "students";

export const FEED_AUDIENCE_LABELS: Record<FeedAudience, string> = {
  all: "Herkes",
  guardians: "Yalnız veliler",
  students: "Yalnız öğrenciler",
};

export type FeedPost = {
  id: string;
  organizationId: string;
  classId: string | null;
  className: string | null;
  title: string;
  body: string | null;
  authorMembershipId: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  audience: FeedAudience;
  /** Önemli: listenin üstünde, öğrenci/veli Genel Bakış'ında. */
  pinned: boolean;
};

export type FeedPostListResult = {
  rows: FeedPost[];
  truncated: boolean;
};

export type LoadFeedPostsOptions = {
  classId?: string | null;
  includeArchived?: boolean;
  limit?: number;
};

export type CreateFeedPostInput = {
  organizationId: string;
  classId?: string | null;
  title: string;
  body?: string | null;
  audience?: FeedAudience;
  pinned?: boolean;
};

export type UpdateFeedPostInput = {
  classId?: string | null;
  title?: string;
  body?: string | null;
  audience?: FeedAudience;
  pinned?: boolean;
};

export const DEFAULT_FEED_LIMIT = 50;

type RawFeedPostRow = {
  id: string;
  organization_id: string;
  class_id: string | null;
  title: string;
  body: string | null;
  author_membership_id: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  audience?: string | null;
  pinned?: boolean | null;
  classes?:
    { id: string; name: string } | { id: string; name: string }[] | null;
};

/**
 * Duyuruların yazarlarının adlarını `feed_post_authors` RPC'siyle yükler (#288 R1).
 * post_id -> display_name haritası döndürür.
 * Kurum geneli (class_id = null) ve sınıf duyuruları dahil tüm görünür duyuruları çözer.
 */
async function loadFeedPostAuthors(
  postIds: string[]
): Promise<Map<string, string>> {
  const unique = postIds.filter(
    (id, index) => Boolean(id) && postIds.indexOf(id) === index
  );
  if (unique.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase.rpc("feed_post_authors", {
    target_post_ids: unique,
  });

  if (error || !data) {
    return new Map();
  }

  const result = new Map<string, string>();
  for (const row of data as {
    post_id: string;
    display_name: string;
  }[]) {
    if (row.post_id && row.display_name) {
      result.set(row.post_id, row.display_name.trim());
    }
  }
  return result;
}

function extractClassName(classes: unknown): string | null {
  if (!classes) return null;
  const clsObj = Array.isArray(classes) ? classes[0] : classes;
  if (!clsObj || typeof clsObj !== "object") return null;
  const cls = clsObj as { name?: string };
  return cls.name?.trim() || null;
}

function mapFeedPostRow(
  row: RawFeedPostRow,
  authorNames: Map<string, string>
): FeedPost {
  const className = extractClassName(row.classes);
  const authorName = authorNames.get(row.id) || "adı okunamadı";

  return {
    id: row.id,
    organizationId: row.organization_id,
    classId: row.class_id,
    className,
    title: row.title.trim(),
    body: row.body?.trim() || null,
    authorMembershipId: row.author_membership_id,
    authorName,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
    audience:
      row.audience === "guardians" || row.audience === "students"
        ? row.audience
        : "all",
    pinned: row.pinned === true,
  };
}

/**
 * Veritabanı ve PostgREST hatalarını kullanıcı dostu Türkçe hata mesajlarına çevirir.
 * ⚠️ PostgREST hata alanı `details`'tir (çoğul); `detail` kullanılmaz (K-23).
 */
export function translateFeedError(error: unknown): string {
  if (!error) {
    return "Beklenmeyen bir hata oluştu.";
  }

  let code: string | undefined;
  let message = "";
  let details = "";

  if (typeof error === "object" && error !== null) {
    const errObj = error as {
      code?: unknown;
      message?: unknown;
      details?: unknown;
      detail?: unknown;
    };
    if (typeof errObj.code === "string") {
      code = errObj.code;
    }
    if (typeof errObj.message === "string") {
      message = errObj.message;
    }
    if (typeof errObj.details === "string") {
      details = errObj.details;
    } else if (typeof errObj.detail === "string") {
      details = errObj.detail;
    }
  } else if (error instanceof Error) {
    message = error.message;
  }

  if (!code && (message || details)) {
    const textToScan = `${message} ${details}`;
    for (const known of ["42501", "23514", "23503"]) {
      if (textToScan.includes(known)) {
        code = known;
        break;
      }
    }
  }

  if (code === "42501") {
    return "Bu işlem için yetkiniz yok veya şifre değişimi bekleniyor. Duyuruları yalnızca kurum yöneticileri ve ilgili sınıfın öğretmenleri yönetebilir.";
  }

  if (code === "23514") {
    return "Duyuru başlığı 1 ile 200 karakter arasında olmalıdır.";
  }

  if (code === "23503") {
    return "Seçilen sınıf bulunamadı ya da arşivlenmiş.";
  }

  if (message && !message.includes("PGRST") && !message.includes("PostgREST")) {
    return message;
  }

  return "Duyuru işlemi gerçekleştirilemedi. Lütfen tekrar deneyin.";
}

/**
 * Kurumun günlük akış duyurularını yükler.
 *
 * - Açık `organization_id` süzgeci taşır (K-19).
 * - Varsayılan olarak arşivlenmemiş duyuruları getirir (`includeArchived` ile tümü).
 * - Açık `.limit()` ve `truncated` bayrağı döner (`rows.length === limit`, depodaki desen).
 */
export async function loadFeedPosts(
  organizationId: string,
  options?: LoadFeedPostsOptions
): Promise<FeedPostListResult> {
  if (!organizationId) {
    return { rows: [], truncated: false };
  }

  const limit = options?.limit ?? DEFAULT_FEED_LIMIT;

  let query = supabase
    .from("daily_feed_posts")
    .select(
      `
      id,
      organization_id,
      class_id,
      title,
      body,
      author_membership_id,
      created_at,
      updated_at,
      archived_at,
      audience,
      pinned,
      classes ( id, name )
    `
    )
    .eq("organization_id", organizationId);

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }

  if (options?.classId !== undefined) {
    if (options.classId === null) {
      query = query.is("class_id", null);
    } else {
      query = query.eq("class_id", options.classId);
    }
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(translateFeedError(error));
  }

  const rawRows = (data ?? []) as RawFeedPostRow[];

  // Duyuru kimlikleriyle feed_post_authors RPC'sinden yazar adlarını al (#288 R1)
  const postIds = rawRows.map(r => r.id);
  const authorNames = await loadFeedPostAuthors(postIds);

  const rows = rawRows.map(r => mapFeedPostRow(r, authorNames));

  return {
    rows,
    truncated: rows.length === limit,
  };
}

/**
 * Yeni bir duyuru oluşturur.
 *
 * ⚠️ Yüke asla `id` ve `author_membership_id` KONMAZ — sunucu atar (#288 / K-00).
 */
export async function createFeedPost(
  input: CreateFeedPostInput
): Promise<FeedPost> {
  const trimmedTitle = input.title.trim();

  const payload = {
    organization_id: input.organizationId,
    class_id: input.classId || null,
    title: trimmedTitle,
    body: input.body?.trim() || null,
    ...(input.audience ? { audience: input.audience } : {}),
    ...(input.pinned !== undefined ? { pinned: input.pinned } : {}),
  };

  const { data, error } = await supabase
    .from("daily_feed_posts")
    .insert(payload)
    .select(
      `
      id,
      organization_id,
      class_id,
      title,
      body,
      author_membership_id,
      created_at,
      updated_at,
      archived_at,
      audience,
      pinned,
      classes ( id, name )
    `
    )
    .single();

  if (error) {
    throw new Error(translateFeedError(error));
  }

  const rawRow = data as RawFeedPostRow;
  const authorNames = await loadFeedPostAuthors([rawRow.id]);

  return mapFeedPostRow(rawRow, authorNames);
}

/**
 * Mevcut bir duyuruyu günceller.
 *
 * ⚠️ Yüke asla `id` ve `author_membership_id` KONMAZ (K-00).
 * ⚠️ Sıfır satır etkilendiğinde hata fırlatır (K-14).
 */
export async function updateFeedPost(
  organizationId: string,
  postId: string,
  input: UpdateFeedPostInput
): Promise<FeedPost> {
  if (!organizationId || !postId) {
    throw new Error("Kurum ve duyuru kimliği gereklidir.");
  }

  const payload: {
    class_id?: string | null;
    title?: string;
    body?: string | null;
    audience?: FeedAudience;
    pinned?: boolean;
  } = {};
  if (input.audience !== undefined) payload.audience = input.audience;
  if (input.pinned !== undefined) payload.pinned = input.pinned;

  if (input.classId !== undefined) {
    payload.class_id = input.classId || null;
  }

  if (input.title !== undefined) {
    const trimmedTitle = input.title.trim();
    payload.title = trimmedTitle;
  }

  if (input.body !== undefined) {
    payload.body = input.body?.trim() || null;
  }

  const { data, error } = await supabase
    .from("daily_feed_posts")
    .update(payload)
    .eq("organization_id", organizationId)
    .eq("id", postId)
    .select(
      `
      id,
      organization_id,
      class_id,
      title,
      body,
      author_membership_id,
      created_at,
      updated_at,
      archived_at,
      audience,
      pinned,
      classes ( id, name )
    `
    );

  if (error) {
    throw new Error(translateFeedError(error));
  }

  if (!data || data.length === 0) {
    throw new Error(
      "Duyuru güncellenemedi veya bu işlem için yetkiniz bulunmuyor."
    );
  }

  const rawRow = data[0] as RawFeedPostRow;
  const authorNames = await loadFeedPostAuthors([rawRow.id]);

  return mapFeedPostRow(rawRow, authorNames);
}

/**
 * Duyuruyu arşive alır (soft-delete).
 *
 * ⚠️ DELETE çalıştırılmaz; `archived_at` doldurulur.
 * ⚠️ Sıfır satır etkilendiğinde hata fırlatır (K-14).
 */
export async function archiveFeedPost(
  organizationId: string,
  postId: string
): Promise<void> {
  if (!organizationId || !postId) {
    throw new Error("Kurum ve duyuru kimliği gereklidir.");
  }

  const { data, error } = await supabase
    .from("daily_feed_posts")
    .update({ archived_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("id", postId)
    .is("archived_at", null)
    .select("id");

  if (error) {
    throw new Error(translateFeedError(error));
  }

  if (!data || data.length === 0) {
    throw new Error(
      "Duyuru arşivlenemedi veya bu işlem için yetkiniz bulunmuyor."
    );
  }
}

/**
 * Arşivlenmiş bir duyuruyu geri getirir.
 *
 * ⚠️ Sıfır satır etkilendiğinde hata fırlatır (K-14).
 */
export async function restoreFeedPost(
  organizationId: string,
  postId: string
): Promise<void> {
  if (!organizationId || !postId) {
    throw new Error("Kurum ve duyuru kimliği gereklidir.");
  }

  const { data, error } = await supabase
    .from("daily_feed_posts")
    .update({ archived_at: null })
    .eq("organization_id", organizationId)
    .eq("id", postId)
    .not("archived_at", "is", null)
    .select("id");

  if (error) {
    throw new Error(translateFeedError(error));
  }

  if (!data || data.length === 0) {
    throw new Error(
      "Duyuru arşivden çıkarılamadı veya bu işlem için yetkiniz bulunmuyor."
    );
  }
}
