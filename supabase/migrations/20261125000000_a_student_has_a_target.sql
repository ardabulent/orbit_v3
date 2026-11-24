-- Takip sekmesi, 2. dilim: hedef net (ana plan 4.10b, karar 2026-11-24).
--
-- Öğrencinin toplam ve isteğe bağlı ders ders hedef neti. Takip'te "hedefe
-- uzaklık" ölçütü bunu kullanır; öğrenci ve veli hedefi kendi sınav
-- ekranında görür ama değiştiremez.
--
-- Kim:
--   okur   — öğrenciyi görebilen herkes: yönetici (şube kapsamıyla), okutan
--            öğretmen, öğrencinin kendisi, velisi. Kural `students`'ın okuma
--            kuralına dayanır (alt sorgu RLS ile süzülür); ikinci bir yetki
--            mantığı yazılmaz, ikisi birbirinden ayrışamaz.
--   yazar  — yönetici (`students_select`'in üç yönetici dalı) ve öğrenciyi
--            okutan öğretmen (vekillik dahil).
--
-- Kaldırma silme değil, değeri boşaltmaktır: satır kalır, `audit_row_change`
-- "updated" izi düşer. Silme yetkisi verilmez.
--
-- Bilinen sınır: sınav türü (TYT/AYT) alanı yok; toplam hedef her denemenin
-- toplamıyla karşılaştırılır. Ekran bunu söyler; ders hedefi etkilenmez.

create table public.student_targets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  student_id uuid not null,
  -- Boş = toplam hedef.
  subject_id uuid,
  -- Boş = hedef kaldırıldı.
  target_net numeric(6, 2),
  -- İstemci yazamaz; tetikleyici çağıranın üyeliğinden doldurur.
  set_by_membership_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_targets_student_subject_key
    unique nulls not distinct (student_id, subject_id),
  constraint student_targets_target_net_check
    check (target_net is null or target_net between 0 and 200),
  constraint student_targets_student_organization_fkey
    foreign key (student_id, organization_id)
    references public.students (id, organization_id) on delete restrict,
  constraint student_targets_subject_organization_fkey
    foreign key (subject_id, organization_id)
    references public.subjects (id, organization_id) on delete restrict,
  constraint student_targets_setter_organization_fkey
    foreign key (set_by_membership_id, organization_id)
    references public.organization_memberships (id, organization_id) on delete restrict
);

comment on table public.student_targets is
  'Öğrencinin hedef neti: subject_id boşsa toplam, doluysa ders. target_net boşsa hedef kaldırılmıştır (satır silinmez, iz kalır). Öğrenciyi gören okur; yönetici ve okutan öğretmen yazar.';

create index student_targets_subject_idx on public.student_targets (subject_id);
create index student_targets_setter_idx on public.student_targets (set_by_membership_id);
create index student_targets_organization_idx on public.student_targets (organization_id);

create trigger student_targets_set_updated_at
before update on public.student_targets
for each row execute function public.set_updated_at();

-- "Son değiştiren" her yazıda çağırandan alınır; istemcinin değeri ezilir.
create function public.fill_student_target_setter()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    select uyelik.id
    into new.set_by_membership_id
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

comment on function public.fill_student_target_setter() is
  'student_targets.set_by_membership_id alanını çağıranın aktif üyeliğiyle doldurur; istemcinin verdiği değeri ezer.';

revoke all on function public.fill_student_target_setter()
  from public, anon, authenticated;

create trigger student_targets_fill_setter
before insert or update on public.student_targets
for each row execute function public.fill_student_target_setter();

alter table public.student_targets enable row level security;

revoke all on public.student_targets from anon, authenticated;
grant select on public.student_targets to authenticated;
grant insert (organization_id, student_id, subject_id, target_net)
  on public.student_targets to authenticated;
-- Dört sütun da güncellenebilir: istemci tek `upsert` atar ve PostgREST
-- çakışmada gönderilen bütün sütunları `do update set` eder. Kapsamı
-- güncelleme kuralının `with check`'i korur.
grant update (organization_id, student_id, subject_id, target_net)
  on public.student_targets to authenticated;

create policy student_targets_select
  on public.student_targets
  for select to authenticated
  using (
    not (select public.current_user_must_change_password())
    -- Öğrenciyi gören hedefi de görür: bağımsız alt sorgu, `students`
    -- okuma kuralıyla süzülür ve sorgu başına bir kez hesaplanır.
    and student_id in (select ogrenci.id from public.students as ogrenci)
  );

