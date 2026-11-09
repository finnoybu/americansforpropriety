import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";
import { readdirSync, readFileSync } from "node:fs";

// Briefs and letters render on demand (prerender = false), so the sitemap
// integration can't discover them from the build. List the static content
// collection entries explicitly so search engines can find every page.
// Entry ids match the glob loader: the file name without extension.
const SITE = "https://americansforpropriety.org";
function contentPages(collection, route) {
  const dir = new URL(`./src/content/${collection}/`, import.meta.url);
  return readdirSync(dir)
    .filter((f) => /\.(md|mdx)$/.test(f))
    .filter((f) => !/^draft:\s*true\s*$/m.test(readFileSync(new URL(f, dir), "utf8")))
    .map((f) => `${SITE}/${route}/${f.replace(/\.(md|mdx)$/, "")}/`);
}

// Hybrid by default: most content pages prerender; routes that need a request
// (auth, member dashboard, API) opt into SSR via `export const prerender = false`.
export default defineConfig({
  site: "https://americansforpropriety.org",
  output: "static",
  adapter: cloudflare({
    platformProxy: { enabled: true },
    imageService: "compile",
  }),
  integrations: [
    mdx(),
    sitemap({
      customPages: [...contentPages("briefs", "briefs"), ...contentPages("letters", "letters")],
      // Exclude auth-gated and API routes from the public sitemap. They're
      // SSR-only and crawlers should not index them even if they happen to
      // be discoverable.
      filter: (page) =>
        !page.includes("/admin/") &&
        !page.includes("/api/") &&
        !page.includes("/member/") &&
        !page.includes("/signin"),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    shikiConfig: { theme: "github-light", wrap: true },
  },
});
