import fallbackSnapshot from "./fallback.generated.json";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Every language the site is published in, in switcher order. */
export const SITE_LANGS = ["en", "ar"] as const;
export type SiteLang = (typeof SITE_LANGS)[number];

export function isSiteLang(value: string): value is SiteLang {
  return (SITE_LANGS as readonly string[]).includes(value);
}

export type ContentSnapshot = {
  version: number;
  langs: Record<SiteLang, Record<string, string>>;
  images: Record<string, string>;
  pages: Record<
    string,
    { titleKey: string; descriptionKey: string; keywordsKey: string | null; path: string }
  >;
};

const SNAPSHOT = fallbackSnapshot as ContentSnapshot;

/** Short-lived in-memory copy so normal visitors don't wait on the database every request. */
const SNAPSHOT_TTL_MS = 15_000;
let cached: { at: number; value: ContentSnapshot } | null = null;
let inflight: Promise<ContentSnapshot> | null = null;
/** storage path -> long-lived signed URL (paths are unique per upload, so URLs never go stale). */
const SIGNED_URLS = new Map<string, string>();

export async function getContentSnapshot(force = false): Promise<ContentSnapshot> {
  if (!force && cached && Date.now() - cached.at < SNAPSHOT_TTL_MS) return cached.value;
  if (inflight) return inflight;
  inflight = loadSnapshot()
    .then((value) => {
      cached = { at: Date.now(), value };
      return value;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

async function loadSnapshot(): Promise<ContentSnapshot> {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !key) return SNAPSHOT;
  try {
    const client = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
      global: { fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      } },
    });
    const [textResult, imageResult, publicationResult] = await Promise.all([
      client.from("site_text_overrides").select("language,content_key,value"),
      client.from("site_image_overrides").select("slot,storage_path"),
      client.from("site_publication").select("version").eq("id", true).maybeSingle(),
    ]);
    if (textResult.error || imageResult.error) return SNAPSHOT;
    const langs = {
      en: { ...SNAPSHOT.langs.en },
      ar: { ...SNAPSHOT.langs.ar },
    };
    for (const row of textResult.data ?? []) {
      if (isSiteLang(row.language)) langs[row.language][row.content_key] = row.value;
    }
    const images = { ...SNAPSHOT.images };
    const rows = imageResult.data ?? [];
    const missing = rows.map((r) => r.storage_path).filter((p) => !SIGNED_URLS.has(p));
    if (missing.length) {
      // One batched request, URLs valid for a year so browsers can cache the images.
      const { data } = await client.storage.from("site-content").createSignedUrls(missing, 60 * 60 * 24 * 365);
      for (const item of data ?? []) if (item.path && item.signedUrl) SIGNED_URLS.set(item.path, item.signedUrl);
    }
    for (const row of rows) {
      const signed = SIGNED_URLS.get(row.storage_path);
      if (signed) images[row.slot] = signed;
    }
    return {
      ...SNAPSHOT,
      version: publicationResult.data?.version ?? SNAPSHOT.version,
      langs,
      images,
    };
  } catch {
    return SNAPSHOT;
  }
}

export function invalidateContentCache() {
  cached = null;
}
