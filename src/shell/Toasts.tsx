import { useEffect, useRef, useState } from "react";
import { useToasts, type Toast } from "../store/toasts.ts";

const INFO_MS = 3500;
const ERROR_MS = 8000;
const EXIT_MS = 150;

function ToastItem({ id, message, kind }: Toast) {
  const dismiss = useToasts((s) => s.dismiss);
  const [leaving, setLeaving] = useState(false);
  const [copied, setCopied] = useState(false);
  // Hover pauses the countdown; remaining time survives enter/leave.
  const remaining = useRef(kind === "error" ? ERROR_MS : INFO_MS);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    startedAt.current = Date.now();
    timer.current = setTimeout(() => setLeaving(true), remaining.current);
    return () => clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    if (!leaving) return;
    clearTimeout(timer.current);
    const t = setTimeout(() => dismiss(id), EXIT_MS);
    return () => clearTimeout(t);
  }, [leaving, dismiss, id]);

  const pause = () => {
    if (leaving) return;
    clearTimeout(timer.current);
    remaining.current -= Date.now() - startedAt.current;
  };
  return (
    <div
      className={`toast ${kind}${leaving ? " leaving" : ""}`}
      onMouseEnter={pause}
      onMouseLeave={() => {
        if (!leaving) {
          startedAt.current = Date.now();
          timer.current = setTimeout(() => setLeaving(true), remaining.current);
        }
      }}
    >
      <span className="toast-dot" aria-hidden="true" />
      <span className="toast-message">{message}</span>
      <span className="toast-actions">
        {kind === "error" && (
          <button
            type="button"
            className="toast-btn"
            title="Copy"
            onClick={() => {
              void navigator.clipboard.writeText(message).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              });
            }}
          >
            {copied ? "✓" : "⧉"}
          </button>
        )}
        <button
          type="button"
          className="toast-btn"
          title="Dismiss"
          onClick={() => setLeaving(true)}
        >
          ×
        </button>
      </span>
    </div>
  );
}

export function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <ToastItem key={t.id} {...t} />
      ))}
    </div>
  );
}
