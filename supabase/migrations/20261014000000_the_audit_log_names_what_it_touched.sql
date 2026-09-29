-- Denetim kaydı neye dokunduğunu adıyla söyler.
--
-- Denetim Kaydı ekranı (karar 2026-09-29, Arda Bülent):
--
--   * Her satırda etkilenen kaydın ADI ve güncellemede DEĞİŞEN ALANLARIN
--     adları görünür ("Öğrenci · Selin Koç — Telefon değişti"). Değerlerin
--     kendisi gösterilmez.
--   * Süzgeç: kim yaptı, işlem türü, kayıt türü, tarih aralığı.
--   * Eski değer saklanmaz (tetikleyici değişmez); dışa aktarma yok.
--
-- Neden bir fonksiyon: `audit_events.metadata` izlenen alanların DEĞERLERİNİ
-- taşır — velinin telefonu, öğrenci numarası, giriş numarası dahil. İstemci
-- satırı olduğu gibi okusaydı bu değerler ekranda gösterilmese bile tarayıcıya
-- inerdi. Bu fonksiyon `metadata`'yı hiç döndürmez: yalnız sunucuda kurulmuş
-- bir AD (`label`) ve değişen alanların ADLARINI (`changed`) döndürür.
--
-- Ad nasıl kurulur: kayıt türüne göre metadata'daki ad/başlık ya da
-- metadata'daki kimliklerden (öğrenci, sınıf, sınav, ödev, plan) okunan ad.
-- Adlar da RLS'ten geçer (`security invoker`): yöneticinin göremediği bir
-- adı fonksiyon da göremez. Ad kurulamazsa `label` boştur — uydurulmaz (K-03).
--
-- Yetki: `security invoker`; `audit_events_select_admin` yalnız kurum
-- yöneticisine satır verir. Öğretmen, öğrenci, veli boş küme alır.
--
-- Kurum kimliği zorunlu bir parametre: kapsamı RLS çizer, parametre yalnız
-- dizinin kullanılması içindir (aşağıdaki not).
--
-- Sayfalama anahtar kümesiyle (`p_before_id`): kayıtlar büyüdükçe `offset`
-- yavaşlar, `id < son görülen` yavaşlamaz.

