#!/usr/bin/env node
/**
 * Registry validation, run by CI on every pull request that touches
 * `registry/` (see .github/workflows/validate.yml).
 *
 * Uses the same loader as the site build: an invalid submission fails here
 * and fails the build. Exits non-zero with a per-file error report.
 */

import * as path from "node:path";
import { loadRegistry } from "../src/registry";

const rootDir = path.join(process.cwd(), "registry");
const { entries, errors } = loadRegistry(rootDir);

if (errors.length > 0) {
  console.error(
    `Registry validation failed (${errors.length} error${errors.length === 1 ? "" : "s"}):`,
  );
  for (const e of errors) console.error(`  - ${e}`);
  console.error();
  process.exit(1);
}

console.log(
  `Registry is valid: ${entries.length} context file${entries.length === 1 ? "" : "s"}.`,
);
