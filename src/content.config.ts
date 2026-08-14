import { defineCollection } from "astro:content";
import type { Loader } from "astro/loaders";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { loadRegistry, registryEntrySchema } from "./registry";

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
      const rendered = await renderMarkdown(
        fs.readFileSync(entry.contextPath, "utf8"),
        { fileURL: pathToFileURL(entry.contextPath) },
      );
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
