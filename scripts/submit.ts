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
 * The bot is lenient about the submission process and strict about the file:
 * small mistakes are fixed automatically (BOM, leading blank lines, a `@`
 * before the author, a URL without a scheme, a missing `description`), so it
 * never blocks on something trivial. It only rejects a submission when the
 * context file itself would not load with the extension — with an error that
 * says exactly what to fix.
 *
 * Overridable for local testing:
 *   REGISTRY_DIR  registry root to read/write (default "registry")
 *   DRY_RUN=1     validate against a throwaway copy, write nothing
 *
 * Manual check (uses the checked-in fixtures):
 *   rm -rf /tmp/reg && cp -r registry /tmp/reg
 *   ISSUE_BODY="$(cat scripts/fixtures/submission-valid.txt)" \
 *     REGISTRY_DIR=/tmp/reg npx tsx scripts/submit.ts          # prints OK
 *   ISSUE_BODY="$(cat scripts/fixtures/submission-invalid.txt)" \
 *     REGISTRY_DIR=/tmp/reg npx tsx scripts/submit.ts          # exits 1
 *   ISSUE_BODY="$(cat scripts/fixtures/submission-headings.txt)" \
 *     REGISTRY_DIR=/tmp/reg npx tsx scripts/submit.ts          # prints OK
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { stringify } from "yaml";
import { CATEGORIES, loadRegistry } from "../src/registry";

const REGISTRY_DIR = process.env.REGISTRY_DIR ?? "registry";
const DRY_RUN = process.env.DRY_RUN === "1";

const body = process.env.ISSUE_BODY ?? "";
if (!body.trim()) {
	fail("no issue body found ($ISSUE_BODY is empty)");
}

const sections = parseBody(body);

const name = field("Directory name").toLowerCase().trim();
const description = field("Short description").trim();
const author = field("Author (GitHub handle)").replace(/^@+/, "").trim();
const category = field("Category");
const rawTags = field("Tags (comma-separated, optional)");
const rawRepo = field("Source repository (optional)");
const piVersion = field("Minimum Pi version (optional)");
const rawContent = extractContent(body);

const errors: string[] = [];
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
	errors.push(
		"directory name must be kebab-case (lowercase letters, digits, single hyphens), e.g. `conventional-commits`",
	);
}
if (!description) errors.push("`short description` is required");
if (!author) errors.push("`author` is required");
if (!(CATEGORIES as readonly string[]).includes(category)) {
	errors.push(`\`category\` must be one of: ${CATEGORIES.join(", ")}`);
}
if (!rawContent.trim()) errors.push("the context file is required");
if (errors.length > 0) fail("the form was not filled in correctly", errors);

const repo = normalizeRepo(rawRepo, errors);
const content = normalizeContent(rawContent, description, errors);
if (errors.length > 0) fail("please fix these issues", errors);

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

const submission = { content, metadataYaml };

if (DRY_RUN) {
	// Validate against a throwaway copy so the real registry is untouched.
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "reg-"));
	fs.cpSync(path.resolve(REGISTRY_DIR), tmp, { recursive: true });
	writeSubmission(tmp, name, submission);
	checkRegistry(tmp);
} else {
	writeSubmission(path.resolve(REGISTRY_DIR), name, submission);
	checkRegistry(path.resolve(REGISTRY_DIR));
}

if (process.env.GITHUB_OUTPUT) {
	fs.appendFileSync(process.env.GITHUB_OUTPUT, `name=${name}\n`);
}
console.log(`OK ${name}`);

/* ------------------------------------------------------------------ */
/* Form parsing                                                        */
/* ------------------------------------------------------------------ */

/**
 * Split the issue body into `### Label` sections. A field that was left
 * empty becomes an empty value (no capturing the next section's header,
 * which is what a naive regex does when GitHub renders `### Label` with an
 * empty value as `### Label\n\n### Next label`).
 */
