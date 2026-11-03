import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToastItem {
  id: number;
  kind: "success" | "error";
  message: string;
}
const ToastContext = createContext<{ toast: (kind: ToastItem["kind"], message: string) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const toast = useCallback((kind: ToastItem["kind"], message: string) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, kind, message }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), kind === "error" ? 6000 : 3000);
  }, []);
  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
        {items.map((i) => (
          <div
            key={i.id}
            role="status"
            className={cn(
              "pointer-events-auto flex animate-fade-in items-start gap-2 rounded-md border bg-card px-3 py-2.5 text-sm shadow-lg",
              i.kind === "success" ? "border-profit/40" : "border-loss/40",
            )}
          >
            {i.kind === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-profit" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-loss" />}
            <span>{i.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx.toast;
}
