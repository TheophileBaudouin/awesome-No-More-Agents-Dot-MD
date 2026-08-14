# Contributing

Thanks for wanting to share a context file. This document is the contract for
submissions: read it before opening a pull request.

## Submission process

**Option A: web form (recommended).** No fork or clone needed: open the
[“Submit a context file” issue form](https://github.com/TheophileBaudouin/awesome-No-More-Agents-Dot-MD/issues/new?template=submit),
fill it in (the fields mirror `metadata.yml`, plus the content of
`context.md`), and submit. A bot validates the submission, creates
`registry/<name>/` and opens a pull request. A maintainer then reviews and
merges.

**Option B: manual pull request.**

1. **Fork** this repository.
2. **Create a branch** (`git checkout -b registry/my-context-file`).
3. **Add a directory** `registry/<name>/` containing exactly two files:
   - `context.md`, the context file itself (see [context.md](#contextmd));
   - `metadata.yml`, registry metadata (see [metadata.yml](#metadatayml)).
4. **Open a pull request** against `main`.
5. **Wait for the automated validation** to pass. A maintainer then reviews
   and merges (or requests changes).

Both paths run the exact same validation. The web form is the fastest route;
the manual PR remains available for bulk or scripted submissions.

## Naming conventions

- The directory name **must equal the `name` in the frontmatter** of
  `context.md`.
- Names are **kebab-case**: lowercase letters, digits and single hyphens
  (`ui-context`, `git-workflow-v2`, …). No spaces, no underscores, no dots.
- Names must be **unique** across the whole registry.

## context.md

A context file is a Markdown document whose frontmatter follows the extension
schema (source of truth:
[`skill/context-engine/references/schema.md`](https://github.com/TheophileBaudouin/No-More-Agents-Dot-MD/blob/main/skill/context-engine/references/schema.md)).
The body after the closing `---` is the context injected into the session.

```yaml
---
name: ui-context
description: UI conventions
events: [before_agent_start]
match:
  input: {contains: [ui, ux]}
action:
  type: inject
  once: true
priority: normal
---
```

| Key | Required | Type | Meaning |
| --- | --- | --- | --- |
| `name` | yes | string | Unique rule id (must equal the directory name) |
| `description` | no | string | Shown to the user / used as a block-reason fallback |
| `events` | yes | string[] | One or more of the 7 valid events |
| `match` | no | map | When the rule applies (absent = always) |
| `action` | yes | map | What happens when it applies |
| `priority` | no | `high` \| `normal` \| `low` | Execution order (default `normal`) |

**7 valid events:** `before_agent_start` · `tool_call` · `tool_result` ·
`input` · `user_bash` · `session_before_switch` · `session_before_fork`

**9 valid actions:** `inject` · `confirm` · `block` · `modify` · `tools` ·
`notify` · `transform` · `handled` · `annotate`

**Event × action compatibility** (a file is rejected when an action is not
allowed for one of its events):

| | inject | confirm | block | modify | tools | notify | transform | handled | annotate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| before_agent_start | ✓ | | | | ✓ | ✓ | | | |
| tool_call | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | | |
| tool_result | ✓ | | | | | ✓ | | | ✓ |
| input | | | | | ✓ | ✓ | ✓ | ✓ | |
| user_bash | | ✓ | ✓ | ✓ | | ✓ | | | |
| session_before_switch | | ✓ | ✓ | | | ✓ | | | |
| session_before_fork | | ✓ | ✓ | | | ✓ | | | |

Keep the frontmatter within the simple YAML subset the extension parses:
flat keys, inline lists (`[a, b]`) and inline maps (`{contains: [ui, ux]}`).
Exotic YAML (block scalars, anchors, …) may be rejected by the extension even
if this registry accepts it.

## metadata.yml

```yaml
author: your-github-username
category: workflow
tags: [git, commits, style]
repo: https://github.com/you/your-context-files   # optional
min_pi_version: 0.1.0                              # optional
```

| Key | Required | Type | Meaning |
| --- | --- | --- | --- |
| `author` | yes | string | Your GitHub username (no `@`) |
| `category` | yes | string | One of: `workflow`, `security`, `ui`, `prompting`, `tooling`, `other` |
| `tags` | no | string[] | Free-form keywords used by the site search |
| `repo` | no | string | URL of the repository where the original file lives |
| `min_pi_version` | no | string | Minimum extension version required (e.g. `0.1.0`) |

Unknown keys are tolerated (they do not fail validation) but should be
avoided, the site does not render them.

## What CI checks

Every pull request touching `registry/` runs
[`.github/workflows/validate.yml`](.github/workflows/validate.yml) →
`npm run validate`. It rejects a PR when any submission:

- is missing `context.md` or `metadata.yml`;
- has invalid `context.md` frontmatter (missing/invalid keys, unknown event,
  action not allowed for an event);
- has invalid `metadata.yml` (missing author, unknown category, bad URL);
- does not match the naming conventions (kebab-case directory equal to the
  frontmatter `name`, unique names).

The same checks run again at build time: the site deployment fails if the
registry is invalid, so `main` is always in a buildable state.

Submissions coming through the web form are validated by the
[`Submission bot`](.github/workflows/submit.yml) workflow with the same
checks, *before* a pull request is opened, the PR it creates is already
validated.

## Review and moderation

- PRs are reviewed by maintainers. Acceptance criteria: the file matches the
  schema, the naming conventions, and the body is genuinely useful context
  (not placeholder content).
- Spam or abusive submissions are closed without merging.
- Reactions on giscus comments are GitHub reactions. Coordinated reaction
  campaigns are treated as abuse: a discussion can be locked or hidden by the
  maintainers.

## License

By submitting a pull request, you agree that your context file is published
under the [MIT license](LICENSE), like the rest of this repository.
