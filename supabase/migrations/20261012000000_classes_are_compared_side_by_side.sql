-- Sınıflar yan yana karşılaştırılır.
--
-- Raporlar ekranı (karar 2026-09-29, Arda Bülent): her sınıf tek satır —
-- devam, ödev tamamlama ve seçili aralıktaki net denemelerin ortalaması.
-- Tablo aynı zamanda CSV olarak indirilir.
--
-- Neden tek fonksiyon: istemci her sınıf için üç rapor fonksiyonunu ayrı ayrı
-- çağırsaydı 20 sınıflı bir kurumda 60 istek olurdu. Sayım veritabanının
-- işidir (K-03); yüzde yine istemcide tek formülle hesaplanır (K-06), bu
-- yüzden fonksiyon SAYI döndürür, yüzde döndürmez.
--
-- Yetki: `security definer`, yetki SINIF BAŞINA BİR KEZ çözülür (20260924
-- deseni). Görünür sınıf = çağıranın yönetici olduğu kurumun sınıfı ya da
-- çağıranın okuttuğu sınıf. Bu, kaynak tabloların RLS'iyle birebir aynı
-- kapsamdır:
--   * attendance_sessions / homework_assignments öğretmende
--     `current_user_teaches_class(class_id)`;
--   * attendance_records / exam_results öğretmende
--     `current_user_teaches_student(student_id)` — okuttuğu sınıfa kayıtlı
--     öğrenci zaten bu kümededir ve fonksiyon yalnız o sınıfa kayıtlı
--     öğrencileri sayar.
-- Şifre kilidi (20260925) içeride; öğrenci ve veli hiçbir satır görmez
-- (sınıfı okutmaz, kurumda yönetici değildir).
--
-- Ölçülmeyen ölçü NULL gelir, sıfır değil (K-22): devam kaydı olmayan sınıfın
-- sayıları, bitirilmiş ödevi olmayan sınıfın beklenen sayısı, net denemesi
-- olmayan sınıfın ortalaması boştur.

create function public.report_class_comparison(
  p_weeks integer default 4
)
returns table (
  class_id uuid,
  class_name text,
  student_count bigint,
  present_count bigint,
  late_count bigint,
  absent_count bigint,
  submission_count bigint,
  expected_count bigint,
  net_exam_count bigint,
  net_average numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  pencere_basi date;
begin
  if p_weeks is null or p_weeks < 1 or p_weeks > 26 then
    raise exception 'Rapor aralığı 1 ile 26 hafta arasında olmalı'
      using errcode = '22023';
  end if;

  pencere_basi :=
    date_trunc('week', public.orbit_today())::date - (p_weeks - 1) * 7;

  return query
  with uye_kurum as materialized (
    select unnest(public.current_user_member_org_ids()) as org
  ),
  admin_kurum as materialized (
    select unnest(public.current_user_admin_org_ids()) as org
  ),
  gorunur_sinif as materialized (
    select sinif.id, sinif.name
    from public.classes as sinif
    join uye_kurum on uye_kurum.org = sinif.organization_id
    where sinif.archived_at is null
      and not (select public.current_user_must_change_password())
      and (
        sinif.organization_id in (select org from admin_kurum)
        or public.current_user_teaches_class(sinif.id)
      )
  ),
  kayitli as materialized (
    select kayit.class_id as sinif_id, kayit.student_id as ogrenci_id
    from public.class_enrollments as kayit
    join gorunur_sinif on gorunur_sinif.id = kayit.class_id
    where kayit.archived_at is null
  ),
  devam as (
    select
      oturum.class_id as sinif_id,
      count(*) filter (where kayit.status = 'present') as geldi,
      count(*) filter (where kayit.status = 'late') as gec,
      count(*) filter (where kayit.status = 'absent') as gelmedi
    from public.attendance_sessions as oturum
    join gorunur_sinif on gorunur_sinif.id = oturum.class_id
    join public.attendance_records as kayit on kayit.session_id = oturum.id
    where oturum.archived_at is null
      and oturum.session_date >= pencere_basi
      and oturum.session_date <= public.orbit_today()
    group by oturum.class_id
    having count(*) filter (
      where kayit.status in ('present', 'late', 'absent')
    ) > 0
  ),
  odev as (
    select
      gorev.class_id as sinif_id,
      sum((
        select count(*)
        from public.homework_submissions as teslim
        where teslim.homework_id = gorev.id
          and teslim.archived_at is null
      ))::bigint as teslim,
      sum((
        select count(*)
        from (
          select k.student_id
          from public.class_enrollments as k
          where k.class_id = gorev.class_id
            and k.archived_at is null
          union
          select t.student_id
          from public.homework_submissions as t
          where t.homework_id = gorev.id
            and t.archived_at is null
        ) as beklenen
      ))::bigint as beklenen
    from public.homework_assignments as gorev
    join gorunur_sinif on gorunur_sinif.id = gorev.class_id
    where gorev.archived_at is null
      and gorev.submissions_recorded_at is not null
      and gorev.due_date >= pencere_basi
      and gorev.due_date
            < date_trunc('week', public.orbit_today())::date + 7
    group by gorev.class_id
  ),
  deneme as (
    select
      kayitli.sinif_id,
      count(distinct sinav.id) as sinav_sayisi,
      round(avg(sonuc.score), 2) as ortalama
    from kayitli
    join public.exam_results as sonuc on sonuc.student_id = kayitli.ogrenci_id
    join public.exams as sinav on sinav.id = sonuc.exam_id
    where sinav.archived_at is null
      and sinav.net_penalty is not null
      and sinav.exam_date >= pencere_basi
      and sinav.exam_date <= public.orbit_today()
    group by kayitli.sinif_id
  )
  select
    gorunur_sinif.id,
    gorunur_sinif.name,
    (select count(*) from kayitli where kayitli.sinif_id = gorunur_sinif.id),
    devam.geldi,
    devam.gec,
    devam.gelmedi,
    case when odev.beklenen > 0 then odev.teslim end,
    case when odev.beklenen > 0 then odev.beklenen end,
    deneme.sinav_sayisi,
    deneme.ortalama
  from gorunur_sinif
  left join devam on devam.sinif_id = gorunur_sinif.id
  left join odev on odev.sinif_id = gorunur_sinif.id
  left join deneme on deneme.sinif_id = gorunur_sinif.id
  order by gorunur_sinif.name, gorunur_sinif.id;
end;
$$;

comment on function public.report_class_comparison(integer) is
  'Raporlar ekranının sınıf karşılaştırması: çağıranın görebildiği her arşivsiz sınıf için son p_weeks (1..26) takvim haftasında devam sayıları (katıldı/geç/gelmedi; izinli sayılmaz), bitirilmiş ödevlerin teslim/beklenen sayıları ve pencere içindeki net denemelerde o sınıfa kayıtlı öğrencilerin ortalama neti. Yüzde DÖNMEZ (K-06). Ölçülmeyen NULL (K-22). `security definer`: yetki sınıf başına bir kez — kurumda yönetici ya da sınıfı okutan; şifre kilidi içeride.';

revoke all on function public.report_class_comparison(integer) from public, anon;
grant execute on function public.report_class_comparison(integer) to authenticated;
