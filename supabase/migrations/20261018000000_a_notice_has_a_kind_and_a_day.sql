-- Duyurunun bir türü ve günü olur.
--
-- Karar 2026-09-30 (Arda Bülent): sınav duyurusu İletişim'de yapılır.
-- Yeni duyuruda tür seçilir — Genel / Sınav / Etkinlik / Toplantı — ve
-- isteğe bağlı bir tarih girilir; tarihli duyuru Gün Planı takviminde
-- görünür. Sınavlar sekmesi yalnız sınav kaydı ve sonuç içindir.
--
--   kind        general | exam | event | meeting (varsayılan general;
--               eski duyuruların hepsi "Genel" olur, anlamları değişmez)
--   event_date  duyurunun anlattığı günün tarihi (sınav günü, toplantı
--               günü). Yayın tarihi DEĞİL — o `created_at`. Boş olabilir.
--
-- Tarih yalnız Genel dışındaki türlerde anlamlıdır ama şema bunu
-- zorlamaz: "Genel" bir duyuruya tarih yazılması zararsızdır ve ekran
-- tarihi zaten yalnız öbür türlerde sorar. Görünürlük değişmez — hedef
-- kitle kuralı (daily_feed_posts_audience) aynen geçerli; takvimde de
-- yalnız kişinin görebildiği duyurular görünür.

alter table public.daily_feed_posts
  add column kind text not null default 'general',
  add column event_date date,
  add constraint daily_feed_posts_kind_check
    check (kind in ('general', 'exam', 'event', 'meeting'));

comment on column public.daily_feed_posts.kind is
  'Duyuru türü: general (Genel), exam (Sınav), event (Etkinlik), meeting (Toplantı). Karar 2026-09-30.';
comment on column public.daily_feed_posts.event_date is
  'Duyurunun anlattığı gün (sınav/etkinlik/toplantı günü); yayın tarihi değil. Doluysa Gün Planı takviminde görünür.';

grant insert (kind, event_date) on public.daily_feed_posts to authenticated;
grant update (kind, event_date) on public.daily_feed_posts to authenticated;

-- Takvim sorgusu tarihli duyuruları kurum ve güne göre okur.
create index daily_feed_posts_event_date_idx
  on public.daily_feed_posts (organization_id, event_date)
  where event_date is not null and archived_at is null;

-- İz defteri tür ve tarih değişikliğini de yazar.
drop trigger daily_feed_posts_audit_insert on public.daily_feed_posts;
drop trigger daily_feed_posts_audit_update on public.daily_feed_posts;

create trigger daily_feed_posts_audit_insert
  after insert on public.daily_feed_posts
  for each row execute function public.audit_row_change(
    'feed_post', 'title', 'class_id', 'audience', 'pinned', 'kind', 'event_date'
  );

create trigger daily_feed_posts_audit_update
  after update on public.daily_feed_posts
  for each row execute function public.audit_row_change(
    'feed_post', 'title', 'class_id', 'audience', 'pinned', 'kind', 'event_date'
  );
