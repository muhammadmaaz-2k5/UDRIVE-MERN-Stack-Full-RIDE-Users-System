import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

let pushFn: ((t: Omit<Toast, "id">) => void) | null = null;

export function toast(type: ToastType, message: string) {
  pushFn?.({ type, message });
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    pushFn = (t) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { ...t, id }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== id));
      }, 4000);
    };
    return () => {
      pushFn = null;
    };
  }, []);

  const dismiss = (id: number) =>
    setToasts((prev) => prev.filter((x) => x.id !== id));

  return createPortal(
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto udrive-fade-in flex items-start gap-3 rounded-xl bg-white px-4 py-3 shadow-floating border border-slate-100 max-w-sm"
        >
          {t.type === "success" && (
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          )}
          {t.type === "error" && (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          )}
          {t.type === "info" && (
            <Info className="w-5 h-5 text-udrive-700 shrink-0 mt-0.5" />
          )}
          <p className="text-sm text-slate-700 flex-1">{t.message}</p>
          <button
            onClick={() => dismiss(t.id)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
