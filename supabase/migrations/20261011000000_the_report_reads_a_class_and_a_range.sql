-- Rapor bir sınıfı ve bir aralığı okur; deneme kartı neti tanır.
--
-- Raporlar ekranı (karar 2026-09-29, Arda Bülent):
--
--   1. Üstte SINIF SÜZGECİ — üç kart seçilen sınıfa daralır.
--   2. ARALIK 4 / 8 / 12 hafta — deneme kartında son 4 / 8 / 12 sınav.
--   3. Net ile puanlanan denemeler ORTALAMA NET ile çizilir; puanla okunan
--      sınavlar yüzdeyle kalır ve ikisi aynı grafikte karışmaz.
--
-- Üçüncüsü bir hatanın düzeltmesidir: `report_exam_averages` yüzde için
-- `max_score > 0` istiyordu, net ile puanlanan denemede ise (20261007)
-- `max_score` boştur. Yani 2026-09-29'da ölçüldüğü gibi deneme kartı kurumun
-- asıl denemelerini HİÇ görmüyordu (üretimde 1 net, 1 puanlı sınav: kartta
-- yalnız puanlı olan).
--
-- Sözleşme:
--   * Parametreler varsayılanlı; argümansız çağrı bugünkü davranışı verir
--     (dört hafta, dört sınav, bütün sınıflar). Eski testler aynen geçer.
--   * `p_weeks` / `p_limit` 1..26 dışında 22023 ile reddedilir — sessizce
--     kırpılmaz, çünkü "12 hafta istedim, 26 geldi" sorusu cevapsız kalır.
--   * Sınıf süzgeci DARALTIR, hiçbir zaman genişletmez: devam ve ödevde RLS,
--     denemede görünür öğrenci kümesi yine önce uygulanır.
--   * Denemede sınıf = o sınıfa ARŞİVSİZ kayıtlı öğrenciler. Sınavın kendi
--     `class_id`'si değil, çünkü kurum geneli bir denemeye (class_id boş)
--     birden çok sınıf girer.
--   * `average_percent` yalnız puanlı sınavda, `average_net` yalnız net
--     sınavda dolu; `is_net` hangisi olduğunu söyler. Sınır her tür için
--     ayrı: son N net deneme VE son N puanlı sınav.
--
-- Dönüş tipi ve imza değiştiği için üç fonksiyon düşürülüp yeniden kurulur.
-- `report_exam_averages` `security definer` kalır ve şifre kilidi
-- (20260925) aynen korunur.

drop function public.report_attendance_weeks();
drop function public.report_homework_weeks();
drop function public.report_exam_averages();

-- ---------------------------------------------------------------------------
-- 1. Devam: son N takvim haftası, isteğe bağlı sınıf
-- ---------------------------------------------------------------------------
create function public.report_attendance_weeks(
  p_weeks integer default 4,
  p_class_id uuid default null
)
returns table (
  week_start date,
  present_count bigint,
  late_count bigint,
  absent_count bigint
)
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_weeks is null or p_weeks < 1 or p_weeks > 26 then
    raise exception 'Rapor aralığı 1 ile 26 hafta arasında olmalı'
      using errcode = '22023';
  end if;

  return query
  with eksen as (
    select
      date_trunc('week', public.orbit_today())::date - (gecmis * 7) as hafta
    from generate_series(0, p_weeks - 1) as gecmis
  ),
  sayim as (
    select
      date_trunc('week', oturum.session_date)::date as hafta,
      count(*) filter (where kayit.status = 'present') as present_count,
      count(*) filter (where kayit.status = 'late') as late_count,
      count(*) filter (where kayit.status = 'absent') as absent_count
    from public.attendance_records as kayit
    join public.attendance_sessions as oturum
      on oturum.id = kayit.session_id
    where oturum.archived_at is null
      and (p_class_id is null or oturum.class_id = p_class_id)
      and oturum.session_date
            >= date_trunc('week', public.orbit_today())::date - (p_weeks - 1) * 7
      and oturum.session_date <= public.orbit_today()
    group by date_trunc('week', oturum.session_date)::date
    having count(*) filter (
      where kayit.status in ('present', 'late', 'absent')
    ) > 0
  )
  select
    eksen.hafta,
    sayim.present_count,
    sayim.late_count,
    sayim.absent_count
  from eksen
  left join sayim on sayim.hafta = eksen.hafta
  order by eksen.hafta;
