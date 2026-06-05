import { CheckCircle2, Info, TriangleAlert, X, XCircle } from "lucide-react";
import type { ToastMessage } from "../types";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";

interface ToastStackProps {
  items: ToastMessage[];
  onDismiss: (id: string) => void;
}

const iconMap = {
  success: CheckCircle2,
  error: XCircle,
  warning: TriangleAlert,
  info: Info
};

const toneMap = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  error: "border-red-200 bg-red-50 text-red-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  info: "border-sky-200 bg-sky-50 text-sky-700"
};

export function ToastStack({ items, onDismiss }: ToastStackProps) {
  return (
    <div className="fixed right-4 top-4 z-50 grid w-[min(360px,calc(100vw-32px))] gap-2">
      {items.map((toast) => {
        const Icon = iconMap[toast.type];
        return (
          <div
            key={toast.id}
            className={cn("animate-message-in rounded-lg border p-3 shadow-soft", toneMap[toast.type])}
          >
            <div className="flex items-start gap-3">
              <Icon className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-5">{toast.title}</p>
                {toast.description ? <p className="mt-1 text-xs leading-[1.4] opacity-90">{toast.description}</p> : null}
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDismiss(toast.id)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
