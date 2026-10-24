import type { SupabaseClient } from "./deps.ts";
import { syntheticEmailFor } from "./syntheticEmail.ts";
import {
  generateTemporaryPassword,
  temporaryPasswordExpiresAt,
} from "./temporaryPassword.ts";

/**
 * Bir üye hesabını açar: numara tahsisi → auth kullanıcısı → üyelik (kilit ve
 * denetim kaydı üyelikle aynı işlemde). `create-member` ve
 * `create-members-bulk` aynı yolu kullanır (2026-10-23, ana plan 1.8);
 * önceden bu adımlar yalnız `create-member`'ın içindeydi.
 *
 * Sıra zorunlu: giriş numarası sentetik adresin parçasıdır, kişi kodu
 * veritabanında tahsis edilir; üyelik auth kullanıcısına yabancı anahtarla
 * bağlıdır. Üyelik yazılamazsa açılan auth kullanıcısı silinir — kimseye ait
 * olmayan, giriş yapabilen bir hesap kalmamalı.
 *
 * Yetki kararı SQL'dedir (`internal_allocate_member_slot`,
 * `internal_create_membership`); `adminClient` service_role taşıdığı için bu
 * dosyadaki hiçbir kontrol güvenlik sınırı değildir.
 */
export type MemberAccountInput = {
  fullName: string;
  role: "teacher" | "student" | "parent";
  branchId: string | null;
};

export type MemberAccountResult =
  | {
      ok: true;
      loginNumber: string;
      temporaryPassword: string;
      passwordExpiresAt: string;
      membershipId: string;
    }
  | {
      ok: false;
      /** HTTP karşılığı çağıranda: forbidden 403, diğerleri 503/409. */
      error: "forbidden" | "service_unavailable" | "member_create_failed";
    };

const MAX_ALLOCATION_ATTEMPTS = 5;

/** Yeniden denemeden önce kısa, rastgele bekleme: aynı anda çarpışan
 * istekler yine aynı anda tahsis isteyip yine çarpışmasın. */
function collisionBackoff(attempt: number): Promise<void> {
  const ms = 50 * attempt + Math.floor(Math.random() * 150);
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function createMemberAccount(
  adminClient: SupabaseClient,
  callerUserId: string,
  input: MemberAccountInput,
  logPrefix: string
): Promise<MemberAccountResult> {
  const fullName = input.fullName.trim();

  // Aynı anda iki üye açılırsa ikisi aynı kişi kodunu alabilir; ikincinin
  // hesabı aynı sentetik adrese çarpar. Tahsis artık açılmış hesapları da
  // sayıyor (göç 20261121000000), dolayısıyla yeniden tahsis bir sonraki kodu
  // verir. Beş deneme, aralarında rastgele kısa bekleme: yarışı kapatır,
  // gerçek bir arızayı sonsuza kadar döndürmez (ana plan 5.5).
  for (let attempt = 1; attempt <= MAX_ALLOCATION_ATTEMPTS; attempt += 1) {
    const { data: slot, error: slotError } = await adminClient
      .rpc("internal_allocate_member_slot", {
        caller_user_id: callerUserId,
        target_branch_id: input.branchId,
      })
      .maybeSingle<{
        organization_id: string;
        organization_code: number;
        person_code: number;
      }>();
    if (slotError) {
      console.error(`${logPrefix} slot allocation failed`);
      return { ok: false, error: "service_unavailable" };
    }
    if (!slot) return { ok: false, error: "forbidden" };

    const loginNumber = `${slot.organization_code}${slot.person_code}`;
    const temporaryPassword = generateTemporaryPassword();
    const passwordExpiresAt = temporaryPasswordExpiresAt();
    const { data: created, error: createError } =
      await adminClient.auth.admin.createUser({
        email: syntheticEmailFor(loginNumber),
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
    // İki çakışma biçimi ölçüldü (2026-10-25, yerel eşzamanlı dört istek):
    // adres önceden varsa `email_exists`; istekler aynı anda gelirse GoTrue'nun
    // kendi içindeki yarış benzersiz indekse takılır ve kodsuz bir 500 döner.
    // İkisinde de hesap AÇILMAMIŞTIR; yeni tahsis bir sonraki kodu verir.
    const collided =
      createError?.code === "email_exists" || (createError?.status ?? 0) >= 500;
    if (collided && attempt < MAX_ALLOCATION_ATTEMPTS) {
      console.warn(`${logPrefix} person code collision, retrying`);
      await collisionBackoff(attempt);
      continue;
    }
    if (createError || !created.user) {
      console.error(`${logPrefix} auth user creation failed`);
      return { ok: false, error: "member_create_failed" };
    }

    const { data: membershipId, error: membershipError } =
      await adminClient.rpc("internal_create_membership", {
        caller_user_id: callerUserId,
        member_user_id: created.user.id,
        organization_id: slot.organization_id,
        branch_id: input.branchId,
        person_code: slot.person_code,
        member_role: input.role,
        member_full_name: fullName,
        login_number: loginNumber,
        // v1.2-16: kilit bu RPC'nin işleminde yazılır; ayrı bir UPDATE
        // başarısız olunca üye geçici şifresiyle süresiz kalıyordu.
        password_expires_at: passwordExpiresAt,
      });
    if (membershipError || typeof membershipId !== "string") {
      const { error: cleanupError } = await adminClient.auth.admin.deleteUser(
        created.user.id
      );
      if (cleanupError) console.error(`${logPrefix} auth user cleanup failed`);
      // Kişi kodunun benzersiz indeksi (23505): aynı kodu başka bir istek
      // üyeliğe yazdı. Hesap silindi; yeni kodla yeniden denenir.
      if (
        membershipError?.code === "23505" &&
        attempt < MAX_ALLOCATION_ATTEMPTS
      ) {
        console.warn(`${logPrefix} person code collision, retrying`);
        await collisionBackoff(attempt);
        continue;
      }
      console.error(`${logPrefix} membership creation failed`);
      return { ok: false, error: "member_create_failed" };
    }

    return {
      ok: true,
      loginNumber,
      temporaryPassword,
      passwordExpiresAt,
      membershipId,
    };
  }

  return { ok: false, error: "member_create_failed" };
}
