"use client";

import type { ReactNode } from "react";

type Props = {
  dirty: boolean;
  busy: boolean;
  onSave: () => void | Promise<void>;
  label?: string;
  savedLabel?: string;
  message?: string;
  secondary?: ReactNode;
};

export default function FloatingSaveBar(props: Props) {
  const { dirty, busy, onSave, label = "Save", message, secondary } = props;
  if (!dirty && !busy) return null;

  return (
    <div
      className="floating-save-bar dirty"
      role="status"
      aria-live="polite"
      style={{ position: "sticky", bottom: 16, zIndex: 30 }}
    >
      <div className="floating-save-status">
        <span className="floating-save-dot" />
        <div>
          <strong>{busy ? "Saving…" : "Unsaved changes"}</strong>
          <small>{message || "Save to apply these updates."}</small>
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
