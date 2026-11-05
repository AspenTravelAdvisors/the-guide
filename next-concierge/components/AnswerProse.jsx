// One string of answer prose, with its supplier links.
//
// `answerBody` (lib/seo/answer-facts.js) resolves `{{op:…}}` and `{{brand:…}}`
// tokens into link markers; this is the only place those markers are read. A
// string without markers comes back as itself, so every cell and paragraph on
// the answer page can go through here unconditionally.

import Link from "next/link";
import { LINK_MARK_RE } from "@/lib/seo/facts.mjs";

export default function AnswerProse({ text }) {
  if (typeof text !== "string" || !text.includes("\u0001")) return text;
  const out = [];
  let at = 0;
  for (const m of text.matchAll(LINK_MARK_RE)) {
    if (m.index > at) out.push(text.slice(at, m.index));
    out.push(
      <Link key={m.index} href={m[1]}>
        {m[2]}
      </Link>,
    );
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push(text.slice(at));
  return <>{out}</>;
}
