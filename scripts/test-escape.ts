/**
 * Runnable check for escapeBareHtml. Run with: npx tsx scripts/test-escape.ts
 */
import { strict as assert } from "node:assert";
import { escapeBareHtml } from "../src/registry";

const e = escapeBareHtml;

// Bare angle brackets → escaped (this is the truncation/XSS fix).
assert.equal(
	e("create <app-name> -t <template>"),
	"create &lt;app-name&gt; -t &lt;template&gt;",
);
assert.equal(e("a <b> & c"), "a &lt;b&gt; &amp; c");

// Code spans and fences already get escaped by the renderer → untouched here.
assert.equal(e("run `add <name>`"), "run `add <name>`");
assert.equal(e("```\necho <tag>\n```"), "```\necho <tag>\n```");
assert.equal(e("```bash\necho <tag>\n```"), "```bash\necho <tag>\n```");

// Blockquote markers are preserved (not escaped into &gt;).
assert.equal(e("> quoted <text>"), "> quoted &lt;text&gt;");

// Fence toggle works across multiple lines, both backticks and tildes.
assert.equal(
	e("a\n```\n<keep>\n```\nb <esc>"),
	"a\n```\n<keep>\n```\nb &lt;esc&gt;",
);
assert.equal(e("~~~\n<keep>\n~~~\n"), "~~~\n<keep>\n~~~\n");

// Escaped entities are not double-escaped inside code.
assert.equal(e("`a &lt;b&gt;`"), "`a &lt;b&gt;`");

console.log("escapeBareHtml: all checks passed");
