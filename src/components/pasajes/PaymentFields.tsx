import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import type { MedioPago, PaymentValue } from "../../types/pasajes.types";
import { Alert } from "../ui/Alert";
import { Field } from "../ui/Field";

const METHODS: MedioPago[] = ["EFECTIVO", "YAPE", "PLIN", "TRANSFERENCIA"];
const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00A3E0]";
const inputClass =
  "w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-[#062443] outline-none transition duration-300 focus:border-[#075BC6] focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500";

export function validateFile(file: File, limit: number): string | null {
  if (!file.size) return "El voucher está vacío.";
  if (file.size > limit)
    return `El voucher no debe superar ${(limit / 1024 / 1024).toFixed(1)} MB.`;
  const image = /^image\/(jpeg|png|webp|gif|avif|bmp|heic|heif)$/i.test(
    file.type,
  );
  const pdf = file.type === "application/pdf";
  const extensionOnly =
    !file.type &&
    /\.(jpe?g|png|webp|gif|avif|bmp|heic|heif|pdf)$/i.test(file.name);
  return image || pdf || extensionOnly
    ? null
    : "Adjunta una imagen (JPG, PNG, WebP, GIF, AVIF, BMP, HEIC) o un PDF.";
}

export function validatePayment(value: PaymentValue, limit: number): string | null {
  if (!METHODS.includes(value.medio))
    return "Selecciona un medio de pago válido.";
  if (value.medio === "EFECTIVO") return null;
  if (!value.file)
    return "Adjunta un voucher para el pago digital, incluso si la reserva tiene adelanto cero.";
  return validateFile(value.file, limit);
}

function FilePreview({ file }: { file: File }) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const pdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      {!pdf && url && (
        <img
          src={url}
          alt="Vista previa del voucher seleccionado"
          className="mb-3 max-h-40 w-full rounded-lg object-contain"
        />
      )}
      <p className="break-all text-xs text-slate-600">
        {file.name} · {(file.size / 1024).toFixed(0)} KB
      </p>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-2 inline-flex items-center gap-1 rounded text-xs font-semibold text-[#075BC6] ${focus}`}
        >
          <FileText size={14} aria-hidden="true" />
          Abrir archivo
        </a>
      )}
    </div>
  );
}

export function PaymentFields({
  value,
  onChange,
  maxBytes,
  withNumber = true,
}: {
  value: PaymentValue;
  onChange: (value: PaymentValue) => void;
  maxBytes: number;
  withNumber?: boolean;
}) {
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!value.file && inputRef.current) inputRef.current.value = "";
  }, [value.file]);

  return (
    <div className="space-y-3">
      <Field label="Medio de pago">
        <select
          value={value.medio}
          onChange={(e) => {
            const medio = e.target.value as MedioPago;
            setError("");
            onChange({
              ...value,
              medio,
              file: medio === "EFECTIVO" ? null : value.file,
            });
          }}
          className={inputClass}
        >
          {METHODS.map((method) => (
            <option key={method}>{method}</option>
          ))}
        </select>
      </Field>

      {withNumber && (
        <Field label="Número de operación (opcional)">
          <input
            value={value.numero}
            maxLength={100}
            onChange={(e) => onChange({ ...value, numero: e.target.value })}
            className={inputClass}
          />
        </Field>
      )}

      {value.medio !== "EFECTIVO" && (
        <div className="space-y-3 rounded-xl border border-dashed border-blue-200 bg-blue-50/50 p-4">
          <Field label="Voucher de pago *">
            <input
              ref={inputRef}
              type="file"
              accept="image/*,.pdf"
              required
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                const issue = file ? validateFile(file, maxBytes) : null;
                setError(issue ?? "");
                onChange({ ...value, file: issue ? null : file });
                if (issue) e.target.value = "";
              }}
              className={`w-full min-w-0 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-[#075BC6] file:px-3 file:py-2 file:text-white ${focus}`}
            />
          </Field>
          <p className="text-[11px] text-slate-500">
            Imagen o PDF · Máximo {(maxBytes / 1024 / 1024).toFixed(1)} MB
          </p>
          {value.file && (
            <>
              <FilePreview file={value.file} />
              <button
                type="button"
                onClick={() => onChange({ ...value, file: null })}
                className={`rounded text-xs text-red-700 underline ${focus}`}
              >
                Quitar voucher
              </button>
            </>
          )}
        </div>
      )}

      {error && <Alert>{error}</Alert>}
    </div>
  );
}