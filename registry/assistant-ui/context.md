---
name: assistant-ui
description: Inject assistant-ui component guidelines when the prompt is about UI, components, or interface.
tags: [ui, components, frontend]
compatibility: "Next.js (App Router), React 18+"
---

Overview
This file documents the assistant-ui package and how to integrate or create components using Assistant UI.

Quick start (summary)

- For a fresh project: run `npx assistant-ui@latest create <app-name> -t <template>` (templates: default, minimal, cloud, langgraph, mcp).
- For existing Next.js App Router projects: confirm package manager and Tailwind then run `npx assistant-ui@latest init --yes`.
- For other frameworks, follow the "Manual setup" instructions below.

How to test (minimal)

1. Start dev server (e.g. `npm run dev` or `pnpm dev`).
2. Render `<Assistant />` on a page and send a test message.
3. Success is a reply that streams token-by-token in the Thread UI.

Troubleshooting

- CI rejection due to missing frontmatter usually means the file does not start with `---` on the very first line or contains an invisible BOM. Make sure there is nothing before `---`.
- If you see a YAML parse error, check indentation and colons in the frontmatter.
- If the file was committed as `.mdx` or `.markdown` instead of `.md`, rename to `.md`.
