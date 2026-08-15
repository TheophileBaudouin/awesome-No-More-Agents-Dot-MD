/**
 * Shared registry logic: loads, parses and validates every submission in
 * `registry/`. Used by both the Astro content collection (site build) and the
 * CI validation script, one source of truth, no duplication.
 *
 * The `context.md` validation mirrors the extension's own loader
 * (No-More-Agents-Dot-MD, `.pi/extensions/context-engine/engine.ts`):
 * required keys, valid events/actions and the event × action compatibility
 * matrix. A file that would be rejected here would also be ignored (with an
 * error) by the extension.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

export const VALID_EVENTS: string[] = [
	"before_agent_start",
	"tool_call",
	"tool_result",
	"input",
	"user_bash",
	"session_before_switch",
	"session_before_fork",
];

export const VALID_ACTIONS: string[] = [
	"inject",
	"confirm",
	"block",
	"modify",
	"tools",
	"notify",
	"transform",
	"handled",
	"annotate",
];

/** Event → allowed action types (same matrix as the extension). */
export const EVENT_ACTIONS: Record<string, string[]> = {
	before_agent_start: ["inject", "tools", "notify"],
	tool_call: ["block", "confirm", "modify", "inject", "tools", "notify"],
	tool_result: ["annotate", "inject", "notify"],
	input: ["transform", "handled", "tools", "notify"],
	user_bash: ["block", "confirm", "modify", "notify"],
	session_before_switch: ["confirm", "block", "notify"],
	session_before_fork: ["confirm", "block", "notify"],
};

export const CATEGORIES = [
	"workflow",
	"security",
	"ui",
	"prompting",
	"tooling",
	"other",
] as const;

/** Human-friendly labels for events and actions (UI display only). */
export const EVENT_LABELS: Record<string, string> = {
	before_agent_start: "Before agent start",
	tool_call: "Tool call",
	tool_result: "Tool result",
	input: "User input",
	user_bash: "User bash",
	session_before_switch: "Before session switch",
	session_before_fork: "Before session fork",
};

export const ACTION_LABELS: Record<string, string> = {
	inject: "Injects context",
	confirm: "Asks to confirm",
	block: "Blocks",
	modify: "Modifies",
	tools: "Adjusts tools",
	notify: "Notifies",
	transform: "Transforms",
	handled: "Handles",
	annotate: "Annotates",
};

export const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** Kebab-case: lowercase letters, digits and single hyphens. */
const DIR_NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface RuleAction {
	type: string;
	[key: string]: unknown;
}

/**
 * Escape `<`, `>` and `&` that appear as raw HTML outside code spans and
 * fenced code blocks. Context files are agent instructions that may contain
 * literal angle brackets (`create <app-name> -t <template>`); passed through
 * unescaped, the browser parses them as elements — `<template>` swallows the
 * rest of the page — and they are a stored-XSS vector. Code spans and fences
 * are left untouched because the markdown renderer already escapes those
 * (escaping again would double-escape); blockquote markers (`>` at line
 * start) are preserved.
 */