end;
$$;

comment on function public.report_attendance_weeks(integer, uuid) is
  'Rapor ekranının devam kartı: son p_weeks (1..26, varsayılan 4) takvim haftası (Pzt–Paz) için katıldı/geç kaldı/gelmedi sayıları; p_class_id verilirse yalnız o sınıfın oturumları. Yüzde DÖNMEZ (K-06, `calculateAttendancePercentage`). `excused` sayılmaz. HER ZAMAN tam p_weeks satır döner, ekseni sunucu kurar. Ölçülmemiş hafta NULL, ölçülmüş sıfır 0 (K-22). Arşivli ve gelecek tarihli oturum dışarıda. `security definer` DEĞİLDİR: kapsam RLS''ten gelir, sınıf süzgeci yalnız daraltır.';

-- ---------------------------------------------------------------------------
-- 2. Ödev: son N takvim haftası, isteğe bağlı sınıf
-- ---------------------------------------------------------------------------
create function public.report_homework_weeks(
  p_weeks integer default 4,
  p_class_id uuid default null
)
returns table (
  week_start date,
  submission_count bigint,
  expected_count bigint
)
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_weeks is null or p_weeks < 1 or p_weeks > 26 then
    raise exception 'Rapor aralığı 1 ile 26 hafta arasında olmalı'
      using errcode = '22023';
  end if;

  return query
  with odev as (
    select
      gorev.id as odev_id,
      gorev.class_id as sinif_id,
      date_trunc('week', gorev.due_date)::date as hafta
    from public.homework_assignments as gorev
    where gorev.archived_at is null
      and gorev.submissions_recorded_at is not null
      and (p_class_id is null or gorev.class_id = p_class_id)
      and gorev.due_date
            >= date_trunc('week', public.orbit_today())::date - (p_weeks - 1) * 7
      and gorev.due_date
            < date_trunc('week', public.orbit_today())::date + 7
  ),
  sayim as (
    select
      odev.hafta as hafta,
      (
        select count(*)
        from public.homework_submissions as teslim
        where teslim.homework_id = odev.odev_id
          and teslim.archived_at is null
      ) as teslim_sayisi,
      (
        select count(*)
        from (
          select kayit.student_id as ogrenci_id
          from public.class_enrollments as kayit
          where kayit.class_id = odev.sinif_id
            and kayit.archived_at is null
          union
          select teslim.student_id as ogrenci_id
          from public.homework_submissions as teslim
          where teslim.homework_id = odev.odev_id
            and teslim.archived_at is null
        ) as beklenen
      ) as beklenen_sayisi
    from odev
  ),
  toplam as (
    select
      sayim.hafta as hafta,
      sum(sayim.teslim_sayisi)::bigint as submission_count,
      sum(sayim.beklenen_sayisi)::bigint as expected_count
    from sayim
    group by sayim.hafta
    having sum(sayim.beklenen_sayisi) > 0
  ),
  eksen as (
    select
      date_trunc('week', public.orbit_today())::date - (gecmis * 7) as hafta
    from generate_series(0, p_weeks - 1) as gecmis
  )
  select
    eksen.hafta,
    toplam.submission_count,
    toplam.expected_count
  from eksen
  left join toplam on toplam.hafta = eksen.hafta
  order by eksen.hafta;
end;
$$;

comment on function public.report_homework_weeks(integer, uuid) is
  'Rapor ekranının ödev kartı: son p_weeks (1..26, varsayılan 4) takvim haftası için (teslim sayısı, beklenen sayı); p_class_id verilirse yalnız o sınıfın ödevleri. Hafta ödevin `due_date`''inden gelir. YALNIZ `submissions_recorded_at` dolu ve arşivsiz ödevler (v1.4-15). Beklenen küme = sınıfın arşivsiz kayıtları ∪ teslim edenler (#297). HER ZAMAN tam p_weeks satır; beklenen sıfır olan hafta NULL. `security definer` DEĞİLDİR.';

