// The answers editor: audit and edit answer pages, held drafts included, and
// save each change as a commit. Signed-in staff only; never indexed.
// See lib/answers-editor/ for how saving and checking work.

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { editorPasswordSet, SESSION_COOKIE, sessionValid } from "@/lib/answers-editor/auth";
import { storeMode } from "@/lib/answers-editor/store";
import AnswersEditor from "@/components/answers-editor/AnswersEditor";
import EditorSignIn from "@/components/answers-editor/EditorSignIn";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Answers editor",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AnswersEditorPage() {
  if (!editorPasswordSet()) {
    return (
      <EditorSignIn
        setupMessage="The editor is not switched on yet. Add ANSWERS_EDITOR_PASSWORD (12 characters or more) and ANSWERS_EDITOR_GITHUB_TOKEN to the project's environment variables in Vercel, then redeploy."
      />
    );
  }
  const jar = await cookies();
  if (!sessionValid(jar.get(SESSION_COOKIE)?.value)) return <EditorSignIn />;
  const mode = storeMode();
  if (!mode) {
    return (
      <EditorSignIn setupMessage="Signed in, but saving is not set up: add ANSWERS_EDITOR_GITHUB_TOKEN to the project's environment variables in Vercel, then redeploy." />
    );
  }
  return <AnswersEditor mode={mode} />;
}
