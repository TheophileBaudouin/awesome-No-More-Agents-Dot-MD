---
name: conventional-commits
description: Enforce the Conventional Commits format when a commit message is requested.
events: [before_agent_start]
match:
  input: {contains: ["commit message"]}
action:
  type: inject
  once: true
priority: normal
---

# Conventional Commits

When the user asks for a commit message, follow the Conventional Commits
specification.

Format: `<type>[optional scope]: <description>`

Valid types:

- `feat` — a new feature
- `fix` — a bug fix
- `docs` — documentation only
- `style` — formatting, no code change
- `refactor` — a change that neither fixes a bug nor adds a feature
- `test` — adding or updating tests
- `chore` — maintenance tasks

Examples:

- `feat(auth): add token refresh endpoint`
- `fix: correct off-by-one in pagination`
- `docs(readme): document the registry workflow`

Keep the subject line under 72 characters, start with a lowercase letter, and
use the imperative mood.
