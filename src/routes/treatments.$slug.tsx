import { createFileRoute } from "@tanstack/react-router";
import { getTreatment } from "@/lib/site-content/treatments";

export const Route = createFileRoute("/treatments/$slug")({
  component: LegacyPageFallback,
  head: ({ params }) => {
    const treatment = getTreatment(params.slug);
    const title = treatment
      ? `${treatment.title} | Dr. Zaid Khaled Alamoudi`
      : "Treatment Not Found | Dr. Zaid Khaled Alamoudi";
    const description = treatment?.summary ?? "The requested dental treatment could not be found.";
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
        const { renderTreatmentPage } = await import("@/lib/site-content/render.server");
        return renderTreatmentPage(request, params.slug);
      },
    },
  },
});

function LegacyPageFallback() {
  return null;
}