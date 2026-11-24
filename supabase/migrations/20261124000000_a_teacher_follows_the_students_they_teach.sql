-- Takip sekmesi, 1. dilim (2026-11-24, kurum sahibinin sıra kararı).
--
-- Raporlar → Takip: yönetici ve öğretmen sorumlu oldukları öğrencileri bir
-- ölçüte (devam, net, ödev…) ve KENDİ yazdıkları iki sınıra göre riskli /
-- orta / güvenli diye ayırıp sıralar.
--
-- Bölünme bilinçli: bu fonksiyon yalnız HAM SAYI döndürür; bant, "genel
-- durum" ve sıralama istemcide hesaplanır. Sınırlar bir güvenlik kararı
-- değil bir görünüm; kimin hangi öğrenciyi gördüğü ise burada, sunucuda
-- kararlaştırılır. Böylece kullanıcı 80'i 75 yaptığında sorgu tekrarlanmaz.
--
-- İki nesne:
--   1. `tracking_threshold_defaults` — kurumun varsayılan iki sınırı
--      (ölçüt başına). Kişinin son seçimi tarayıcıda tutulur, burada değil.
--   2. `tracking_student_metrics(p_weeks, p_class_id, p_student_id)` —
--      öğrenci başına ham sayılar.

-- =========================================================================
-- 1. Kurum varsayılan sınırları
-- =========================================================================
--
-- `id` yalnız denetim kaydının `entity_id`'si için var (`audit_row_change`
-- `new.id` okur); doğal anahtar (kurum, ölçüt).
--
-- Yön kuralı veritabanında da denetlenir: "yüksek olan iyi" ölçütte riskli
-- sınırı güvenli sınırını geçemez, "düşük olan iyi"de tersi. İstemci aynı
-- kuralı kullanıcıya gösterir; buradaki `check` istemciye güvenmemek için.
-- Ölçüt listesi istemcideki `trackingMetrics.ts` ile aynıdır.
-- `target_gap` 2. dilimde (hedef net) kullanılacak; şimdiden listede ki
-- 2. dilim bu kısıtı değiştirmek zorunda kalmasın.

create table public.tracking_threshold_defaults (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  metric text not null,
  risk_limit numeric(7, 2) not null,
  safe_limit numeric(7, 2) not null,
  -- İstemci yazamaz; tetikleyici çağıranın üyeliğinden doldurur.
  updated_by_membership_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tracking_threshold_defaults_org_metric_key unique (organization_id, metric),
  constraint tracking_threshold_defaults_metric_check check (
    metric in (
      'attendance_pct', 'late_count', 'absence_streak', 'net_avg', 'subject_net',
      'net_trend', 'exam_missed', 'homework_pct', 'target_gap'
    )
  ),
  constraint tracking_threshold_defaults_range_check check (
    risk_limit between -200 and 200 and safe_limit between -200 and 200
  ),
  constraint tracking_threshold_defaults_direction_check check (
    (metric in ('attendance_pct', 'net_avg', 'subject_net', 'net_trend', 'homework_pct')
      and risk_limit <= safe_limit)
    or (metric in ('late_count', 'absence_streak', 'exam_missed', 'target_gap')
      and risk_limit >= safe_limit)
  ),
  constraint tracking_threshold_defaults_updater_organization_fkey
    foreign key (updated_by_membership_id, organization_id)
    references public.organization_memberships (id, organization_id) on delete restrict
);

comment on table public.tracking_threshold_defaults is
  'Takip sekmesinin kurum varsayılan sınırları: ölçüt başına riskli ve güvenli sınırı. Satır yoksa istemci kendi kod varsayılanını kullanır. Yalnız tam yönetici yazar; kurumun yönetici ve öğretmenleri okur. Kişinin son seçimi burada değil, tarayıcıda tutulur.';

create index tracking_threshold_defaults_updater_idx
  on public.tracking_threshold_defaults (updated_by_membership_id);

create trigger tracking_threshold_defaults_set_updated_at
before update on public.tracking_threshold_defaults
for each row execute function public.set_updated_at();

-- "Son değiştiren" her yazıda çağırandan alınır ve istemcinin verdiği değer
-- ezilir: kimin değiştirdiği bir iddia değil, bir ölçüm olmalı.
create function public.fill_tracking_default_updater()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    select uyelik.id
    into new.updated_by_membership_id
    from public.organization_memberships as uyelik
    where uyelik.user_id = (select auth.uid())
      and uyelik.organization_id = new.organization_id
      and uyelik.status = 'active'
    order by uyelik.branch_id nulls first
    limit 1;
  end if;
  return new;
