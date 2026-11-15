"use client";

// Sign-in card for the answers editor, or a setup message when it is not
// configured. See app/admin/answers/page.tsx.

import { useState } from "react";
import styles from "./AnswersEditor.module.css";

export default function EditorSignIn({ setupMessage }: { setupMessage?: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/answers/session", {
        method: "POST",
        headers: { "content-type": "application/json", "x-answers-editor": "1" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.reload();
        return;
      }
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Sign-in failed.");
    } catch {
      setError("Could not reach the server.");
    }
    setBusy(false);
  }

  return (
    <div className={styles.signinShell}>
      <form className={styles.signin} onSubmit={submit}>
        <p className={styles.eyebrow}>The Guide</p>
        <h1 className={styles.signinTitle}>Answers editor</h1>
        {setupMessage ? (
          <p className={styles.signinNote}>{setupMessage}</p>
        ) : (
          <>
            <label className={styles.label} htmlFor="answers-editor-password">
              Password
            </label>
            <input
              id="answers-editor-password"
              className={styles.input}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            {error && <p className={styles.signinError}>{error}</p>}
            <button className={styles.primary} type="submit" disabled={busy || !password}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