function parseBody(body: string): Map<string, string> {
	const sections = new Map<string, string>();
	let current: string | null = null;
	let chunks: string[] = [];
	for (const line of body.split(/\r?\n/)) {
		const m = line.match(/^### (.+)$/);
		if (m) {
			if (current !== null) sections.set(current, chunks.join("\n").trim());
			current = m[1].trim();
			chunks = [];
		} else if (current !== null) {
			chunks.push(line);
		}
	}
	if (current !== null) sections.set(current, chunks.join("\n").trim());
	return sections;
}

/** Extract a field value from a GitHub issue-form body. */
function field(label: string): string {
	return sections.get(label) ?? "";
}

/**
 * The context file is the last field of the form: take the whole remainder
 * of the body after its header. This keeps `### `-style headings that live
 * inside the pasted file (the generic `field()` regex would truncate there).
 */
function extractContent(body: string): string {
	const m = body.match(/### The context file\r?\n\r?\n([\s\S]*)$/);
	return m ? m[1].trim() : "";
}

/* ------------------------------------------------------------------ */
/* Tolerant normalization                                              */
/* ------------------------------------------------------------------ */

/**
 * Make the pasted file installable as-is: drop a UTF-8 BOM, unify line
 * endings, and remove leading blank lines/whitespace so the frontmatter
 * starts at byte 0 — exactly what the extension requires.
 */
function normalizeContent(
	raw: string,
	description: string,
	errors: string[],
): string {
	let text = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
	text = text.replace(/^\s+/, "");
	if (!text.startsWith("---")) {
		errors.push(
			"the context file must start with `---` on the very first line (the YAML frontmatter block)",
		);
		return text;
	}
	const lines = text.split("\n");
	let close = -1;
	for (let i = 1; i < lines.length; i++) {
		if (lines[i].trim() === "---") {
			close = i;
			break;
		}
	}
	if (close === -1) {
		errors.push(
			"the frontmatter block must be closed with a `---` line before the body",
		);
		return text;
	}
	const frontmatter = ensureDescription(lines.slice(1, close), description);
	return ["---", ...frontmatter, ...lines.slice(close)].join("\n").trimEnd() +
		"\n";
}

/**
 * Guarantee a non-empty `description` key in the frontmatter, so every
 * registry entry shows up nicely on the site. Uses JSON quoting, which is
 * always a valid single-line YAML scalar.
 */
function ensureDescription(frontmatter: string[], description: string): string[] {
	const line = `description: ${JSON.stringify(description)}`;
	const idx = frontmatter.findIndex((l) => /^description\s*:/.test(l));
	if (idx === -1) return [line, ...frontmatter];
	const value = frontmatter[idx].slice(frontmatter[idx].indexOf(":") + 1).trim();
	if (value === "" || value === '""' || value === "''") {
		const out = [...frontmatter];
		out[idx] = line;
		return out;
	}
	return frontmatter;
}

/** Add `https://` when the user forgot the scheme; otherwise validate. */
function normalizeRepo(raw: string, errors: string[]): string {
	const t = raw.trim();
	if (!t) return "";
	const candidate = /^https?:\/\//i.test(t) ? t : `https://${t}`;
	try {
		new URL(candidate);
		return candidate;
	} catch {
		errors.push(
			`\`source repository\` must be a valid URL (I tried adding https://): ${t}`,
		);
		return "";
	}
}

/* ------------------------------------------------------------------ */
/* Writing + validation                                                */
/* ------------------------------------------------------------------ */

function writeSubmission(
	rootDir: string,
	name: string,
	submission: { content: string; metadataYaml: string },
): void {
	const targetDir = path.join(rootDir, name);
	fs.mkdirSync(targetDir, { recursive: true });
	fs.writeFileSync(path.join(targetDir, "context.md"), submission.content);
	fs.writeFileSync(path.join(targetDir, "metadata.yml"), submission.metadataYaml);
}

/** Validate the whole registry — same check as CI and the site build. */
function checkRegistry(rootDir: string): void {
	const { errors } = loadRegistry(rootDir);
	if (errors.length > 0) fail("the registry rejected the submission", errors);
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
