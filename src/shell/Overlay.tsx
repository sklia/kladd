import type { ReactNode } from "react";

/** Centered overlay panel: backdrop, Esc to close, pop-in motion.
 * Shared by the quick switcher and the settings panel. */
export function Overlay({
  onClose,
  className,
  children,
}: {
  onClose: () => void;
  className: string;
  children: ReactNode;
}) {
  return (
    <>
      <div className="menu-backdrop" onClick={onClose} />
      <div
        className={`overlay-panel ${className}`}
        role="dialog"
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        {children}
      </div>
    </>
  );
}