create policy student_targets_insert_staff
  on public.student_targets
  for insert to authenticated
  with check (
    not (select public.current_user_must_change_password())
    and (
      student_id = any ((select public.current_user_taught_student_ids())::uuid[])
      or exists (
        select 1
        from public.students as ogrenci
        where ogrenci.id = student_targets.student_id
          and ogrenci.organization_id = student_targets.organization_id
          and (
            ogrenci.organization_id = any ((select public.current_user_full_admin_org_ids())::uuid[])
            or (ogrenci.branch_id is null
                and ogrenci.organization_id = any ((select public.current_user_admin_org_ids())::uuid[]))
            or ogrenci.branch_id = any ((select public.current_user_admin_branch_ids())::uuid[])
          )
      )
    )
  );

create policy student_targets_update_staff
  on public.student_targets
  for update to authenticated
  using (
    not (select public.current_user_must_change_password())
    and (
      student_id = any ((select public.current_user_taught_student_ids())::uuid[])
      or exists (
        select 1
        from public.students as ogrenci
        where ogrenci.id = student_targets.student_id
          and (
            ogrenci.organization_id = any ((select public.current_user_full_admin_org_ids())::uuid[])
            or (ogrenci.branch_id is null
                and ogrenci.organization_id = any ((select public.current_user_admin_org_ids())::uuid[]))
            or ogrenci.branch_id = any ((select public.current_user_admin_branch_ids())::uuid[])
          )
      )
    )
  )
  with check (
    not (select public.current_user_must_change_password())
    and (
      student_id = any ((select public.current_user_taught_student_ids())::uuid[])
      or exists (
        select 1
        from public.students as ogrenci
        where ogrenci.id = student_targets.student_id
          and ogrenci.organization_id = student_targets.organization_id
          and (
            ogrenci.organization_id = any ((select public.current_user_full_admin_org_ids())::uuid[])
            or (ogrenci.branch_id is null
                and ogrenci.organization_id = any ((select public.current_user_admin_org_ids())::uuid[]))
            or ogrenci.branch_id = any ((select public.current_user_admin_branch_ids())::uuid[])
          )
      )
    )
  );

create trigger student_targets_audit_insert
  after insert on public.student_targets
  for each row execute function public.audit_row_change(
    'student_target', 'student_id', 'subject_id', 'target_net'
  );

create trigger student_targets_audit_update
  after update on public.student_targets
  for each row execute function public.audit_row_change(
    'student_target', 'student_id', 'subject_id', 'target_net'
  );

-- =========================================================================
-- tracking_student_metrics: hedefler eklenir
-- =========================================================================
--
-- Gövde 20261124000000 ile birebir aynı; yalnız `hedef` CTE'si ve `targets`
-- sütunu eklendi. Dönüş tipi değiştiği için fonksiyon yeniden kurulur.

drop function public.tracking_student_metrics(integer, uuid, uuid);

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
  homework_submitted bigint,
  targets jsonb
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
  ),
  -- Hedef net (4.10b) -------------------------------------------------------
  -- Değeri boş satır "hedef kaldırıldı" demektir ve listeye girmez.
  hedef as (
    select
      h.student_id as ogrenci_id,
      jsonb_agg(
        jsonb_build_object('subject_id', h.subject_id, 'target_net', h.target_net)
        order by h.subject_id nulls first
      ) as hedefler
    from public.student_targets as h
    where h.target_net is not null
      and h.student_id in (select distinct ogrenci_id from kayitli)
    group by h.student_id
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
    coalesce(odev.teslim, 0),
    coalesce(hedef.hedefler, '[]'::jsonb)
  from ogrenci
  left join devam on devam.ogrenci_id = ogrenci.id
  left join seri on seri.ogrenci_id = ogrenci.id
  left join net_ozet on net_ozet.ogrenci_id = ogrenci.id
  left join beklenen on beklenen.ogrenci_id = ogrenci.id
  left join girmedi on girmedi.ogrenci_id = ogrenci.id
  left join sinif_ortalamasi on sinif_ortalamasi.ogrenci_id = ogrenci.id
  left join ders_json on ders_json.ogrenci_id = ogrenci.id
  left join odev on odev.ogrenci_id = ogrenci.id
  left join hedef on hedef.ogrenci_id = ogrenci.id
  order by ogrenci.full_name, ogrenci.id;
end;
$$;

comment on function public.tracking_student_metrics(integer, uuid, uuid) is
  'Takip sekmesi: son p_weeks (1..26) takvim haftasında görünür öğrencilerin ham sayıları — devam (izinli ayrı), üst üste devamsızlık, beklenen/girilmeyen net deneme, son/önceki/son-3 net, son denemede sınıf ortalaması (≥3 sonuç), ders ders net (jsonb), bitirilmiş ödev, hedef net (targets: toplam için subject_id boş). Bant ve sıra istemcide hesaplanır. `security definer`: kapsam classes_select''in yönetici dalları + okutan öğretmen (vekillik dahil); kapsam dışı sınıf/öğrenci boş döner; şifre kilidi içeride.';

revoke all on function public.tracking_student_metrics(integer, uuid, uuid) from public, anon;
grant execute on function public.tracking_student_metrics(integer, uuid, uuid) to authenticated;
