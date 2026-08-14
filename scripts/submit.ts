#!/usr/bin/env node
/**
 * Submission bot: turns a filled "Submit a context file" issue
 * (.github/ISSUE_TEMPLATE/submit.yml) into registry files, then validates
 * them with the exact same loader used by CI and the site build.
 *
 * The issue body is read from $ISSUE_BODY (set by
 * .github/workflows/submit.yml).
 *   - Success: writes `registry/<name>/context.md` + `metadata.yml`, prints
 *     `OK <name>` and appends `name=<name>` to $GITHUB_OUTPUT when set.
 *   - Failure: writes the error list to `.submission.md`, prints it, exits 1.
 *
 * Overridable for local testing:
 *   REGISTRY_DIR  registry root to read/write (default "registry")
 *   DRY_RUN=1     validate without writing files
 *
 * Manual check (uses the checked-in fixtures):
 *   rm -rf /tmp/reg && cp -r registry /tmp/reg
 *   ISSUE_BODY="$(cat scripts/fixtures/submission-valid.txt)" \
 *     REGISTRY_DIR=/tmp/reg npx tsx scripts/submit.ts          # prints OK
 *   ISSUE_BODY="$(cat scripts/fixtures/submission-invalid.txt)" \
 *     REGISTRY_DIR=/tmp/reg npx tsx scripts/submit.ts          # exits 1
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { stringify } from "yaml";
import { CATEGORIES, loadRegistry } from "../src/registry";

const REGISTRY_DIR = process.env.REGISTRY_DIR ?? "registry";
const DRY_RUN = process.env.DRY_RUN === "1";

const body = process.env.ISSUE_BODY ?? "";
if (!body.trim()) {
	fail("no issue body found ($ISSUE_BODY is empty)");
}

const name = field("Directory name");
const author = field("Author (GitHub handle)");
const category = field("Category");
const rawTags = field("Tags (comma-separated, optional)");
const repo = field("Source repository (optional)");
const piVersion = field("Minimum Pi version (optional)");
const content = field("The context file");

const errors: string[] = [];
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
	errors.push(
		"directory name must be kebab-case (lowercase letters, digits, single hyphens), e.g. `conventional-commits`",
	);
}
if (!author) errors.push("`author` is required");
if (!(CATEGORIES as readonly string[]).includes(category)) {
	errors.push(`\`category\` must be one of: ${CATEGORIES.join(", ")}`);
}
if (!content.trim()) errors.push("the context file is required");
if (errors.length > 0) fail("the form was not filled in correctly", errors);

const tags = rawTags
	.split(",")
	.map((t) => t.trim())
	.filter(Boolean);
const metadataYaml = stringify({
	author,
	category,
	...(tags.length ? { tags } : {}),
	...(repo ? { repo } : {}),
	...(piVersion ? { min_pi_version: piVersion } : {}),
});

if (!DRY_RUN) {
	const targetDir = path.join(REGISTRY_DIR, name);
	fs.mkdirSync(targetDir, { recursive: true });
	fs.writeFileSync(
		path.join(targetDir, "context.md"),
		content.trimEnd() + "\n",
	);
	fs.writeFileSync(path.join(targetDir, "metadata.yml"), metadataYaml);
}

// Validate the whole registry — catches frontmatter errors, a directory
// name that differs from the frontmatter `name`, duplicates, bad metadata.
const { errors: registryErrors } = loadRegistry(path.resolve(REGISTRY_DIR));
if (registryErrors.length > 0) {
	fail("the registry rejected the submission", registryErrors);
}

if (process.env.GITHUB_OUTPUT) {
	fs.appendFileSync(process.env.GITHUB_OUTPUT, `name=${name}\n`);
}
console.log(`OK ${name}`);

/** Extract a field value from a GitHub issue-form body. */
function field(label: string): string {
	const esc = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const re = new RegExp(
		`### ${esc}\\r?\\n\\r?\\n([\\s\\S]*?)(?=\\r?\\n### |\\r?\\n\\r?\\n$|$)`,
	);
	const m = body.match(re);
	return m ? m[1].trim() : "";
}

function fail(message: string, extra: string[] = []): never {
	const lines = [
		"Submission rejected:",
		"",
		`- ${message}`,
		...extra.map((e) => `- ${e}`),
	];
	fs.writeFileSync(".submission.md", lines.join("\n") + "\n");
	console.error(lines.join("\n"));
	process.exit(1);
}
