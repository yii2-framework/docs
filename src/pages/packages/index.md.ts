import { catalogMarkdown } from "../../lib/catalog.mjs";

export const prerender = true;

export function GET() {
  return new Response(catalogMarkdown(import.meta.env.BASE_URL), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
