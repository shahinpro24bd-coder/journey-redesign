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

export async function getContentSnapshot(_force = false): Promise<ContentSnapshot> {
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
    for (const row of imageResult.data ?? []) {
      const { data } = await client.storage.from("site-content").createSignedUrl(row.storage_path, 3600);
      if (data?.signedUrl) images[row.slot] = data.signedUrl;
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
  /* Versioned response keys naturally replace stale rendered pages. */
}
