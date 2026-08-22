import { create } from "zustand";

export type ToastKind = "error" | "info";

export interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastState {
  toasts: Toast[];
  toast: (message: string, kind?: ToastKind) => void;
  dismiss: (id: number) => void;
}

let nextId = 0;

/** Floating feedback messages, bottom-right. Errors carry longer dwell time
 * and a copy button (see Toasts.tsx). Newest last; the stack caps at five. */
export const useToasts = create<ToastState>()((set) => ({
  toasts: [],
  toast: (message, kind = "error") =>
    set((s) => ({
      toasts: [...s.toasts.slice(-4), { id: ++nextId, message, kind }],
    })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function toastError(message: string) {
  useToasts.getState().toast(message, "error");
}

export function toastInfo(message: string) {
  useToasts.getState().toast(message, "info");
}
