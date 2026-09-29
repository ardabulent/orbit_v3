-- Rapor dikkat edilmesi gereken öğrenciyi adıyla söyler.
--
-- Raporlar ekranının üçüncü dilimi (karar 2026-09-29, Arda Bülent). Seçili
-- aralıkta (son p_weeks takvim haftası) şu dört koşuldan BİRİNE takılan
-- öğrenci listeye girer:
--
--   devam       %80'in altında — en az 5 ölçülmüş ders (izinli sayılmaz)
--   ödev        %60'ın altında — en az 3 bitirilmiş ödev
--   net düşüşü  son net deneme bir öncekinden 5 net ya da daha düşük
--   ortalama    son net denemede sınıf ortalamasının 10 net ya da daha altında
--               (ortalama en az 3 sonuçtan; kendisi dahil)
--
-- Eşikler SQL'de, çünkü liste sunucuda süzülür: yüzlerce öğrencinin sayısı
-- istemciye taşınıp orada elenmez (K-03). Yüzde karşılaştırması ekranın
-- gösterdiği yuvarlamayla yapılır — ekranda "%80" yazan öğrenci "%80'in
-- altında" diye listelenmez.
--
-- Fonksiyon her koşulun HAM SAYILARINI da döndürür; ekran nedeni
-- ("Devam %65 · Ödev 2/5") bunlardan yazar, bayrağı yeniden hesaplamaz.
--
-- Yetki: `security definer`, `report_class_comparison` (20261012) ile aynı
-- kapsam — görünür sınıf = kurumda yönetici ya da sınıfı okutan; görünür
-- öğrenci = o sınıflara arşivsiz kayıtlı öğrenci. Sayılan devam ve ödev
-- yalnız görünür sınıflarınkidir. Şifre kilidi içeride; öğrenci ve veli
-- hiçbir satır görmez.
--
-- Sınıf ortalaması: öğrencinin son denemesinde, öğrenciyle aynı görünür
-- sınıfa kayıtlı öğrencilerin ortalaması. Öğrenci birden çok sınıftaysa bu
-- sınıfların birleşimi alınır.

