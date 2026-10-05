import { createFileRoute } from "@tanstack/react-router";

/** Every other public page: /about.html, /service.html, /contact.html … */
export const Route = createFileRoute("/$page")({
  component: LegacyPageFallback,
  head: ({ params }) => {
    const labels: Record<string, string> = {
      "about.html": "About",
      "service.html": "Treatments",
      "appoinment.html": "Appointment",
      "contact.html": "Contact",
    };
    const label = labels[params.page] ?? "Page";
    const title = `${label} | Dr. Zaid Khaled Alamoudi`;
    const description = `Dr. Zaid Khaled Alamoudi — general dentist in Amman. View ${label.toLowerCase()} information and appointment options.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { renderSitePage } = await import("@/lib/site-content/render.server");
        const slug = String(params.page).replace(/\.html$/i, "");
        return renderSitePage(request, slug);
      },
    },
  },
});

function LegacyPageFallback() {
  return null;
}