export function escapeBareHtml(md: string): string {
	const escape = (s: string) =>
		s.replace(/[&<>]/g, (c) =>
			c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;",
		);

	const escapeInline = (line: string): string => {
		// Keep blockquote markers (`> ` prefixes) unescaped.
		let prefix = "";
		let rest = line;
		while (rest.startsWith(">")) {
			prefix += ">";
			if (rest[1] === " ") {
				prefix += " ";
				rest = rest.slice(2);
			} else {
				rest = rest.slice(1);
			}
		}
		// Split on backtick runs; alternate text/code segments.
		const parts = rest.split(/(`+)/);
		let isCode = false;
		let result = "";
		for (const part of parts) {
			if (part === "") continue;
			if (/^`+$/.test(part)) {
				isCode = !isCode;
				result += part;
			} else {
				result += isCode ? part : escape(part);
			}
		}
		return prefix + result;
	};

	const lines = md.split("\n");
	const out: string[] = [];
	let fence: string | null = null; // backtick or tilde while inside a fence
	for (const line of lines) {
		if (fence) {
			out.push(line);
			if (new RegExp(`^\\${fence}{3,}\\s*$`).test(line)) fence = null;
			continue;
		}
		const open = line.match(/^(`{3,}|~{3,})/);
		if (open) {
			fence = open[1][0];
			out.push(line);
			continue;
		}
		out.push(escapeInline(line));
	}
	return out.join("\n");
}

export interface Rule {
	name: string;
	description: string;
	events: string[];
	match?: Record<string, unknown>;
	action: RuleAction;
	priority: number; // 3 = high, 2 = normal, 1 = low
	body: string;
}

export interface RegistryMetadata {
	author: string;
	category: (typeof CATEGORIES)[number];
	tags: string[];
	repo?: string;
	minPiVersion?: string;
}

export interface RegistryEntry {
	/** Directory name inside `registry/`, must equal `rule.name`. */
	id: string;
	rule: Rule;
	metadata: RegistryMetadata;
	contextPath: string;
}

export const metadataSchema = z
	.object({
		author: z.string().min(1, "`author` is required"),
		category: z.enum(CATEGORIES, {
			error: "`category` must be one of: " + CATEGORIES.join(", "),
		}),
		tags: z.array(z.string()).default([]),
		repo: z.string().url("`repo` must be a valid URL").optional(),
		min_pi_version: z
			.string()
			.min(1, "`min_pi_version` must be a non-empty string")
			.optional(),
	})
	.passthrough(); // unknown keys tolerated, like the extension

export const ruleSchema = z.object({
	name: z.string().min(1),
	description: z.string(),
	events: z.array(z.string()).min(1),
	match: z.record(z.string(), z.unknown()).optional(),
	action: z.record(z.string(), z.unknown()),
	priority: z.number().int().min(1).max(3),
});

export const registryEntrySchema = z.object({
	rule: ruleSchema,
	metadata: metadataSchema,
});

/**
 * Parse and validate the frontmatter of a `context.md` file.
 * Replicates the extension's checks; throws with a human-readable message.
 */
export function parseContextFile(raw: string): Rule {
	const m = raw.match(FRONTMATTER_RE);
	if (!m) {
		throw new Error(
			"missing frontmatter (a file without frontmatter is inert documentation)",
		);
	}

	let meta: unknown;
	try {
		meta = parseYaml(m[1]);
	} catch (e) {
		throw new Error(`invalid YAML frontmatter: ${(e as Error).message}`);
	}
	if (!meta || typeof meta !== "object") {
		throw new Error("frontmatter must be a YAML map");
	}
	const fm = meta as Record<string, unknown>;

	const name = fm.name;
	if (typeof name !== "string" || !name) {
		throw new Error(`missing "name"`);
	}

	const events = fm.events;
	if (!Array.isArray(events) || events.length === 0) {
		throw new Error(`"events" must be a non-empty list`);
	}

	const action = fm.action as RuleAction | undefined;
	if (
		!action ||
		typeof action !== "object" ||
		typeof action.type !== "string"
	) {
		throw new Error(`missing "action.type"`);
	}
	if (!VALID_ACTIONS.includes(action.type)) {
		throw new Error(
			`unknown action.type "${action.type}" (valid: ${VALID_ACTIONS.join(", ")})`,
		);
	}

	const eventNames = events.map(String);
	for (const e of eventNames) {
		if (!VALID_EVENTS.includes(e)) {
			throw new Error(
				`unknown event "${e}" (valid: ${VALID_EVENTS.join(", ")})`,
			);
		}
	}
	for (const e of eventNames) {
		const allowed = EVENT_ACTIONS[e];
		if (!allowed.includes(action.type)) {
			throw new Error(
				`action "${action.type}" is not allowed for event "${e}" (allowed: ${allowed.join(", ")})`,
			);
		}
	}

	let priority = 2; // normal
	if (fm.priority === "high") priority = 3;
	else if (fm.priority === "low") priority = 1;

	return {
		name,
		description: typeof fm.description === "string" ? fm.description : "",
		events: eventNames,
		match: (fm.match as Record<string, unknown> | undefined) ?? undefined,
		action,
		priority,
		body: raw.slice(m[0].length).trim(),
	};
}

/** Parse and validate a `metadata.yml` file. Throws on invalid input. */
export function parseMetadataFile(raw: string): RegistryMetadata {
	let meta: unknown;
	try {
		meta = parseYaml(raw);
	} catch (e) {
		throw new Error(`invalid YAML: ${(e as Error).message}`);
	}
	if (!meta || typeof meta !== "object") {
		throw new Error("metadata.yml must be a YAML map");
	}

	const parsed = metadataSchema.safeParse(meta);
	if (!parsed.success) {
		throw new Error(
			parsed.error.issues
				.map((i) =>
					i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message,
				)
				.join("; "),
		);
	}

	return {
		author: parsed.data.author,
		category: parsed.data.category,
		tags: parsed.data.tags,
		repo: parsed.data.repo,
		minPiVersion: parsed.data.min_pi_version,
	};
}

/**
 * Walk `registry/`, parse and validate every submission.
 * Returns entries (sorted by id) plus a list of error strings.
 * The registry is valid only when `errors` is empty.
 */
export function loadRegistry(rootDir: string): {
	entries: RegistryEntry[];
	errors: string[];
} {
	const errors: string[] = [];
	const entries: RegistryEntry[] = [];
	const seen = new Set<string>();

	if (!fs.existsSync(rootDir)) return { entries, errors };

	for (const dir of fs.readdirSync(rootDir)) {
		const dirPath = path.join(rootDir, dir);
		if (!fs.statSync(dirPath).isDirectory()) {
			errors.push(`registry/${dir}: expected a directory`);
			continue;
		}

		const id = dir;
		const contextPath = path.join(dirPath, "context.md");
		const metadataPath = path.join(dirPath, "metadata.yml");
		let missing = false;
		if (!fs.existsSync(contextPath)) {
			errors.push(`registry/${id}/context.md is missing`);
			missing = true;
		}
		if (!fs.existsSync(metadataPath)) {
			errors.push(`registry/${id}/metadata.yml is missing`);
			missing = true;
		}
		if (missing) continue;

		let rule: Rule;
		try {
			rule = parseContextFile(fs.readFileSync(contextPath, "utf8"));
		} catch (e) {
			errors.push(`registry/${id}/context.md: ${(e as Error).message}`);
			continue;
		}

		let metadata: RegistryMetadata;
		try {
			metadata = parseMetadataFile(fs.readFileSync(metadataPath, "utf8"));
		} catch (e) {
			errors.push(`registry/${id}/metadata.yml: ${(e as Error).message}`);
			continue;
		}

		if (!DIR_NAME_RE.test(id)) {
			errors.push(
				`registry/${id}: directory name must be kebab-case (lowercase letters, digits, single hyphens)`,
			);
		}
		if (id !== rule.name) {
			errors.push(
				`registry/${id}: directory name must equal the frontmatter "name" (got "${rule.name}")`,
			);
		}
		if (seen.has(rule.name)) {
			errors.push(`registry/${id}: duplicate rule name "${rule.name}"`);
		}
		seen.add(rule.name);

		entries.push({ id, rule, metadata, contextPath });
	}

	entries.sort((a, b) => a.id.localeCompare(b.id));
	return { entries, errors };
}