create function public.report_attention_students(
  p_weeks integer default 4
)
returns table (
  student_id uuid,
  student_name text,
  class_names text,
  lesson_count bigint,
  attended_count bigint,
  homework_expected bigint,
  homework_submitted bigint,
  last_net numeric,
  previous_net numeric,
  class_average numeric,
  low_attendance boolean,
  low_homework boolean,
  net_drop boolean,
  below_average boolean
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
  ogrenci as (
    select
      o.id,
      o.full_name,
      string_agg(distinct gorunur_sinif.name, ', ') as siniflar
    from public.students as o
    join kayitli on kayitli.ogrenci_id = o.id
    join gorunur_sinif on gorunur_sinif.id = kayitli.sinif_id
    where o.archived_at is null
    group by o.id, o.full_name
  ),
  devam as (
    select
      k.student_id as ogrenci_id,
      count(*) filter (where k.status in ('present', 'late', 'absent')) as ders,
      count(*) filter (where k.status in ('present', 'late')) as geldi
    from public.attendance_records as k
    join public.attendance_sessions as oturum on oturum.id = k.session_id
    join gorunur_sinif on gorunur_sinif.id = oturum.class_id
    where oturum.archived_at is null
      and oturum.session_date >= pencere_basi
      and oturum.session_date <= public.orbit_today()
    group by k.student_id
  ),
  odev as (
    select
      kayitli.ogrenci_id,
      count(*) as beklenen,
      count(teslim.id) as teslim
    from public.homework_assignments as gorev
    join kayitli on kayitli.sinif_id = gorev.class_id
    left join public.homework_submissions as teslim
      on teslim.homework_id = gorev.id
     and teslim.student_id = kayitli.ogrenci_id
     and teslim.archived_at is null
    where gorev.archived_at is null
      and gorev.submissions_recorded_at is not null
      and gorev.due_date >= pencere_basi
      and gorev.due_date
            < date_trunc('week', public.orbit_today())::date + 7
    group by kayitli.ogrenci_id
  ),
  net_sonuc as (
    select
      sonuc.student_id as ogrenci_id,
      sonuc.exam_id,
      sonuc.score,
      row_number() over (
        partition by sonuc.student_id
        order by sinav.exam_date desc, sinav.id desc
      ) as sira
    from public.exam_results as sonuc
    join public.exams as sinav on sinav.id = sonuc.exam_id
    where sonuc.student_id in (select ogrenci_id from kayitli)
      and sinav.archived_at is null
      and sinav.net_penalty is not null
      and sinav.exam_date >= pencere_basi
      and sinav.exam_date <= public.orbit_today()
  ),
  son_iki as (
    select
      net_sonuc.ogrenci_id,
      max(net_sonuc.exam_id::text) filter (where net_sonuc.sira = 1)::uuid as son_sinav,
      max(net_sonuc.score) filter (where net_sonuc.sira = 1) as son,
      max(net_sonuc.score) filter (where net_sonuc.sira = 2) as onceki
    from net_sonuc
    where net_sonuc.sira <= 2
    group by net_sonuc.ogrenci_id
  ),
  sinif_ortalamasi as (
    -- Öğrencinin son denemesinde, aynı görünür sınıflardaki öğrencilerin
    -- (kendisi dahil) ortalaması; her öğrenci BİR kez sayılır (iki ortak
    -- sınıf onu çift saymaz). Üçten az sonuçta ortalama yok.
    select
      son_iki.ogrenci_id,
      (
        select case when count(*) >= 3 then round(avg(diger.score), 2) end
        from public.exam_results as diger
        where diger.exam_id = son_iki.son_sinav
          and diger.student_id in (
            select arkadas.ogrenci_id
            from kayitli as kendi
            join kayitli as arkadas on arkadas.sinif_id = kendi.sinif_id
            where kendi.ogrenci_id = son_iki.ogrenci_id
          )
      ) as ortalama
    from son_iki
  ),
  bayrak as (
    select
      ogrenci.id,
      ogrenci.full_name,
      ogrenci.siniflar,
      devam.ders,
      devam.geldi,
      odev.beklenen,
      odev.teslim,
      son_iki.son,
      son_iki.onceki,
      sinif_ortalamasi.ortalama,
      coalesce(devam.ders >= 5
        and round(devam.geldi * 100.0 / devam.ders) < 80, false) as dusuk_devam,
      coalesce(odev.beklenen >= 3
        and round(odev.teslim * 100.0 / odev.beklenen) < 60, false) as dusuk_odev,
      coalesce(son_iki.onceki - son_iki.son >= 5, false) as net_dususu,
      coalesce(sinif_ortalamasi.ortalama - son_iki.son >= 10, false) as ortalama_alti
    from ogrenci
    left join devam on devam.ogrenci_id = ogrenci.id
    left join odev on odev.ogrenci_id = ogrenci.id
    left join son_iki on son_iki.ogrenci_id = ogrenci.id
    left join sinif_ortalamasi on sinif_ortalamasi.ogrenci_id = ogrenci.id
  )
  select
    bayrak.id,
    bayrak.full_name,
    bayrak.siniflar,
    bayrak.ders,
    bayrak.geldi,
    bayrak.beklenen,
    bayrak.teslim,
    bayrak.son,
    bayrak.onceki,
    bayrak.ortalama,
    bayrak.dusuk_devam,
    bayrak.dusuk_odev,
    bayrak.net_dususu,
    bayrak.ortalama_alti
  from bayrak
  where bayrak.dusuk_devam or bayrak.dusuk_odev
     or bayrak.net_dususu or bayrak.ortalama_alti
  order by
    (bayrak.dusuk_devam::int + bayrak.dusuk_odev::int
      + bayrak.net_dususu::int + bayrak.ortalama_alti::int) desc,
    bayrak.full_name,
    bayrak.id;
end;
$$;

comment on function public.report_attention_students(integer) is
  'Raporlar ekranının dikkat listesi: son p_weeks (1..26) takvim haftasında devam < %80 (≥5 ders), ödev < %60 (≥3 bitirilmiş ödev), son net deneme bir öncekinden ≥5 net düşük ya da son denemede sınıf ortalamasının (≥3 sonuç) ≥10 net altında olan öğrenciler; ham sayılar ve dört bayrakla. Yüzdeler ekranın yuvarlamasıyla karşılaştırılır. Yalnız bayraklı satır döner, çok bayraklı önce. `security definer`: kapsam `report_class_comparison` ile aynı (yönetici ya da sınıfı okutan); şifre kilidi içeride.';

revoke all on function public.report_attention_students(integer) from public, anon;
grant execute on function public.report_attention_students(integer) to authenticated;
