import { createClient, z } from "../_shared/deps.ts";
import {
  isAllowedOrigin,
  jsonResponse,
  preflightResponse,
} from "../_shared/http.ts";
import {
  beginFunctionCall,
  finishFunctionCall,
  idempotencyKeyFrom,
} from "../_shared/requestGuard.ts";

/**
 * Kurum yöneticisi, kendi kurumundaki bir üyeyi kurumdan çıkarır (v1.4-07).
 *
 * **Çıkarma DELETE değildir ve olamaz.** Ölçüldü: üyeliğe bakan sekiz yabancı
 * anahtarın sekizi de `RESTRICT` — bir kez yoklama almış, ödev vermiş veya
 * rehber olmuş üyelik fiziksel olarak silinemiyor. Bu doğru: yoklamayı kimin
 * aldığını silmek defteri bozar. Çıkarma `status = 'suspended'` yazar.
 *
 * ⚠️ **Ve çıkarma role göre farklı iş yapar.** Ölçüldü: öğrenci ve velinin
 * kapsamı üyelikten değil **bağdan** gelir (`students.auth_user_id` /
 * `guardians.auth_user_id`); beş kapsam yardımcısı `status` süzmüyor.
 * Dolayısıyla onlarda erişimi fiilen kesen tek şey **bağın koparılması** ve
 * `internal_remove_member` onu da yapıyor.
 *
 * Yanıt hangi kaydın koptuğunu söylüyor — **ekranın bunu kullanıcıya söylemesi
 * gerekiyor.** Yoksa yönetici bir öğrenciyi çıkarır ve akademik kaydının
 * hesaptan koptuğunu bilmez.
 */

const requestSchema = z.object({
  membershipId: z.string().uuid(),
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

  let input: z.infer<typeof requestSchema>;
  try {
    input = requestSchema.parse(await request.json());
  } catch {
    return jsonResponse({ error: "invalid_input" }, 400, origin);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const guard = await beginFunctionCall(
    adminClient,
    "remove-member",
    userData.user.id,
    idempotencyKeyFrom(request),
    "[remove-member]"
  );

  if (guard.kind === "replay") {
    return jsonResponse(
      { data: { replayed: true, ...(guard.outcome ?? {}) } },
      200,
      origin
    );
  }

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
    return jsonResponse({ error: "service_unavailable" }, 503, origin);
  }

  const { data: outcome, error: removeError } = await adminClient
    .rpc("internal_remove_member", {
      caller_user_id: userData.user.id,
      target_membership_id: input.membershipId,
    })
    .single<{
      role: string;
      unlinked_student_id: string | null;
      unlinked_guardian_id: string | null;
    }>();

  if (removeError) {
    // Kodlar yutulmuyor. `ORB04` "zaten çıkarılmış" demek ve v1.2-17'nin
    // zemin kaydı bunu işaret ediyordu: tekrarlanan istek arayüzde bir hata
    // gibi görünüyor, oysa hedeflenen durum **zaten sağlanmıştır**. Ekran bunu
    // kırmızı bir kutu değil, nötr bir bilgi olarak göstermeli.
    // `ORB06` v1.4-08'de eklendi: son yöneticiyi çıkarmak reddediliyor.
    // `ORB04` gibi 409'a düşüyor ama anlamı farklı — biri "zaten olmuş",
    // diğeri "bu haliyle olamaz".
    const code = removeError.code ?? "unknown";
    const status = code === "42501" ? 403 : code === "23503" ? 404 : 409;

    await finishFunctionCall(
      adminClient,
      guard.callId,
      { removed: false, code },
      "[remove-member]"
    );

    return jsonResponse(
      {
        error: "removal_refused",
        code,
        detail: removeError.details ?? null,
        hint: removeError.hint ?? null,
      },
      status,
      origin
    );
  }

  await finishFunctionCall(
    adminClient,
    guard.callId,
    { removed: true },
    "[remove-member]"
  );

  return jsonResponse(
    {
      data: {
        removed: true,
        role: outcome.role,
        // Ekran bunları **söylemek zorunda**: çıkarma role göre farklı iş
        // yaptı ve yönetici neyin koptuğunu bilmeli.
        unlinked_student_id: outcome.unlinked_student_id,
        unlinked_guardian_id: outcome.unlinked_guardian_id,
      },
    },
    200,
    origin
  );
});
