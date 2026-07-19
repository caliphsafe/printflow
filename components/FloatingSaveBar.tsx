"use client";

import type { ReactNode } from "react";

export default function FloatingSaveBar({
  dirty,
  busy,
  onSave,
  label = "Save",
  savedLabel = "Saved",
  message,
  secondary
}: {
  dirty: boolean;
  busy: boolean;
  onSave: () => void | Promise<void>;
  label?: string;
  savedLabel?: string;
  message?: string;
  secondary?: ReactNode;
}) {
  return (
    <div className={dirty ? "floating-save-bar dirty" : "floating-save-bar"} role="status" aria-live="polite">
      <div className="floating-save-status">
        <span className="floating-save-dot" />
        <div>
          <strong>{dirty ? "Unsaved changes" : savedLabel}</strong>
          <small>{message || (dirty ? "Save to apply these updates." : "Everything is up to date.")}</small>
        </div>
      </div>
      <div className="floating-save-actions">
        {secondary}
        <button type="button" className="floating-save-button" disabled={!dirty || busy} onClick={() => void onSave()}>
          {busy ? "Saving…" : label}
        </button>
      </div>
    </div>
  );
}
