import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import axiosClient from "../../api/axiosClient";

const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00A3E0]";

function voucherURL(value: string, base?: string): string | null {
  try {
    const api = new URL(
      base ?? axiosClient.defaults.baseURL ?? "/",
      window.location.origin,
    );
    const url = new URL(value, api.origin);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function RemoteVoucher({
  value,
  base,
}: {
  value: string;
  base?: string;
}) {
  const url = voucherURL(value, base);
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [url]);

  if (!url)
    return (
      <p className="text-xs text-slate-500">
        El enlace del voucher no es válido.
      </p>
    );

  const pdf = /\.pdf(?:[?#]|$)/i.test(url);

  return (
    <div className="space-y-2">
      {!pdf && !failed && (
        <img
          src={url}
          alt="Voucher registrado del pasaje"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="max-h-48 w-full rounded-xl border border-slate-200 bg-white object-contain"
        />
      )}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1 rounded text-xs font-semibold text-[#075BC6] ${focus}`}
      >
        <ExternalLink size={14} aria-hidden="true" />
        {pdf ? "Abrir voucher PDF" : "Abrir voucher"}
      </a>
    </div>
  );
}