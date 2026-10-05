import { createFileRoute } from "@tanstack/react-router";
/** Home page — rendered from the database copy of the original markup. */
export const Route = createFileRoute("/")({
  component: LegacyPageFallback,
  head: () => ({
    meta: [
      { title: "Dr. Zaid Khaled Alamoudi | General Dentist in Amman" },
      { name: "description", content: "General and aesthetic dental care in Amman, including composite fillings, teeth cleaning, whitening and zirconia crowns." },
      { property: "og:title", content: "Dr. Zaid Khaled Alamoudi | General Dentist in Amman" },
      { property: "og:description", content: "Patient-focused dental treatments and appointments with Dr. Zaid Khaled Alamoudi in Amman." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "preload",
        as: "image",
        href: "/arabian-logo.png",
        fetchPriority: "high",
      },
    ],
  }),
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { renderSitePage } = await import("@/lib/site-content/render.server");
        return renderSitePage(request, "index");
      },
    },
  },
});

function LegacyPageFallback() {
  return null;
}
