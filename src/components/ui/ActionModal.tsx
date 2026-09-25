import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00A3E0]";

interface ActionModalProps {
  title: string;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function ActionModal({
  title,
  busy,
  onClose,
  children,
}: ActionModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useId();

  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    
    dialog?.showModal();
    document.body.style.overflow = "hidden";

    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={heading}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (!busy && e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_32px)] max-w-lg overflow-y-auto rounded-3xl border-0 bg-white p-6 text-[#062443] shadow-2xl backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm sm:p-8"
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 id={heading} className="text-xl font-bold">
          {title}
        </h2>
        <button
          type="button"
          aria-label="Cerrar diálogo"
          disabled={busy}
          onClick={onClose}
          className={`rounded-lg p-2 hover:bg-slate-100 ${focus}`}
        >
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  );
}