---
name: Registry submission
about: Use this template to submit a registry entry. Fill out required fields so the automated checks can pass.
title: "[registry] Add / Update: {component-name}"
labels: submission
---

# Registry submission — please fill

Thank you for submitting! This file helps us automatically validate your submission. If you are not sure about something, write "I don't know" — a reviewer will help.

## Required (please fill)

- Component / Package name:
- Short description (1 sentence):
- Repository or package URL (link to code/demo):
- Author name and contact (GitHub handle or email):

## Frontmatter for registry context

Please include a file at registry/<component>/context.md with YAML frontmatter at the very top. Example frontmatter (copy/paste into the top of your context.md file):

---
name: component-name
description: One-sentence description of the component

# optional: add short helpful keys used by our registry

tags: [ui, frontend]
compatibility: "Next.js (App Router), React 18+"
---

After the frontmatter, add short usage notes and a “How to test” section.

## Helpful fields (optional)

- Demo URL / Storybook:
- Installation snippet (copy/paste):
- Compatibility / tested with:
- Screenshot or GIF: (link)

## Checklist before submitting (automated checks will verify these)

- [ ] I created registry/<component>/context.md
- [ ] The file starts immediately with YAML frontmatter (three dashes --- on the first line)
- [ ] The file extension is .md (not .mdx or .markdown)
- [ ] I previewed the file in GitHub to ensure no encoding issues
- [ ] I included a short “How to test” with a single test message or steps

If you see a CI failure, open the Actions logs and paste the error into this PR so reviewers can help. Thanks!
