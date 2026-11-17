// next/font crashes the production build when Google Fonts answers 200 with an
// extensionless /l/font?kit= URL. The file is still WOFF2 — Next's Chrome
// user agent asks for that — but the loader does:
//
//   /\.(woff|woff2|eot|ttf|otf)$/.exec(url)[1]
//
// and throws `Cannot read properties of null (reading '1')`. Next only retries
// transport errors, so a 200 of this shape fails the deploy. vercel/next.js#99114.
// The fix is in Next 16 and not in 15.5.29, which is what this app builds with.
//
// Runs from postinstall, including on Vercel, and does nothing once the
// installed Next already contains the fix.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const loaderPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../node_modules/next/dist/compiled/@next/font/dist/google/loader.js",
);

const buggy =
  "const ext = /\\.(woff|woff2|eot|ttf|otf)$/.exec(googleFontFileUrl)[1];";
const fixed =
  "const ext = /\\.(woff|woff2|eot|ttf|otf)$/.exec(String(googleFontFileUrl).split(/[?#]/, 1)[0])?.[1] || 'woff2';";

let source;
try {
  source = readFileSync(loaderPath, "utf8");
} catch {
  // next is not installed (a partial install). Nothing to patch.
  process.exit(0);
}

if (source.includes(fixed)) {
  process.exit(0);
}
if (!source.includes(buggy)) {
  process.exit(0);
}

writeFileSync(loaderPath, source.replace(buggy, fixed));
