import type { APIContext } from "astro";
import { packageMarkdown, packages } from "../../../lib/catalog.mjs";
import { hostingFor } from "../../../lib/hosting.mjs";

export const prerender = true;

export function getStaticPaths() {
  return packages.map((pkg) => ({ params: { id: pkg.id }, props: { pkg } }));
}

export function GET({ props }: APIContext) {
  // `{ guide: false }`: the record has no documentation on this site.
  const hosting = hostingFor(props.pkg) ?? { guide: false };
  return new Response(
    packageMarkdown(props.pkg, import.meta.env.BASE_URL, hosting),
    { headers: { "Content-Type": "text/markdown; charset=utf-8" } },
  );
}
