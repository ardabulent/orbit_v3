import { createClient, z } from "../_shared/deps.ts";
import {
  beginFunctionCall,
  finishFunctionCall,
} from "../_shared/requestGuard.ts";
import {
  isAllowedOrigin,
  jsonResponse,
  preflightResponse,
} from "../_shared/http.ts";

/**
 * Kurumu ve ona bağlı her şeyi siler. **Geri alınamaz.**
 *
 * İki katmanlı doğrulama var ve ikisi de bilinçli:
 *
 * 1. Çağıran platform operatörü olmalı.
 * 2. İstek, silinecek kurumun **adını birebir** taşımalı. Yalnızca kimlik
 *    gönderilseydi, listede yanlış satıra tıklamak sessizce yanlış kurumu
 *    silerdi. Ad eşleşmesi işlemin kazayla yapılmasını zorlaştırıyor.
 */

const requestSchema = z.object({
  organizationId: z.string().uuid(),
  confirmName: z.string().trim().min(1).max(120),
});

Deno.serve(async request => {
  const origin = request.headers.get("origin");

  if (!isAllowedOrigin(origin)) {
    return jsonResponse({ error: "origin_not_allowed" }, 403, null);
  }

  if (request.method === "OPTIONS") {
    return preflightResponse(origin);
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: "service_unavailable" }, 503, origin);
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse({ error: "unauthorized" }, 401, origin);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(
    authorization.slice("Bearer ".length)
  );

  if (userError || !userData.user) {
    return jsonResponse({ error: "forbidden" }, 403, origin);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Bu fonksiyon idempotency anahtarı ALMIYOR ve buna ihtiyacı yok:
  // ikinci silme kurumu bulamıyor, işlem doğal olarak idempotent.
  // Hız sınırına ise dahil — kaçak bir döngü yine durdurulmalı.
  const guard = await beginFunctionCall(
    adminClient,
    "delete-organization",
    userData.user.id,
    null,
    "[delete-organization]"
  );

  if (guard.kind === "password_locked") {
    // Kilitli çağıran (geçici ya da süresi dolmuş şifre) hiçbir işi

    // yaptıramaz; önce şifresini değiştirmeli (v1.5-20, K-25).

    return jsonResponse({ error: "password_change_required" }, 403, origin);
  }

  if (guard.kind === "in_progress") {
    return jsonResponse({ error: "request_in_progress" }, 409, origin);
  }

  if (guard.kind === "rate_limited") {
    return jsonResponse(
      { error: "rate_limited", limit: guard.limit },
      429,
      origin
    );
  }

  if (guard.kind !== "proceed") {
    // Koruma çalışmıyorken korunan işi yapmak, korumayı hiç yazmamakla aynı
    // şey (K-04).
    return jsonResponse({ error: "service_unavailable" }, 503, origin);
  }

  const { data: operator, error: operatorError } = await adminClient
    .from("platform_operators")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .eq("status", "active")
    .maybeSingle();

  if (operatorError) {
    console.error("[delete-organization] operator lookup failed");
    return jsonResponse({ error: "service_unavailable" }, 503, origin);
  }

  if (!operator) {
    return jsonResponse({ error: "forbidden" }, 403, origin);
  }

  let input: z.infer<typeof requestSchema>;
  try {
    input = requestSchema.parse(await request.json());
  } catch {
    return jsonResponse({ error: "invalid_request" }, 400, origin);
  }

  const { data: organization, error: organizationError } = await adminClient
    .from("organizations")
    .select("name")
    .eq("id", input.organizationId)
    .maybeSingle();

  if (organizationError || !organization) {
    return jsonResponse({ error: "organization_not_found" }, 404, origin);
  }

  // Ad eşleşmesi sunucuda da doğrulanıyor. Yalnızca istemcide kontrol etseydik,
  // doğrudan API çağrısı yapan biri onayı atlardı.
  if (organization.name.trim() !== input.confirmName.trim()) {
    return jsonResponse({ error: "confirmation_mismatch" }, 400, origin);
  }

  // Veritabanı tarafı tek işlemde çalışıyor: denetim kaydı yazılıyor, sonra
  // bağlı kayıtlar doğru sırada siliniyor. Sıra RESTRICT kısıtları yüzünden
  // zorunlu; ayrıntı migration dosyasında.
  const { data: result, error: deleteError } = await adminClient.rpc(
    "internal_delete_organization",
    {
      target_organization_id: input.organizationId,
      actor_user_id: userData.user.id,
    }
  );

  if (deleteError) {
    // `ORB01`, kurumda içerik olduğu için reddedilen silmedir (Issue #150) —
    // bir arıza değil, korumanın çalışması. Diğer hatalardan ayırt edilmesi
    // gerekiyor çünkü operatörün yapacağı şey tamamen farklı: "tekrar deneyin"
    // burada yanlış tavsiyedir, kayıtlar durdukça her deneme reddedilir.
    if (deleteError.code === "ORB01") {
      // Engelleyen tablo/satır listesi `detail` alanında JSON olarak geliyor.
      // Ayrıştırılamazsa reddin kendisi yine de bildirilir; gerekçeyi
      // gösterememek, silmeye izin vermek için sebep değildir.
      let blocking: unknown = null;
      try {
        blocking = JSON.parse(deleteError.details ?? "null");
      } catch {
        console.error("[delete-organization] refusal detail was not JSON");
      }

      // Reddin kaydı BURADA yazılıyor, veritabanında değil: exception işlemi
      // geri sardığı için fonksiyonun içinden yazılan hiçbir satır kalmazdı.
      //
      // Neden hiç yazılıyor: bu, geri alınamaz bir veri kaybına kıl payı
      // kalmış bir denemedir. İz bırakmazsa, dolu bir kurumu silmeye çalışan
      // birinin bunu yaptığı hiçbir yerde görünmez.
      const { error: auditError } = await adminClient
        .from("platform_audit_events")
        .insert({
          actor_user_id: userData.user.id,
          action: "platform.organization_delete_refused",
          entity_type: "organization",
          entity_id: input.organizationId,
          organization_id: input.organizationId,
          metadata: {
            organization_name: organization.name,
            blocking_content: blocking,
          },
        });

      if (auditError) {
        console.error("[delete-organization] refusal audit write failed");
      }

      return jsonResponse(
        { error: "organization_not_empty", blocking_content: blocking },
        409,
        origin
      );
    }

    console.error("[delete-organization] delete failed");
    return jsonResponse({ error: "organization_delete_failed" }, 409, origin);
  }

  // Auth kullanıcıları en SONA bırakıldı. Önce silinselerdi ve veritabanı adımı
  // başarısız olsaydı, kurum üyesiz kalırdı — kimsenin giremediği bir kurum.
  // Bu sıradaki olası hata ise kuruma ait olmayan artık hesaplar bırakır; onlar
  // üyeliksiz oldukları için giriş yapsalar bile anında dışarı atılır.
  //
  // `member_user_ids` yalnızca kimliği başka hiçbir yerden talep edilmeyen
  // üyeleri içerir. Platform operatörlüğü veya başka bir kurumda üyeliği
  // olanlar `protected_user_ids` altında dönüyor ve auth hesaplarına
  // dokunulmuyor.
  //
  // Ayrım olmadığında, tek bir kuruma kapsamlanmış bu işlem küresel bir eylem
  // yapıyordu: kişinin kimliğini siliyordu. Operatörlük de `on delete cascade`
  // ile birlikte gidiyordu (Issue #63).
  const memberIds = ((result as { member_user_ids?: unknown } | null)
    ?.member_user_ids ?? []) as string[];
  const protectedIds = ((result as { protected_user_ids?: unknown } | null)
    ?.protected_user_ids ?? []) as string[];

  let orphaned = 0;

  for (const memberId of memberIds) {
    const { error } = await adminClient.auth.admin.deleteUser(memberId);
    if (error) {
      orphaned += 1;
      console.error("[delete-organization] user cleanup failed");
    }
  }

  await finishFunctionCall(
    adminClient,
    guard.callId,
    { completed: true },
    "[delete-organization]"
  );

  return jsonResponse(
    {
      data: {
        ...(result as Record<string, unknown>),
        orphaned_users: orphaned,
        protected_identity_count: protectedIds.length,
      },
    },
    200,
    origin
  );
});
