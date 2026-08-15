import { defineCollection } from "astro:content";
import type { Loader } from "astro/loaders";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import {
  FRONTMATTER_RE,
  escapeBareHtml,
  loadRegistry,
  registryEntrySchema,
} from "./registry";

/**
 * Loads every submission from `registry/` into the content layer.
 * Uses the same validation as CI: an invalid registry fails the build.
 * Markdown is pre-rendered via the loader context's `renderMarkdown`, which
 * is what `render(entry)` needs to produce the page body.
 */
const registryLoader = {
  name: "registry-loader",
  load: async ({ store, logger, renderMarkdown }) => {
    const { entries, errors } = loadRegistry(
      path.join(process.cwd(), "registry"),
    );
    if (errors.length > 0) {
      for (const e of errors) logger.error(e);
      throw new Error(`Registry validation failed:\n${errors.join("\n")}`);
    }

    for (const entry of entries) {
      const raw = fs.readFileSync(entry.contextPath, "utf8");
      // Render the body with bare angle brackets escaped: context files may
      // contain literal `<app-name>` / `<template>` which the browser would
      // parse as HTML (truncating the page, and a stored-XSS vector). The
      // frontmatter is left untouched so the parsed YAML data is not mangled.
      const fm = raw.match(FRONTMATTER_RE);
      const markdown = fm
        ? raw.slice(0, fm[0].length) + escapeBareHtml(raw.slice(fm[0].length))
        : escapeBareHtml(raw);
      const rendered = await renderMarkdown(markdown, {
        fileURL: pathToFileURL(entry.contextPath),
      });
      store.set({
        id: entry.id,
        data: { rule: entry.rule, metadata: entry.metadata },
        body: entry.rule.body,
        filePath: path.posix.relative(process.cwd(), entry.contextPath),
        rendered,
      });
    }
  },
} satisfies Loader;

export const collections = {
  registry: defineCollection({
    loader: registryLoader,
    schema: registryEntrySchema,
  }),
};
