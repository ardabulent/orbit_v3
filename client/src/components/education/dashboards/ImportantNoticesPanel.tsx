import { Megaphone } from "lucide-react";
import { useFeedPosts } from "@/education/educationQueries";
import { formatTrDate, orbitLocalDate } from "@/education/trDate";
import { ErrorState } from "../shared";
import type { Section } from "../types";

/** Panelde gösterilen en yeni önemli duyuru sayısı. */
const SHOWN = 3;

/**
 * Öğrenci ve velinin Genel Bakış'ında "Önemli duyurular" (karar
 * 2026-09-29). Hedef kitle ve sınıf süzgecini veritabanı uygular
 * (`daily_feed_posts_audience`); burada yalnız önemli işaretliler
 * seçilir. Önemli duyuru yoksa panel hiç çizilmez.
 */
export function ImportantNoticesPanel({
  onNavigate,
}: {
  onNavigate: (section: Section) => void;
}) {
  const query = useFeedPosts({ includeArchived: false });

  if (query.isPending) return null;
  if (query.isError)
    return (
      <ErrorState
        className="mt-6"
        message="Duyurular alınamadı."
        onRetry={() => void query.refetch()}
      />
    );

  const important = query.data.rows.filter(post => post.pinned).slice(0, SHOWN);
  if (important.length === 0) return null;

  return (
    <section className="mt-6 rounded-2xl border border-rose-200 bg-rose-50/40 p-5">
      <div className="flex items-end justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-[17px] font-extrabold tracking-[-.03em] text-slate-900">
          <Megaphone className="h-4 w-4 text-rose-600" />
          Önemli duyurular
        </h2>
        <button
          type="button"
          onClick={() => onNavigate("İletişim")}
          className="text-blue-600"
        >
          <span className="text-[11px] font-bold">Tüm duyurular</span>
        </button>
      </div>
      <ul className="mt-3 space-y-2">
        {important.map(post => (
          <li
            key={post.id}
            className="rounded-xl border border-rose-100 bg-white px-3.5 py-3"
          >
            <p className="text-[13px] font-bold text-slate-800">{post.title}</p>
            {post.body ? (
              <p className="mt-0.5 line-clamp-2 text-[12px] text-slate-600">
                {post.body}
              </p>
            ) : null}
            <p className="mt-1 text-[10px] text-slate-400">
              {[
                formatTrDate(orbitLocalDate(post.createdAt)),
                post.className ?? "Kurum geneli",
                post.authorName,
              ].join(" · ")}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
