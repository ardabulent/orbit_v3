-- Ödeme planı tek seferde kaydedilir.
--
-- Kullanıcı geri bildirimi (2026-09-30): "ödeme planı ekleme ve taksite
-- bölme işlemi karışık olmuş; tek ekran üzerinden tek yerden yönetebilmemiz
-- lazım." Önceden plan bir pencerede açılıyor, taksitler planın detayında
-- AYRI ayrı ekleniyordu; yarıda bırakılan plan "taksitsiz" kalıyordu.
--
-- `save_payment_plan` planı ve ödenmemiş taksitlerin tamamını TEK işlemde
-- yazar:
--
--   * Yeni plan (`p_plan_id` boş): plan ve taksitleri birlikte açılır.
--   * Var olan plan: ad ve toplam güncellenir; ÖDENMİŞ taksitlere dokunulmaz;
--     ödenmemiş etkin taksitler ARŞİVLENİR (silinmez — denetim izi kalır)
--     ve yeni liste ödenmişlerin ardından sıra numarasıyla yazılır.
--   * Ödenmiş taksitlerin toplamı + yeni taksitlerin toplamı planın toplamına
--     EŞİT olmalı; değilse 22023 ve hiçbir şey yazılmaz. Ekran farkı önceden
--     gösterir; bu kontrol son sözdür.
--   * Öğrenci yeni planda seçilir; var olan planda değişmez (ödenmiş
--     taksitler o öğrencinindir).
--   * En çok 60 taksit; tutar > 0; tarih zorunlu.
--
-- Yetki: `security invoker` — yazmaları `payment_plans_*_admin` ve
-- `installments_*_admin` politikaları süzer; yönetici değilse 42501.
-- Fonksiyon tek bir işlem olduğu için yarım plan kalmaz.

create function public.save_payment_plan(
  p_organization_id uuid,
  p_plan_id uuid,
  p_student_id uuid,
  p_name text,
  p_total_amount numeric,
  p_installments jsonb
)
returns uuid
language plpgsql
volatile
set search_path = ''
as $$
declare
  plan_kimligi uuid := p_plan_id;
  odenmis_toplam numeric := 0;
  yeni_toplam numeric;
  son_sira integer := 0;
  satir record;
begin
  if p_name is null or char_length(btrim(p_name)) not between 1 and 160 then
    raise exception 'Paket adı 1 ile 160 karakter arasında olmalı'
      using errcode = '22023';
  end if;
  if p_total_amount is null or p_total_amount < 0 then
    raise exception 'Toplam tutar sıfır ya da daha büyük olmalı'
      using errcode = '22023';
  end if;
  if p_installments is null or jsonb_typeof(p_installments) <> 'array'
     or jsonb_array_length(p_installments) > 60 then
    raise exception 'Taksit listesi en çok 60 satır olmalı'
      using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_installments) as e(t)
     where (t ->> 'due_date') is null
        or (t ->> 'amount') is null
        or (t ->> 'amount')::numeric <= 0
  ) then
    raise exception 'Her taksitin tarihi ve sıfırdan büyük tutarı olmalı'
      using errcode = '22023';
  end if;

  select coalesce(sum((t ->> 'amount')::numeric), 0)
    into yeni_toplam
    from jsonb_array_elements(p_installments) as e(t);

  if plan_kimligi is null then
    insert into public.payment_plans (organization_id, student_id, name, total_amount)
    values (p_organization_id, p_student_id, btrim(p_name), p_total_amount)
    returning id into plan_kimligi;
  else
    if not exists (
      select 1 from public.payment_plans as p
       where p.id = plan_kimligi
         and p.organization_id = p_organization_id
         and p.archived_at is null
    ) then
      raise exception 'Ödeme planı bulunamadı' using errcode = 'P0002';
    end if;

    select coalesce(sum(t.amount), 0), coalesce(max(t.sequence_no), 0)
      into odenmis_toplam, son_sira
      from public.installments as t
     where t.plan_id = plan_kimligi
       and t.archived_at is null
       and t.paid_at is not null;
  end if;

  if odenmis_toplam + yeni_toplam <> p_total_amount then
    raise exception 'Taksitlerin toplamı (%) paket tutarına (%) eşit değil',
      odenmis_toplam + yeni_toplam, p_total_amount
      using errcode = '22023';
  end if;

  if p_plan_id is not null then
    update public.payment_plans
       set name = btrim(p_name), total_amount = p_total_amount
     where id = plan_kimligi;

    -- Ödenmemiş etkin taksitler arşivlenir: sıra numaraları serbest kalır,
    -- denetim izi korunur. Ödenmişlere dokunulmaz.
    update public.installments
       set archived_at = now()
     where plan_id = plan_kimligi
       and archived_at is null
       and paid_at is null;
  end if;

  for satir in
    select (t ->> 'due_date')::date as vade, (t ->> 'amount')::numeric as tutar, sira
      from jsonb_array_elements(p_installments) with ordinality as e(t, sira)
     order by sira
  loop
    son_sira := son_sira + 1;
    insert into public.installments (organization_id, plan_id, sequence_no, due_date, amount)
    values (p_organization_id, plan_kimligi, son_sira, satir.vade, satir.tutar);
  end loop;

  return plan_kimligi;
end;
$$;

comment on function public.save_payment_plan(uuid, uuid, uuid, text, numeric, jsonb) is
  'Ödeme planını ve ödenmemiş taksitlerinin tamamını tek işlemde yazar (2026-09-30). Yeni plan: plan + taksitler. Var olan plan: ad/toplam güncellenir, ödenmiş taksitlere dokunulmaz, ödenmemiş etkinler arşivlenir ve yeni liste ödenmişlerin ardından yazılır. Ödenmiş + yeni toplam = paket tutarı olmalı, değilse 22023 ve hiçbir şey yazılmaz. security invoker: yönetici politikaları süzer.';

revoke all on function public.save_payment_plan(uuid, uuid, uuid, text, numeric, jsonb) from public, anon;
grant execute on function public.save_payment_plan(uuid, uuid, uuid, text, numeric, jsonb) to authenticated;
