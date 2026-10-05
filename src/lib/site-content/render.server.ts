import { getContentSnapshot, isSiteLang, SITE_LANGS, type SiteLang } from "./server";
import { PAGE_SOURCE } from "./pages.server";
import { renderPage } from "./transform";
import { createTreatmentPage } from "./treatment-page";
import { getTreatment } from "./treatments";

/**
 * Builds one public page: every string and image comes from the database, the
 * markup itself is untouched so the design stays identical to the original.
 * Each supported language is rendered server-side via ?lang=xx.
 */
export async function renderSitePage(request: Request, slug: string): Promise<Response> {
  if (slug === "gallery") {
    return Response.redirect(new URL("/service.html", request.url), 301);
  }
  const source = PAGE_SOURCE[slug];
  if (!source) return new Response("Not found", { status: 404 });

  const url = new URL(request.url);
  const editMode = url.searchParams.get("edit") === "1";
  const langParam = url.searchParams.get("lang") || "";
  const cookieLang = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)site_lang=(en|ar)(?:;|$)/)?.[1];
  const lang: SiteLang = isSiteLang(langParam)
    ? langParam
    : cookieLang && isSiteLang(cookieLang)
      ? cookieLang
      : "en";

  const snapshot = await getContentSnapshot(editMode);
  const texts = snapshot.langs[lang];

  // Fully rendered pages are memoised per slug+language+content version, so a
  // repeat request skips the HTML parse/transform entirely.
  const cacheKey = `${slug}|${lang}|${snapshot.version}|${url.pathname}`;
  if (!editMode) {
    const cached = RENDER_CACHE.get(cacheKey);
    if (cached) return htmlResponse(cached, snapshot.version, false);
  }

  const bootstrap =
    `<script>window.__SITE_LANG__=${JSON.stringify(lang)};` +
    `window.__SITE_LANGS__=${JSON.stringify([...SITE_LANGS])};` +
    `window.__SITE_EDIT__=${editMode ? "true" : "false"};</script>`;


  let html = renderPage(source, {
    texts,
    images: snapshot.images,
    editMode,
    lang,
    bodyScripts: bootstrap,
  });

  // SEO: self-referential hreflang alternates for every published language.
  const links = SITE_LANGS.map((code) => {
    const href =
      code === "en" ? url.origin + url.pathname : `${url.origin}${url.pathname}?lang=${code}`;
    return `<link rel="alternate" hreflang="${code}" href="${href}" />`;
  });
  links.push(`<link rel="alternate" hreflang="x-default" href="${url.origin}${url.pathname}" />`);
  const headIndex = html.lastIndexOf("</head>");
  if (headIndex !== -1) html = html.slice(0, headIndex) + links.join("") + html.slice(headIndex);

  if (!editMode) {
    if (RENDER_CACHE.size > 64) RENDER_CACHE.clear();
    RENDER_CACHE.set(cacheKey, html);
  }

  return htmlResponse(html, snapshot.version, editMode);
}

export async function renderTreatmentPage(request: Request, slug: string): Promise<Response> {
  const treatment = getTreatment(slug);
  if (!treatment) return new Response("Treatment not found", { status: 404 });

  const url = new URL(request.url);
  const editMode = url.searchParams.get("edit") === "1";
  const langParam = url.searchParams.get("lang") || "";
  const cookieLang = request.headers.get("cookie")?.match(/(?:^|;\s*)site_lang=(en|ar)(?:;|$)/)?.[1];
  const lang: SiteLang = isSiteLang(langParam) ? langParam : cookieLang && isSiteLang(cookieLang) ? cookieLang : "en";
  const snapshot = await getContentSnapshot(editMode);
  const bootstrap = `<script>window.__SITE_LANG__=${JSON.stringify(lang)};window.__SITE_LANGS__=${JSON.stringify([...SITE_LANGS])};window.__SITE_EDIT__=${editMode ? "true" : "false"};</script>`;
  let html = renderPage(createTreatmentPage(treatment), {
    texts: snapshot.langs[lang],
    images: snapshot.images,
    editMode,
    lang,
    bodyScripts: bootstrap,
  });
  const links = SITE_LANGS.map((code) => `<link rel="alternate" hreflang="${code}" href="${url.origin}${url.pathname}${code === "en" ? "" : `?lang=${code}`}" />`);
  links.push(`<link rel="alternate" hreflang="x-default" href="${url.origin}${url.pathname}" />`);
  html = html.replace("</head>", `${links.join("")}</head>`);
  return htmlResponse(html, snapshot.version, editMode);
}

/** slug|lang|version|path -> fully rendered HTML */
const RENDER_CACHE = new Map<string, string>();

function htmlResponse(html: string, version: number | string, editMode: boolean): Response {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": editMode
        ? "no-store"
        : "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      "X-Content-Version": String(version),
    },
  });
}
