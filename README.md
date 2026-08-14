# Awesome No-More-Agents-Dot-MD

A community registry of **Pi context files** for the
[No More Agents .MD](https://github.com/TheophileBaudouin/No-More-Agents-Dot-MD)
extension.

The extension replaces the monolithic `AGENTS.md` with declarative, unit-sized
context files (`.pi/context/*.md`) that are injected only when relevant. This
repository is the community space where those files are shared: anyone can
publish one via a pull request, and the site is generated automatically from
`registry/` at build time.

**Site:** <https://theophilebaudouin.github.io/awesome-No-More-Agents-Dot-MD/>

## How it works

- **Submissions live in `registry/`** — one directory per context file:
  `registry/<name>/context.md` + `registry/<name>/metadata.yml`.
- **Every pull request is validated automatically** (see
  [`.github/workflows/validate.yml`](.github/workflows/validate.yml)) against
  the schema used by the extension, before it can be merged.
- **The site is generated at build time** from `registry/` with
  [Astro](https://astro.build/) and deployed to GitHub Pages by
  [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).
- **Comments and reactions** on each page are powered by
  [giscus](https://giscus.app/), backed by GitHub Discussions. Reactions
  (👍/👎) serve as a popularity proxy — there is no 5-star rating system.

## Structure

```text
registry/                     # Community submissions (one dir per context file)
  <name>/
    context.md                # The context file itself (extension schema)
    metadata.yml              # Registry metadata (author, category, tags, …)
src/                          # Astro site (index, rule pages, styles)
scripts/validate.ts           # Registry validator — used by CI and the build
.github/workflows/            # validate.yml (PRs) + deploy.yml (GitHub Pages)
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) — it documents the submission process,
the `context.md` schema, the `metadata.yml` fields and the review rules.

## Local development

```bash
npm install
npm run validate   # validate the registry (same check as CI)
npm run dev        # start the dev server
npm run build      # build the static site into dist/
```

The site is deployed from the `main` branch on every push. GitHub Pages must
be enabled with **Deploy from a branch → GitHub Actions** as the source
(Settings → Pages).

## License

MIT — see [LICENSE](LICENSE). By submitting a context file via pull request,
you agree to publish it under the MIT license.
