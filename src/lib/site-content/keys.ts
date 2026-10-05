/**
 * Deterministic, dependency-free key generation for site content.
 * The same normalized source string always yields the same key, so text that
 * repeats across pages (navigation, footer) shares one editable entry.
 */

export const TEXT_ATTRS = ["alt", "placeholder", "title", "aria-label", "content"] as const;

export function normalizeText(value: string): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

/** 64-bit FNV-1a, emitted as 13 base36 characters. */
export function hashString(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 = (Math.imul(h2 ^ c, 0x85ebca6b) + i) >>> 0;
  }
  return (h1.toString(36) + h2.toString(36)).padStart(13, "0");
}

export function textKey(source: string): string {
  return "t_" + hashString(normalizeText(source));
}

/** Turns "img/service-protez.jpg" into the stable slot "service-protez". */
export function imageSlot(src: string): string {
  const clean = (src || "").split("?")[0]!.split("#")[0]!;
  const base = clean.substring(clean.lastIndexOf("/") + 1);
  const noExt = base.replace(/\.[a-z0-9]+$/i, "");
  return (
    noExt
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "image"
  );
}

export const PAGES = [
  { slug: "index", file: "index.html", label: "Home" },
  { slug: "about", file: "about.html", label: "About" },
  { slug: "service", file: "service.html", label: "Treatments" },
  { slug: "appoinment", file: "appoinment.html", label: "Appointment" },
  { slug: "contact", file: "contact.html", label: "Contact" },
] as const;

export type PageSlug = (typeof PAGES)[number]["slug"];

export function isPageSlug(value: string): value is PageSlug {
  return PAGES.some((p) => p.slug === value);
}
