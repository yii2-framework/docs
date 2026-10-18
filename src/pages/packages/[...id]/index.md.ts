import type { APIContext } from "astro";
import { packageMarkdown, packages } from "../../../lib/catalog.mjs";

export const prerender = true;

export function getStaticPaths() {
  return packages.map((pkg) => ({ params: { id: pkg.id }, props: { pkg } }));
}

export function GET({ props }: APIContext) {
  return new Response(packageMarkdown(props.pkg, import.meta.env.BASE_URL), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
