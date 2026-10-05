import { parse, serialize } from "parse5";
import { imageSlot, normalizeText, textKey } from "./keys";

type AnyNode = {
  nodeName: string;
  tagName?: string;
  value?: string;
  attrs?: { name: string; value: string }[];
  childNodes?: AnyNode[];
};

const SKIP_TAGS = new Set(["script", "style", "noscript"]);
const PLAIN_TEXT_ATTRS = ["alt", "placeholder", "title", "aria-label"];
/** Attributes that hold an image URL rather than copy (language-specific thumbnails). */
const IMAGE_URL_ATTRS = ["data-thumbnail-tr", "data-thumbnail-en"];

export type TextEntry = { key: string; value: string; kind: string };
export type ImageEntry = { slot: string; url: string };

export type SiteContent = {
  texts: TextEntry[];
  images: ImageEntry[];
  titleKey: string;
  descriptionKey: string;
  keywordsKey: string | null;
};

export type RenderOptions = {
  /** key -> value for the language being rendered */
  texts: Record<string, string>;
  /** slot -> image url */
  images: Record<string, string>;
  /** adds editing hooks and the editor bundle */
  editMode?: boolean;
  /** public language code written to <html lang> */
  lang?: string;
  /** extra markup appended to <body> */
  bodyScripts?: string;
};

function getAttr(node: AnyNode, name: string): string | undefined {
  return node.attrs?.find((a) => a.name === name)?.value;
}

function setAttr(node: AnyNode, name: string, value: string) {
  if (!node.attrs) node.attrs = [];
  const existing = node.attrs.find((a) => a.name === name);
  if (existing) existing.value = value;
  else node.attrs.push({ name, value });
}

/** Meta tags whose `content` attribute is user-visible copy. */
function metaContentKind(node: AnyNode): string | null {
  if (node.tagName !== "meta") return null;
  const name = (getAttr(node, "name") || "").toLowerCase();
  const property = (getAttr(node, "property") || "").toLowerCase();
  if (name === "description" || property === "og:description") return "description";
  if (name === "keywords") return "keywords";
  if (property === "og:title" || name === "twitter:title") return "title";
  if (property.startsWith("og:") && property !== "og:image") return "meta";
  return null;
}