end;
$$;

comment on function public.fill_tracking_default_updater() is
  'tracking_threshold_defaults.updated_by_membership_id alanını çağıranın aktif üyeliğiyle doldurur; istemcinin verdiği değeri ezer.';

revoke all on function public.fill_tracking_default_updater()
  from public, anon, authenticated;

create trigger tracking_threshold_defaults_fill_updater
before insert or update on public.tracking_threshold_defaults
for each row execute function public.fill_tracking_default_updater();

alter table public.tracking_threshold_defaults enable row level security;

revoke all on public.tracking_threshold_defaults from anon, authenticated;
grant select on public.tracking_threshold_defaults to authenticated;
grant insert (organization_id, metric, risk_limit, safe_limit)
  on public.tracking_threshold_defaults to authenticated;
-- `organization_id` ve `metric` de güncellenebilir, çünkü istemci tek bir
-- `upsert` atar ve PostgREST çakışmada gönderilen BÜTÜN sütunları
-- `do update set` eder. Kurum değişimini güncelleme politikasının
-- `with check`'i yine tam yöneticinin kurumuyla sınırlar.
grant update (organization_id, metric, risk_limit, safe_limit)
  on public.tracking_threshold_defaults to authenticated;

create policy tracking_threshold_defaults_select_staff
  on public.tracking_threshold_defaults
  for select to authenticated
  using (
    not (select public.current_user_must_change_password())
    -- Satır değeriyle yetki fonksiyonu çağrılmaz (5.1 kuralı,
    -- `reads_authorized_once`): bağımsız alt sorgu bir kez hesaplanır.
    and organization_id in (
      select uyelik.organization_id
      from public.organization_memberships as uyelik
      where uyelik.user_id = (select auth.uid())
        and uyelik.status = 'active'
        and uyelik.role in ('admin', 'teacher')
    )
  );

create policy tracking_threshold_defaults_insert_full_admin
  on public.tracking_threshold_defaults
  for insert to authenticated
  with check (
    not (select public.current_user_must_change_password())
    and organization_id = any ((select public.current_user_full_admin_org_ids())::uuid[])
  );

create policy tracking_threshold_defaults_update_full_admin
  on public.tracking_threshold_defaults
  for update to authenticated
  using (
    not (select public.current_user_must_change_password())
    and organization_id = any ((select public.current_user_full_admin_org_ids())::uuid[])
  )
  with check (
    not (select public.current_user_must_change_password())
    and organization_id = any ((select public.current_user_full_admin_org_ids())::uuid[])
  );

create trigger tracking_threshold_defaults_audit_insert
  after insert on public.tracking_threshold_defaults
  for each row execute function public.audit_row_change(
    'tracking_threshold_default', 'metric', 'risk_limit', 'safe_limit'
  );

create trigger tracking_threshold_defaults_audit_update
  after update on public.tracking_threshold_defaults
  for each row execute function public.audit_row_change(
    'tracking_threshold_default', 'metric', 'risk_limit', 'safe_limit'
  );

-- =========================================================================
-- 2. Öğrenci başına ham sayılar
-- =========================================================================
--
-- Kapsam (`classes_select` politikasıyla aynı yönetici dalları, artı okutan
-- öğretmen — vekillik dahil, `current_user_teaching_class_ids`):
--   görünür sınıf = üye olunan kurumda arşivsiz sınıf VE
--     (tam yönetici ∨ şubesiz sınıfta herhangi bir yönetici
--      ∨ yönetilen şubenin sınıfı ∨ okutulan sınıf)
--   görünür öğrenci = o sınıflara arşivsiz kayıtlı arşivsiz öğrenci
-- Öğrenci ve veli hiçbir satır görmez (okuttuğu sınıf yok, yönetici değil).
-- Kapsam dışı `p_class_id` / `p_student_id` HATA DEĞİL, boş sonuç döndürür:
-- hata "böyle bir öğrenci var" bilgisini sızdırırdı.
--
-- Hız: yetki dizileri bir kez hesaplanır; öğrenci kümesi en başta daraltılır
-- ve ağır tablolara yalnız bu kümeyle girilir. Her kaynak tek geçişte
-- toplanır; satır başına alt sorgu yoktur. Sınıf ortalamaları (sınıf, sınav)
-- ve (sınıf, ders) toplamlarından çıkarılır — "her öğrencinin her sınıf
-- arkadaşı" çarpımı kurulmaz.
--
-- Ölçümler (kararlar §2, dikkat listesiyle uyumlu):
--   * Devam: izinli derse sayılmaz (`lesson_count` = geldi + geç + gelmedi).
--   * Üst üste devamsızlık: pencere içinde, en son dersten geriye doğru
--     kesintisiz "gelmedi" sayısı; izinli zinciri kırmaz, sayılmaz da.
--   * Net: yalnız net denemeler (`net_penalty` dolu). `net_avg3` son üç
--     denemenin ortalaması.
--   * Sınıf ortalaması: öğrencinin son denemesinde, öğrencinin görünür
--     sınıflarındaki sonuçların ortalaması; üçten az sonuçta yok. İki sınıfı
--     paylaşan bir öğrenci iki kez sayılabilir (bilinen, küçük sapma; dikkat
--     listesi bunu ayıklar, Takip hız için ayıklamaz).
--   * Ders neti: sınav başına `doğru − yanlış / net_penalty` (aynı derse ait
--     bölümler toplanır), sonra sınavlar üzerinden ortalama.
--   * Girilmeyen deneme: etkin `exam_absences` kaydı. Beklenen deneme =
--     sonucu, yokluk kaydı ya da öğrencinin sınıfına açılmış olan net deneme.
--   * Ödev: bitirilmiş (`submissions_recorded_at` dolu) ödevler.

