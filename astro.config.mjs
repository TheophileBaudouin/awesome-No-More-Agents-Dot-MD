import { defineConfig } from "astro/config";

// The site is deployed to GitHub Pages as a project site, so it lives under
// `/<repo-name>/`. If a custom domain is configured later, set `base: "/"`
// and adjust `site` accordingly.
export default defineConfig({
  site: "https://theophilebaudouin.github.io/awesome-No-More-Agents-Dot-MD",
  base: "/awesome-No-More-Agents-Dot-MD",
  trailingSlash: "always",
});
