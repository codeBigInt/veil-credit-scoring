import type { ReactNode } from "react";

type CalloutVariant = "info" | "warning" | "tip";

interface CalloutProps {
  variant?: CalloutVariant;
  title?: string;
  children: ReactNode;
}

const icons: Record<CalloutVariant, ReactNode> = {
  info: (
    <svg className="callout-icon" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 8v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="9" cy="5.5" r="0.75" fill="currentColor" />
    </svg>
  ),
  warning: (
    <svg className="callout-icon" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M9 2L16.5 15H1.5L9 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M9 7v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="9" cy="12.5" r="0.75" fill="currentColor" />
    </svg>
  ),
  tip: (
    <svg className="callout-icon" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M9 2C5.69 2 3 4.69 3 8c0 2.12 1.1 3.98 2.75 5.07V14.5a.5.5 0 00.5.5h5.5a.5.5 0 00.5-.5v-1.43C13.9 11.98 15 10.12 15 8c0-3.31-2.69-6-6-6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M6.5 16.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
};

const defaultTitles: Record<CalloutVariant, string> = {
  info: "Note",
  warning: "Warning",
  tip: "Tip",
};

export default function Callout({ variant = "info", title, children }: CalloutProps) {
  return (
    <div className={`callout ${variant}`} role="note">
      <div style={{ color: "currentColor" }}>{icons[variant]}</div>
      <div className="callout-body">
        <div className="callout-title">{title ?? defaultTitles[variant]}</div>
        <div className="callout-content">{children}</div>
      </div>
    </div>
  );
}