create function public.organization_audit_feed(
  p_organization_id uuid,
  p_limit integer default 50,
  p_before_id bigint default null,
  p_actor_user_id uuid default null,
  p_action_kind text default null,
  p_entity_type text default null,
  p_from date default null,
  p_to date default null
)
returns table (
  id bigint,
  created_at timestamptz,
  actor_user_id uuid,
  action text,
  entity_type text,
  entity_id uuid,
  label text,
  changed text[]
)
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 200 then
    raise exception 'Sayfa boyu 1 ile 200 arasında olmalı'
      using errcode = '22023';
  end if;
  if p_action_kind is not null
     and p_action_kind not in ('created', 'updated', 'archived', 'restored', 'other') then
    raise exception 'Bilinmeyen işlem türü: %', p_action_kind
      using errcode = '22023';
  end if;

  return query
  select
    kayit.id,
    kayit.created_at,
    kayit.actor_user_id,
    kayit.action,
    kayit.entity_type,
    kayit.entity_id,
    nullif(
      case kayit.entity_type
        when 'student' then kayit.metadata ->> 'full_name'
        when 'guardian' then kayit.metadata ->> 'full_name'
        when 'class' then kayit.metadata ->> 'name'
        when 'subject' then kayit.metadata ->> 'name'
        when 'branch' then kayit.metadata ->> 'name'
        when 'exam' then kayit.metadata ->> 'name'
        when 'feed_post' then kayit.metadata ->> 'title'
        when 'homework' then kayit.metadata ->> 'title'
        when 'payment_plan' then concat_ws(' · ', ad.ogrenci, kayit.metadata ->> 'name')
        when 'exam_section' then concat_ws(' · ', ad.sinav, kayit.metadata ->> 'name')
        when 'installment' then concat_ws(' · ', ad.plan,
          (kayit.metadata ->> 'sequence_no') || '. taksit')
        when 'attendance_session' then concat_ws(' · ', ad.sinif,
          to_char((kayit.metadata ->> 'session_date')::date, 'DD.MM.YYYY'))
        when 'substitute_assignment' then concat_ws(' · ',
          ad.gelmeyen || ' yerine ' || ad.vekil,
          concat_ws(' – ',
            to_char((kayit.metadata ->> 'starts_on')::date, 'DD.MM.YYYY'),
            to_char((kayit.metadata ->> 'ends_on')::date, 'DD.MM.YYYY')))
        when 'schedule_entry' then concat_ws(' · ', ad.sinif, ad.ders, ad.ogretmen)
        when 'class_teacher' then concat_ws(' · ', ad.sinif, ad.ders, ad.ogretmen)
        when 'student_guardian' then concat_ws(' · ', ad.ogrenci, ad.veli)
        when 'homework_submission' then concat_ws(' · ', ad.ogrenci, ad.odev)
        when 'exam_section_result' then concat_ws(' · ', ad.ogrenci, ad.bolum_sinavi)
        else concat_ws(' · ', ad.ogrenci, coalesce(ad.sinav, ad.sinif), ad.ders)
      end,
      ''
    ),
    array(
      select jsonb_array_elements_text(kayit.metadata -> 'changed')
    )
  from public.audit_events as kayit
  cross join lateral (
    select
      (select o.full_name from public.students as o
        where o.id = (kayit.metadata ->> 'student_id')::uuid) as ogrenci,
      (select v.full_name from public.guardians as v
        where v.id = (kayit.metadata ->> 'guardian_id')::uuid) as veli,
      (select s.name from public.classes as s
        where s.id = (kayit.metadata ->> 'class_id')::uuid) as sinif,
      (select d.name from public.subjects as d
        where d.id = (kayit.metadata ->> 'subject_id')::uuid) as ders,
      (select e.name from public.exams as e
        where e.id = (kayit.metadata ->> 'exam_id')::uuid) as sinav,
      (select h.title from public.homework_assignments as h
        where h.id = (kayit.metadata ->> 'homework_id')::uuid) as odev,
      (select p.name from public.payment_plans as p
        where p.id = (kayit.metadata ->> 'plan_id')::uuid) as plan,
      (select e.name || ' · ' || b.name
         from public.exam_sections as b
         join public.exams as e on e.id = b.exam_id
        where b.id = (kayit.metadata ->> 'section_id')::uuid) as bolum_sinavi,
      (select pr.display_name
         from public.organization_memberships as m
         join public.profiles as pr on pr.id = m.user_id
        where m.id = (kayit.metadata ->> 'membership_id')::uuid) as ogretmen,
      (select pr.display_name
         from public.organization_memberships as m
         join public.profiles as pr on pr.id = m.user_id
        where m.id = (kayit.metadata ->> 'absent_membership_id')::uuid) as gelmeyen,
      (select pr.display_name
         from public.organization_memberships as m
         join public.profiles as pr on pr.id = m.user_id
        where m.id = (kayit.metadata ->> 'substitute_membership_id')::uuid) as vekil
  ) as ad
  -- Kurum koşulu güvenlik için değil DİZİN için: kapsam RLS'ten gelir, ama
  -- RLS koşulu bir fonksiyon çağrısı ve planlayıcı onu
  -- `audit_events_org_id_desc_idx` koşuluna çeviremiyor (2026-09-09'da
  -- ölçüldü, `loadOrganizationAuditEvents` başlığı).
  where kayit.organization_id = p_organization_id
    and (p_before_id is null or kayit.id < p_before_id)
    and (p_actor_user_id is null or kayit.actor_user_id = p_actor_user_id)
    and (p_entity_type is null or kayit.entity_type = p_entity_type)
    and (
      p_action_kind is null
      or (p_action_kind = 'other'
          and kayit.action !~ '\.(created|updated|archived|restored)$')
      or kayit.action like '%.' || p_action_kind
    )
    and (p_from is null
         or (kayit.created_at at time zone 'Europe/Istanbul')::date >= p_from)
    and (p_to is null
         or (kayit.created_at at time zone 'Europe/Istanbul')::date <= p_to)
  order by kayit.id desc
  limit p_limit;
end;
$$;

comment on function public.organization_audit_feed(uuid, integer, bigint, uuid, text, text, date, date) is
  'Denetim Kaydı ekranı: süzülmüş (kim, işlem türü, kayıt türü, İstanbul tarihine göre aralık) ve anahtar kümesiyle sayfalanmış kayıtlar. `metadata` DÖNMEZ — yalnız sunucuda kurulan ad (`label`, kurulamazsa NULL) ve güncellemede değişen alanların adları (`changed`). Değerler (telefon, numara vb.) istemciye inmez. `security invoker`: yalnız kurum yöneticisi satır alır (audit_events_select_admin); adlar da RLS''ten geçer.';

revoke all on function public.organization_audit_feed(uuid, integer, bigint, uuid, text, text, date, date) from public, anon;
grant execute on function public.organization_audit_feed(uuid, integer, bigint, uuid, text, text, date, date) to authenticated;
