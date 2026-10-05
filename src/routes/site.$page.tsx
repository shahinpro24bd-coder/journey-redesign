import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy /site/... links keep working. */
export const Route = createFileRoute("/site/$page")({
  component: LegacyPageFallback,
  beforeLoad: ({ params }) => {
    throw redirect({ href: `/${params.page}`, statusCode: 301 });
  },
});

function LegacyPageFallback() {
  return null;
}
