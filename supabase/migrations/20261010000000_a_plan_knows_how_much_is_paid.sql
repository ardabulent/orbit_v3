-- Ödeme planı ne kadarının ödendiğini söyler.
--
-- Kayıt ve Ödemeler ekranı (2026-09-29) plan başına "ödenen / kalan" ve
-- ilerleme çubuğu gösteriyor; veli ekranı da taksit sayısını. Bu sayılar
-- istemcide taksit satırları toplanarak ÜRETİLMEZ (K-03: sayım veritabanının
-- işi, `payment_plan_summaries` başlığı). Fonksiyon dört sütun daha döndürür:
--
--   installment_count  arşivlenmemiş taksit sayısı
--   paid_count         bunlardan ödenmiş olanlar
--   scheduled_amount   arşivlenmemiş taksitlerin toplamı (taksite bölünen)
--   paid_amount        ödenmiş taksitlerin toplamı
--
-- `scheduled_amount` planın `total_amount`'undan farklı olabilir (taksitler
-- henüz tamamen girilmemiş ya da bir taksit arşivlenmiş); ekran ikisini
-- birlikte gösterir, birini ötekinden uydurmaz.
--
-- Dönüş tipi değiştiği için fonksiyon düşürülüp yeniden kuruluyor. Mevcut
-- dört sütun ve anlamları aynen korunur. `security definer` DEĞİLDİR: veli
-- yalnız çocuğunun planını görür (RLS).

drop function public.payment_plan_summaries(uuid[]);

create function public.payment_plan_summaries(
  target_plan_ids uuid[]
)
returns table (
  plan_id uuid,
  overdue_count bigint,
  next_due_date date,
  next_due_amount numeric,
  installment_count bigint,
  paid_count bigint,
  scheduled_amount numeric,
  paid_amount numeric
)
language sql
stable
set search_path = ''
as $$
  select
    plan.id as plan_id,
    count(installment.id) filter (
      where installment.paid_at is null
        and installment.archived_at is null
        and installment.due_date < public.orbit_today()
    ) as overdue_count,
    min(installment.due_date) filter (
      where installment.paid_at is null
        and installment.archived_at is null
    ) as next_due_date,
    (
      array_agg(installment.amount order by installment.due_date, installment.sequence_no)
      filter (where installment.paid_at is null and installment.archived_at is null)
    )[1] as next_due_amount,
    count(installment.id) filter (
      where installment.archived_at is null
    ) as installment_count,
    count(installment.id) filter (
      where installment.archived_at is null and installment.paid_at is not null
    ) as paid_count,
    coalesce(
      sum(installment.amount) filter (where installment.archived_at is null),
      0
    ) as scheduled_amount,
    coalesce(
      sum(installment.amount) filter (
        where installment.archived_at is null and installment.paid_at is not null
      ),
      0
    ) as paid_amount
  from public.payment_plans as plan
  left join public.installments as installment
    on installment.plan_id = plan.id
  where plan.id = any(target_plan_ids)
    and plan.archived_at is null
  group by plan.id;
$$;

comment on function public.payment_plan_summaries(uuid[]) is
  'Plan başına: vadesi geçmiş ödenmemiş taksit sayısı, ödenmemiş EN ERKEN taksitin tarihi ve tutarı, taksit ve ödenmiş taksit sayısı, taksitlere bölünen toplam ve ödenen toplam. Arşivlenmiş taksit hiçbirine katılmaz. Taksiti hiç olmayan planda tarih ve tutar NULL, sayılar ve toplamlar 0. `security definer` DEĞİLDİR.';

revoke all on function public.payment_plan_summaries(uuid[]) from public, anon;
grant execute on function public.payment_plan_summaries(uuid[]) to authenticated;
