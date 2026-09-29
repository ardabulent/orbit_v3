-- Duyuru kime gittiğini bilir; önemli olan üstte durur.
--
-- =========================================================================
-- Neden gerekti
-- =========================================================================
--
-- Karar (2026-09-29, Arda Bülent): duyuruya **hedef kitle** (herkes / yalnız
-- veliler / yalnız öğrenciler) ve **önemli / sabitle** eklenir.
--
-- "Veli toplantısı Cuma 18:00" öğrencinin panosunu, "yarın deneme var,
-- kalem getirin" velinin panosunu doldurmamalı. Bugüne kadar duyurunun
-- tek süzgeci **kapsamdı** (kurum geneli ya da sınıf).
--
-- =========================================================================
-- Hedef kitle neden kısıtlayıcı bir politika
-- =========================================================================
--
-- Okuma politikaları izin verici ve birbirine VEYA ile bağlı:
-- `daily_feed_posts_select_organization_wide` kurumun her üyesine kurum
-- geneli duyuruyu açıyor. Hedef kitleyi o politikaların içine yazmak, her
-- birinin ayrı ayrı güncellenmesini ve birinin unutulmamasını gerektirirdi
-- — unutulan tek politika süzgeci deler. **Kısıtlayıcı** (restrictive) bir
-- politika bütün izin verici politikalarla VE'lenir: tek yerde, hepsinin
-- üstünde durur.
--
--   all        → kimse elenmez
--   guardians  → kurumun personeli (yönetici, öğretmen) ve velileri
--   students   → kurumun personeli ve öğrencileri
--
-- Personel hedef kitleden bağımsız görür: duyuruyu yazan ve yöneten onlar.
-- Rol, kurumdaki etkin üyelikten okunur (`current_user_has_membership`).
-- Bu yetki sınırıdır; ekrandaki süzgeç yalnız kullanıcı deneyimi.
--
-- `pinned`: önemli duyuru listenin üstünde durur ve öğrenci/veli Genel
-- Bakış'ında görünür. Sıralama istemcide; veritabanı yalnız bayrağı taşır.

alter table public.daily_feed_posts
  add column audience text not null default 'all',
  add column pinned boolean not null default false,
  add constraint daily_feed_posts_audience_check
    check (audience in ('all', 'guardians', 'students'));

comment on column public.daily_feed_posts.audience is
  'Duyurunun hedef kitlesi: all (herkes), guardians (yalnız veliler), students (yalnız öğrenciler). Personel her durumda görür. Uygulayan: daily_feed_posts_audience (restrictive).';
comment on column public.daily_feed_posts.pinned is
  'Önemli duyuru: listenin üstünde durur, öğrenci/veli Genel Bakış''ında görünür.';

grant insert (audience, pinned) on public.daily_feed_posts to authenticated;
grant update (audience, pinned) on public.daily_feed_posts to authenticated;

create policy daily_feed_posts_audience on public.daily_feed_posts
as restrictive
for select to authenticated
using (
  (
    audience = 'all'
    or public.current_user_has_membership(
      organization_id, null, array['admin', 'teacher']::public.app_role[]
    )
    or (
      audience = 'guardians'
      and public.current_user_has_membership(
        organization_id, null, array['parent']::public.app_role[]
      )
    )
    or (
      audience = 'students'
      and public.current_user_has_membership(
        organization_id, null, array['student']::public.app_role[]
      )
    )
  )
  and not (select public.current_user_must_change_password())
);

-- İz defteri hedef kitle ve sabitleme değişikliğini de yazar.
drop trigger daily_feed_posts_audit_insert on public.daily_feed_posts;
drop trigger daily_feed_posts_audit_update on public.daily_feed_posts;

create trigger daily_feed_posts_audit_insert
  after insert on public.daily_feed_posts
  for each row execute function public.audit_row_change(
    'feed_post', 'title', 'class_id', 'audience', 'pinned'
  );

create trigger daily_feed_posts_audit_update
  after update on public.daily_feed_posts
  for each row execute function public.audit_row_change(
    'feed_post', 'title', 'class_id', 'audience', 'pinned'
  );
