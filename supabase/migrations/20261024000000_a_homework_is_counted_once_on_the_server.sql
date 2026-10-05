-- Ödev tamamlanma sayımı tek çağrıda (2026-10-05, kapsamlı analiz 2. madde,
-- ROADMAP v1.5-24).
--
-- Ödev listesinin "teslim / sınıf" sütunu istemcide iki ayrı okumayla
-- hesaplanıyordu: sınıfların bütün kayıtları ve ödevlerin bütün teslimleri.
-- İkisi de 1000 satır tavanına dayanınca dürüstçe "ölçülemedi" diyordu —
-- 100 ödev × 30 öğrenci = 3000 satır, yani sütun çoğu kurumda hiç
-- görünmüyordu. Eşzamanlılık ölçümünde (§4.23) öğrenci/veli ödev okumasının
-- maliyeti de buradan geliyordu.
--
-- `homework_completion_counts` sayımı sunucuda yapar ve ödev başına tek satır
-- döner. Anlam istemcideki eski hesapla aynı (K-03):
--   pay   = ödevi teslim eden (arşivlenmemiş teslim) öğrenci sayısı
--   payda = sınıfın etkin öğrencileri BİRLEŞİM teslim edenler — sınıftan
--           ayrılmış ama teslim etmiş öğrenci de paydaya girer, "12 / 10"
--           gibi bir oran çıkmaz.
--
-- Yetki: sınıfın tamamını görebilen sayar — kurum yöneticisi ya da o sınıfın
-- öğretmeni (bugünkü RLS'in verdiği görünürlükle aynı); şifre kilidi geçerli.
-- Diğerleri için satır dönmez. Kalıp `student_homework_ratios` ile aynı:
-- `security definer` + yetkiyi ödev başına bir kez çözen `gorunur` CTE.

create function public.homework_completion_counts(target_homework_ids uuid[])
returns table (homework_id uuid, submitted_count bigint, total_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with gorunur as (
    select odev.id, odev.class_id, odev.organization_id
    from public.homework_assignments as odev
    where odev.id = any(target_homework_ids)
      and odev.archived_at is null
      and odev.class_id is not null
      and not (select public.current_user_must_change_password())
      and (
        public.current_user_has_membership(
          odev.organization_id, null, array['admin']::public.app_role[]
        )
        or public.current_user_teaches_class(odev.class_id)
      )
  ),
  teslim as (
    select gorunur.id as homework_id, kayit.student_id
    from gorunur
    join public.homework_submissions as kayit
      on kayit.homework_id = gorunur.id
     and kayit.archived_at is null
  ),
  ogrenci as (
    select gorunur.id as homework_id, kayit.student_id
    from gorunur
    join public.class_enrollments as kayit
      on kayit.class_id = gorunur.class_id
     and kayit.organization_id = gorunur.organization_id
     and kayit.archived_at is null
    union
    select teslim.homework_id, teslim.student_id from teslim
  )
  select
    gorunur.id,
    (select count(distinct teslim.student_id) from teslim
      where teslim.homework_id = gorunur.id),
    (select count(*) from ogrenci where ogrenci.homework_id = gorunur.id)
  from gorunur;
$$;

comment on function public.homework_completion_counts(uuid[]) is
  'Ödev başına teslim eden sayısı ve payda (sınıfın etkin öğrencileri ∪ teslim edenler). Yalnız yönetici ya da sınıfın öğretmeni için satır döner; şifre kilidi geçerli. 2026-10-05, v1.5-24.';

revoke all on function public.homework_completion_counts(uuid[]) from public, anon;
grant execute on function public.homework_completion_counts(uuid[]) to authenticated;
