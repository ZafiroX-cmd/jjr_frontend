import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";

export function Alert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800"
    >
      <AlertCircle size={18} aria-hidden="true" className="mt-1 shrink-0" />
      <div>{children}</div>
    </div>
  );
}