create function public.tracking_student_metrics(
  p_weeks integer default 4,
  p_class_id uuid default null,
  p_student_id uuid default null
)
returns table (
  student_id uuid,
  student_name text,
  class_names text,
  lesson_count bigint,
  present_count bigint,
  late_count bigint,
  absent_count bigint,
  excused_count bigint,
  absence_streak bigint,
  exam_expected bigint,
  exam_missed bigint,
  last_net numeric,
  previous_net numeric,
  net_avg3 numeric,
  class_avg_last numeric,
  subject_nets jsonb,
  homework_expected bigint,
  homework_submitted bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  bugun date := public.orbit_today();
  pencere_basi date;
  hafta_sonu date;
  uye_kurumlar uuid[];
  tam_yonetici uuid[];
  yonetici uuid[];
  yonetilen_sube uuid[];
  okutulan uuid[];
begin
  if p_weeks is null or p_weeks < 1 or p_weeks > 26 then
    raise exception 'Takip aralığı 1 ile 26 hafta arasında olmalı'
      using errcode = '22023';
  end if;

  if public.current_user_must_change_password() then
    return;
  end if;

  pencere_basi := date_trunc('week', bugun)::date - (p_weeks - 1) * 7;
  hafta_sonu := date_trunc('week', bugun)::date + 7;

  uye_kurumlar := public.current_user_member_org_ids();
  tam_yonetici := public.current_user_full_admin_org_ids();
  yonetici := public.current_user_admin_org_ids();
  yonetilen_sube := public.current_user_admin_branch_ids();
  okutulan := public.current_user_teaching_class_ids();

  return query
  with gorunur_sinif as materialized (
    select sinif.id, sinif.name, sinif.organization_id
    from public.classes as sinif
    where sinif.archived_at is null
      and sinif.organization_id = any (uye_kurumlar)
      and (p_class_id is null or sinif.id = p_class_id)
      and (
        sinif.organization_id = any (tam_yonetici)
        or (sinif.branch_id is null and sinif.organization_id = any (yonetici))
        or sinif.branch_id = any (yonetilen_sube)
        or sinif.id = any (okutulan)
      )
  ),
  kayitli as materialized (
    select kayit.class_id as sinif_id, kayit.student_id as ogrenci_id
    from public.class_enrollments as kayit
    join gorunur_sinif on gorunur_sinif.id = kayit.class_id
    join public.students as o on o.id = kayit.student_id and o.archived_at is null
    where kayit.archived_at is null
      and (p_student_id is null or kayit.student_id = p_student_id)
  ),
  ogrenci as (
    select
      o.id,
      o.full_name,
      string_agg(distinct gorunur_sinif.name, ', ') as siniflar
    from kayitli
    join public.students as o on o.id = kayitli.ogrenci_id
    join gorunur_sinif on gorunur_sinif.id = kayitli.sinif_id
    group by o.id, o.full_name
  ),
  -- Devam -------------------------------------------------------------------
  devam_kayit as materialized (
    select
      k.student_id as ogrenci_id,
      k.status,
      row_number() over (
        partition by k.student_id
        order by oturum.session_date desc,
                 oturum.starts_at desc nulls last,
                 oturum.id desc
      ) as sira
    from public.attendance_sessions as oturum
    join kayitli on kayitli.sinif_id = oturum.class_id
    join public.attendance_records as k
      on k.session_id = oturum.id
     and k.student_id = kayitli.ogrenci_id
    where oturum.archived_at is null
      and oturum.session_date >= pencere_basi
      and oturum.session_date <= bugun
  ),
  devam as (
    select
      d.ogrenci_id,
      count(*) filter (where d.status in ('present', 'late', 'absent')) as ders,
      count(*) filter (where d.status = 'present') as geldi,
      count(*) filter (where d.status = 'late') as gec,
      count(*) filter (where d.status = 'absent') as gelmedi,
      count(*) filter (where d.status = 'excused') as izinli
    from devam_kayit as d
    group by d.ogrenci_id
  ),
  seri as (
    -- İzinliler atılıp yeniden sıralanır; ilk "geldi/geç" kaydından önceki
    -- kayıtların hepsi "gelmedi"dir.
    select
      s.ogrenci_id,
      coalesce(
        min(s.yeni_sira) filter (where s.status in ('present', 'late')) - 1,
        count(*)
      ) as uzunluk
    from (
      select
        d.ogrenci_id,
        d.status,
        row_number() over (partition by d.ogrenci_id order by d.sira) as yeni_sira
      from devam_kayit as d
      where d.status <> 'excused'
    ) as s
    group by s.ogrenci_id
  ),
  -- Denemeler ---------------------------------------------------------------
  sinav_penceresi as materialized (
    select sinav.id, sinav.class_id, sinav.exam_date, sinav.net_penalty
    from public.exams as sinav
    where sinav.organization_id in (select distinct organization_id from gorunur_sinif)
      and sinav.archived_at is null
      and sinav.net_penalty is not null
      and sinav.exam_date >= pencere_basi
      and sinav.exam_date <= bugun
  ),
  sonuc as materialized (
    select
      r.student_id as ogrenci_id,
      r.exam_id,
      r.score,
      row_number() over (
        partition by r.student_id
        order by sp.exam_date desc, sp.id desc
      ) as sira
    from public.exam_results as r
    join sinav_penceresi as sp on sp.id = r.exam_id
    where r.student_id in (select distinct ogrenci_id from kayitli)
  ),
  net_ozet as (
    select
      s.ogrenci_id,
      max(s.exam_id::text) filter (where s.sira = 1)::uuid as son_sinav,
      max(s.score) filter (where s.sira = 1) as son,
      max(s.score) filter (where s.sira = 2) as onceki,
      round(avg(s.score) filter (where s.sira <= 3), 2) as ort3
    from sonuc as s
    group by s.ogrenci_id
  ),
  yokluk as materialized (
    select y.student_id as ogrenci_id, y.exam_id
    from public.exam_absences as y
    join sinav_penceresi as sp on sp.id = y.exam_id
    where y.archived_at is null
      and y.student_id in (select distinct ogrenci_id from kayitli)
  ),
  beklenen as (
    select b.ogrenci_id, count(*) as adet
    from (
      select s.ogrenci_id, s.exam_id from sonuc as s
      union
      select y.ogrenci_id, y.exam_id from yokluk as y
      union
      select kayitli.ogrenci_id, sp.id
      from sinav_penceresi as sp
      join kayitli on kayitli.sinif_id = sp.class_id
    ) as b
    group by b.ogrenci_id
  ),
  girmedi as (
    select y.ogrenci_id, count(*) as adet
    from yokluk as y
    group by y.ogrenci_id
  ),
  sinif_sinav as (
    -- Son denemelerin sınıf toplamları: (sınıf, sınav) başına tek satır.
    select kayitli.sinif_id, r.exam_id, sum(r.score) as toplam, count(*) as adet
    from public.exam_results as r
    join kayitli on kayitli.ogrenci_id = r.student_id
    where r.exam_id in (select n.son_sinav from net_ozet as n)
    group by kayitli.sinif_id, r.exam_id
  ),
  sinif_ortalamasi as (
    select
      n.ogrenci_id,
      case when sum(ss.adet) >= 3 then round(sum(ss.toplam) / sum(ss.adet), 2) end as ortalama
    from net_ozet as n
    join kayitli on kayitli.ogrenci_id = n.ogrenci_id
    join sinif_sinav as ss
      on ss.sinif_id = kayitli.sinif_id
     and ss.exam_id = n.son_sinav
    group by n.ogrenci_id
  ),
  -- Ders netleri ------------------------------------------------------------
  ders_sinav as materialized (
    select
      bs.student_id as ogrenci_id,
      bolum.subject_id,
      bs.exam_id,
      sum(bs.correct - bs.wrong::numeric / sp.net_penalty) as net
    from sinav_penceresi as sp
    join public.exam_sections as bolum
      on bolum.exam_id = sp.id
     and bolum.archived_at is null
     and bolum.subject_id is not null
    join public.exam_section_results as bs on bs.section_id = bolum.id
    where bs.student_id in (select distinct ogrenci_id from kayitli)
    group by bs.student_id, bolum.subject_id, bs.exam_id
  ),
  ders_ogrenci as materialized (
    select d.ogrenci_id, d.subject_id, avg(d.net) as ortalama, count(*) as adet
    from ders_sinav as d
    group by d.ogrenci_id, d.subject_id
  ),
  ders_sinif as (
    select kayitli.sinif_id, d.subject_id, sum(d.ortalama) as toplam, count(*) as adet
    from ders_ogrenci as d
    join kayitli on kayitli.ogrenci_id = d.ogrenci_id
    group by kayitli.sinif_id, d.subject_id
  ),
  ders_sinif_ogrenci as (
    select
      kayitli.ogrenci_id,
      ds.subject_id,
      case when sum(ds.adet) >= 3 then round(sum(ds.toplam) / sum(ds.adet), 2) end as ortalama
    from kayitli
    join ders_sinif as ds on ds.sinif_id = kayitli.sinif_id
    group by kayitli.ogrenci_id, ds.subject_id
  ),
  ders_json as (
    select
      d.ogrenci_id,
      jsonb_agg(
        jsonb_build_object(
          'subject_id', d.subject_id,
          'subject_name', ders.name,
          'avg_net', round(d.ortalama, 2),
          'class_avg', dso.ortalama,
          'exam_count', d.adet
        )
        order by ders.name, d.subject_id
      ) as dersler
    from ders_ogrenci as d
    join public.subjects as ders on ders.id = d.subject_id
    left join ders_sinif_ogrenci as dso
      on dso.ogrenci_id = d.ogrenci_id
     and dso.subject_id = d.subject_id
    group by d.ogrenci_id
  ),
  -- Ödev --------------------------------------------------------------------
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
      and gorev.due_date < hafta_sonu
    group by kayitli.ogrenci_id
  )
  select
    ogrenci.id,
    ogrenci.full_name,
    ogrenci.siniflar,
    coalesce(devam.ders, 0),
    coalesce(devam.geldi, 0),
    coalesce(devam.gec, 0),
    coalesce(devam.gelmedi, 0),
    coalesce(devam.izinli, 0),
    coalesce(seri.uzunluk, 0),
    coalesce(beklenen.adet, 0),
    coalesce(girmedi.adet, 0),
    net_ozet.son,
    net_ozet.onceki,
    net_ozet.ort3,
    sinif_ortalamasi.ortalama,
    coalesce(ders_json.dersler, '[]'::jsonb),
    coalesce(odev.beklenen, 0),
    coalesce(odev.teslim, 0)
  from ogrenci
  left join devam on devam.ogrenci_id = ogrenci.id
  left join seri on seri.ogrenci_id = ogrenci.id
  left join net_ozet on net_ozet.ogrenci_id = ogrenci.id
  left join beklenen on beklenen.ogrenci_id = ogrenci.id
  left join girmedi on girmedi.ogrenci_id = ogrenci.id
  left join sinif_ortalamasi on sinif_ortalamasi.ogrenci_id = ogrenci.id
  left join ders_json on ders_json.ogrenci_id = ogrenci.id
  left join odev on odev.ogrenci_id = ogrenci.id
  order by ogrenci.full_name, ogrenci.id;
end;
$$;

comment on function public.tracking_student_metrics(integer, uuid, uuid) is
  'Takip sekmesi: son p_weeks (1..26) takvim haftasında görünür öğrencilerin ham sayıları — devam (izinli ayrı), üst üste devamsızlık, beklenen/girilmeyen net deneme, son/önceki/son-3 net, son denemede sınıf ortalaması (≥3 sonuç), ders ders net (jsonb), bitirilmiş ödev. Bant ve sıra istemcide hesaplanır. `security definer`: kapsam classes_select''in yönetici dalları + okutan öğretmen (vekillik dahil); kapsam dışı sınıf/öğrenci boş döner; şifre kilidi içeride.';

revoke all on function public.tracking_student_metrics(integer, uuid, uuid) from public, anon;
grant execute on function public.tracking_student_metrics(integer, uuid, uuid) to authenticated;