const BG_URL_RE = /url\(\s*(['"]?)([^)'"]+\.(?:jpg|jpeg|png|webp|svg|gif))\1\s*\)/gi;

/**
 * Single traversal used both for seeding the database and for rendering.
 * When `apply` is provided the tree is mutated in place; otherwise it only
 * reports what it finds.
 */
function walk(
  root: AnyNode,
  visit: {
    onText: (node: AnyNode, parent: AnyNode, indexAmongTexts: number) => void;
    onAttr: (node: AnyNode, attr: string, value: string, kind: string) => void;
    onImage: (node: AnyNode, src: string) => void;
    onImageAttr: (node: AnyNode, attr: string, src: string) => void;
    onBackground: (node: AnyNode, style: string) => void;
  },
) {
  const stack: AnyNode[] = [root];
  while (stack.length) {
    const node = stack.pop()!;
    const children = node.childNodes || [];

    if (node.tagName) {
      for (const attr of PLAIN_TEXT_ATTRS) {
        const v = getAttr(node, attr);
        if (v && normalizeText(v)) visit.onAttr(node, attr, v, "attr");
      }
      const metaKind = metaContentKind(node);
      if (metaKind) {
        const v = getAttr(node, "content");
        if (v && normalizeText(v)) visit.onAttr(node, "content", v, metaKind);
      }
      if (node.tagName === "img") {
        const src = getAttr(node, "src");
        if (src && !src.startsWith("data:") && !getAttr(node, "data-ik")) visit.onImage(node, src);
      }
      for (const attr of IMAGE_URL_ATTRS) {
        const v = getAttr(node, attr);
        if (v && !v.startsWith("data:")) visit.onImageAttr(node, attr, v);
      }
      const style = getAttr(node, "style");
      if (style && /url\(/i.test(style)) visit.onBackground(node, style);
    }

    if (node.tagName && SKIP_TAGS.has(node.tagName)) continue;

    let textIndex = 0;
    for (const child of children) {
      if (child.nodeName === "#text") {
        if (normalizeText(child.value || "")) {
          visit.onText(child, node, textIndex);
          textIndex++;
        }
      } else if (child.tagName) {
        stack.push(child);
      }
    }
  }
}

/** Extracts every editable text and image from a page. */
export function collectSiteContent(html: string): SiteContent {
  const doc = parse(html) as unknown as AnyNode;
  const texts: TextEntry[] = [];
  const images: ImageEntry[] = [];
  const seenText = new Set<string>();
  const seenImage = new Set<string>();
  let titleKey = "";
  let descriptionKey = "";
  let keywordsKey: string | null = null;

  const pushText = (raw: string, kind: string) => {
    const value = normalizeText(raw);
    if (!value) return "";
    const key = textKey(value);
    if (!seenText.has(key)) {
      seenText.add(key);
      texts.push({ key, value, kind });
    }
    return key;
  };

  const pushImage = (src: string) => {
    const slot = imageSlot(src);
    if (!seenImage.has(slot)) {
      seenImage.add(slot);
      images.push({ slot, url: src });
    }
    return slot;
  };

  walk(doc, {
    onText: (node, parent) => {
      const kind = parent.tagName === "title" ? "title" : "text";
      const key = pushText(node.value || "", kind);
      if (kind === "title" && key) titleKey = key;
    },
    onAttr: (_node, _attr, value, kind) => {
      const key = pushText(value, kind);
      if (kind === "description" && !descriptionKey) descriptionKey = key;
      if (kind === "keywords" && !keywordsKey) keywordsKey = key;
    },
    onImage: (_node, src) => {
      pushImage(src);
    },
    onImageAttr: (_node, _attr, src) => {
      pushImage(src);
    },
    onBackground: (_node, style) => {
      for (const m of style.matchAll(BG_URL_RE)) pushImage(m[2]!);
    },
  });

  return { texts, images, titleKey, descriptionKey, keywordsKey };
}

/**
 * Produces the final HTML for a request: every text and image is taken from
 * the database, each piece is tagged with its key so the language switcher and
 * the editor can find it, and images get lazy loading.
 */
export function renderPage(html: string, options: RenderOptions): string {
  const { texts, images, editMode = false, lang = "tr", bodyScripts = "" } = options;
  const doc = parse(html) as unknown as AnyNode;
  for (const child of doc.childNodes || []) {
    if (child.tagName === "html") {
      setAttr(child, "lang", lang);
      setAttr(child, "dir", lang === "ar" ? "rtl" : "ltr");
    }
  }

  const resolveText = (raw: string): { key: string; value: string } => {
    const normalized = normalizeText(raw);
    const key = textKey(normalized);
    return { key, value: texts[key] ?? normalized };
  };

  const resolveImage = (src: string): { slot: string; url: string } => {
    // Keep the supplied brand consistent across every legacy page and language.
    if (src === "/img/dr-zaid-logo.png") {
      return { slot: imageSlot("/arabian-logo.png"), url: "/arabian-logo.png" };
    }
    const slot = imageSlot(src);
    return { slot, url: images[slot] ?? src };
  };

  const keysByParent = new Map<AnyNode, string[]>();

  walk(doc, {
    onText: (node, parent) => {
      const raw = node.value || "";
      const leading = raw.match(/^\s*/)![0];
      const trailing = raw.match(/\s*$/)![0];
      const { key, value } = resolveText(raw);
      node.value = leading + value + trailing;
      const list = keysByParent.get(parent) || [];
      list.push(key);
      keysByParent.set(parent, list);
    },
    onAttr: (node, attr, value, _kind) => {
      const resolved = resolveText(value);
      setAttr(node, attr, resolved.value);
      const existing = getAttr(node, "data-ck-attr");
      const entry = `${attr}:${resolved.key}`;
      setAttr(node, "data-ck-attr", existing ? `${existing};${entry}` : entry);
    },
    onImage: (node, src) => {
      const { slot, url } = resolveImage(src);
      setAttr(node, "src", url);
      setAttr(node, "data-ik", slot);
      // The logo and the hero portrait are above the fold: loading them lazily
      // would delay the largest paint instead of speeding the page up.
      const aboveFold = /hero|logo|navbar-brand/i.test(
        `${getAttr(node, "class") || ""} ${slot}`,
      );
      if (!getAttr(node, "loading")) setAttr(node, "loading", aboveFold ? "eager" : "lazy");
      if (!getAttr(node, "decoding")) setAttr(node, "decoding", "async");
      if (aboveFold) setAttr(node, "fetchpriority", "high");
    },
    onImageAttr: (node, attr, src) => {
      const { slot, url } = resolveImage(src);
      setAttr(node, attr, url);
      const existing = getAttr(node, "data-ik-attr");
      const entry = `${attr}:${slot}`;
      setAttr(node, "data-ik-attr", existing ? `${existing};${entry}` : entry);
    },
    onBackground: (node, style) => {
      const slots: string[] = [];
      const next = style.replace(BG_URL_RE, (_full, quote: string, url: string) => {
        const resolved = resolveImage(url);
        slots.push(resolved.slot);
        return `url(${quote}${resolved.url}${quote})`;
      });
      if (slots.length) {
        setAttr(node, "style", next);
        setAttr(node, "data-ik-bg", slots.join("|"));
      }
    },
  });

  for (const [parent, keys] of keysByParent) {
    setAttr(parent, "data-ck", keys.join("|"));
  }

  let out = serialize(doc as never);

  const injected =
    bodyScripts + (editMode ? '\n<script src="/js/editor.js" defer></script>\n' : "");
  if (injected) {
    const idx = out.lastIndexOf("</body>");
    out = idx === -1 ? out + injected : out.slice(0, idx) + injected + out.slice(idx);
  }
  return out;
}