-- ---------------------------------------------------------------------------
-- 3. Deneme: son N net deneme ve son N puanlı sınav, isteğe bağlı sınıf
-- ---------------------------------------------------------------------------
create function public.report_exam_averages(
  p_limit integer default 4,
  p_class_id uuid default null
)
returns table (
  exam_id uuid,
  exam_name text,
  exam_date date,
  average_percent numeric,
  result_count bigint,
  average_net numeric,
  is_net boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 26 then
    raise exception 'Rapor aralığı 1 ile 26 sınav arasında olmalı'
      using errcode = '22023';
  end if;

  return query
  with uye_kurum as materialized (
    select unnest(public.current_user_member_org_ids()) as org
  ),
  admin_kurum as materialized (
    select unnest(public.current_user_admin_org_ids()) as org
  ),
  gorunur_ogrenci as materialized (
    -- Yetki öğrenci başına bir kez (20260924); şifre kilidi (20260925).
    -- Sınıf süzgeci bu kümeyi yalnız DARALTIR.
    select ogrenci.id
    from public.students as ogrenci
    join uye_kurum on uye_kurum.org = ogrenci.organization_id
    where not (select public.current_user_must_change_password())
      and (
        ogrenci.organization_id in (select org from admin_kurum)
        or public.current_user_teaches_student(ogrenci.id)
        or ogrenci.auth_user_id = (select auth.uid())
        or public.current_user_guards_student(ogrenci.id)
      )
      and (
        p_class_id is null
        or exists (
          select 1
          from public.class_enrollments as kayit
          where kayit.student_id = ogrenci.id
            and kayit.class_id = p_class_id
            and kayit.archived_at is null
        )
      )
  ),
  aday as materialized (
    -- Net deneme: `net_penalty` dolu. Puanlı sınav: `max_score > 0` (K-04).
    -- Tavanı da cezası da olmayan sınav hiçbir ortalama üretemez, girmez.
    select
      sinav.id, sinav.name, sinav.exam_date, sinav.max_score,
      sinav.net_penalty is not null as netli
    from public.exams as sinav
    join uye_kurum on uye_kurum.org = sinav.organization_id
    where sinav.archived_at is null
      and (sinav.net_penalty is not null or sinav.max_score > 0)
      and exists (
        select 1
        from public.exam_results as sonuc
        join gorunur_ogrenci on gorunur_ogrenci.id = sonuc.student_id
        where sonuc.exam_id = sinav.id
      )
  ),
  son as (
    select sirali.id, sirali.name, sirali.exam_date, sirali.max_score, sirali.netli
    from (
      select
        aday.*,
        row_number() over (
          partition by aday.netli
          order by aday.exam_date desc, aday.id desc
        ) as sira
      from aday
    ) as sirali
    where sirali.sira <= p_limit
  )
  select
    son.id,
    son.name,
    son.exam_date,
    case when not son.netli
      then round(avg(sonuc.score / son.max_score) * 100, 1)
    end,
    count(*),
    case when son.netli then round(avg(sonuc.score), 2) end,
    son.netli
  from son
  join public.exam_results as sonuc on sonuc.exam_id = son.id
  join gorunur_ogrenci on gorunur_ogrenci.id = sonuc.student_id
  group by son.id, son.name, son.exam_date, son.max_score, son.netli
  order by son.exam_date asc, son.id asc;
end;
$$;

comment on function public.report_exam_averages(integer, uuid) is
  'Çağıranın görebildiği sonuçlara göre son p_limit (1..26, varsayılan 4) net deneme ve son p_limit puanlı sınavın ortalaması. Net denemede `average_net` (ortalama net), puanlı sınavda `average_percent` (kendi tavanına göre yüzde) dolu; `is_net` hangisi olduğunu söyler. p_class_id verilirse o sınıfa arşivsiz kayıtlı öğrencilerin sonuçları. Ortalama ÇAĞIRANA GÖRE DEĞİŞİR. Yetki öğrenci başına BİR KEZ çözülür; `security definer`, şifre kilidi içeride.';

revoke all on function public.report_attendance_weeks(integer, uuid) from public, anon;
revoke all on function public.report_homework_weeks(integer, uuid) from public, anon;
revoke all on function public.report_exam_averages(integer, uuid) from public, anon;

grant execute on function public.report_attendance_weeks(integer, uuid) to authenticated;
grant execute on function public.report_homework_weeks(integer, uuid) to authenticated;
grant execute on function public.report_exam_averages(integer, uuid) to authenticated;
