import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";

// Hybrid by default: most content pages prerender; routes that need a request
// (auth, member dashboard, API) opt into SSR via `export const prerender = false`.
export default defineConfig({
  site: "https://americansforpropriety.org",
  output: "static",
  adapter: cloudflare({
    platformProxy: { enabled: true },
    imageService: "compile",
  }),
  integrations: [mdx(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    shikiConfig: { theme: "github-light", wrap: true },
  },
});
