import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Ctx = { supabase: SupabaseClient<Database>; userId: string };

const textChangesSchema = z.object({
  language: z.enum(["en", "ar"]),
  changes: z.record(z.string().min(1), z.string().max(20_000)),
});

const imageSchema = z.object({
  slot: z.string().regex(/^[a-z0-9-]+$/).max(160),
  storagePath: z.string().min(1).max(500),
  mimeType: z.string().regex(/^image\//).max(100),
});

async function assertAdmin(context: Ctx) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || data !== true) throw new Error("Admin access required");
}

export const getAdminStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) throw new Error(error.message);
    const { data: configured } = await context.supabase.rpc("is_admin_configured");
    return { isAdmin: isAdmin === true, canClaim: configured !== true };
  });

export const claimFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("claim_first_admin");
    if (error || data !== true) throw new Error(error?.message ?? "Admin setup is unavailable");
    return { ok: true };
  });

export const publishTextChanges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => textChangesSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as Ctx);
    const rows = Object.entries(data.changes).map(([content_key, value]) => ({
      language: data.language,
      content_key,
      value,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    }));
    if (rows.length) {
      const { error } = await context.supabase
        .from("site_text_overrides")
        .upsert(rows, { onConflict: "language,content_key" });
      if (error) throw new Error(error.message);
    }
    await bumpVersion(context as unknown as Ctx);
    return { ok: true };
  });

export const publishImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => imageSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as Ctx);
    const { error } = await context.supabase.from("site_image_overrides").upsert({
      slot: data.slot,
      storage_path: data.storagePath,
      mime_type: data.mimeType,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    await bumpVersion(context as unknown as Ctx);
    return { ok: true };
  });

export const resetPublishedContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as unknown as Ctx);
    const textDelete = await context.supabase.from("site_text_overrides").delete().neq("content_key", "");
    if (textDelete.error) throw new Error(textDelete.error.message);
    const imageDelete = await context.supabase.from("site_image_overrides").delete().neq("slot", "");
    if (imageDelete.error) throw new Error(imageDelete.error.message);
    await bumpVersion(context as unknown as Ctx);
    return { ok: true };
  });

async function bumpVersion(context: Ctx) {
  const { data } = await context.supabase
    .from("site_publication")
    .select("version")
    .eq("id", true)
    .maybeSingle();
  const { error } = await context.supabase.from("site_publication").upsert({
    id: true,
    version: (data?.version ?? 0) + 1,
    published_at: new Date().toISOString(),
    published_by: context.userId,
  });
  if (error) throw new Error(error.message);
  const { invalidateContentCache } = await import("./server");
  invalidateContentCache();
}
const DEFAULT_ADMIN = { username: "admin", password: "admin123" };
export const usernameToEmail = (u: string) => `${u.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "")}@admin.local`;

/** Creates the default admin account only while no admin exists yet. */
export const ensureDefaultAdmin = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ username: z.string().max(100), password: z.string().max(200) }).parse(d))
  .handler(async ({ data }) => {
    if (data.username.trim().toLowerCase() !== DEFAULT_ADMIN.username || data.password !== DEFAULT_ADMIN.password) {
      return { created: false };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
    if (count) {
      console.error("Default admin skipped: admin already exists");
      return { created: false };
    }
    const { data: u, error } = await supabaseAdmin.auth.admin.createUser({
      email: usernameToEmail(DEFAULT_ADMIN.username),
      password: DEFAULT_ADMIN.password,
      email_confirm: true,
    });
    if (error || !u.user) {
      console.error("Default admin creation failed:", error?.message);
      return { created: false };
    }
    await supabaseAdmin.from("user_roles").insert({ user_id: u.user.id, role: "admin" });
    return { created: true };
  });
