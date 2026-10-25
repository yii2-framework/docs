import { catalogMarkdown } from "../../lib/catalog.mjs";
import { hostingFor, loadHosting } from "../../lib/hosting.mjs";

export const prerender = true;

export function GET() {
  const hosting = loadHosting();
  return new Response(
    catalogMarkdown(import.meta.env.BASE_URL, (pkg) =>
      hostingFor(pkg, hosting),
    ),
    { headers: { "Content-Type": "text/markdown; charset=utf-8" } },
  );
}
