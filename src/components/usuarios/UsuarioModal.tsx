import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { X } from "lucide-react";
import type { OficinaOption, Usuario } from "../../types/usuario";

interface UsuarioModalProps {
  open: boolean;
  usuarioToEdit?: Usuario | null;
  oficinas: OficinaOption[];
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}

const inputStyle =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-[#062443] outline-none transition duration-300 focus:border-[#075BC6] focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:opacity-60";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-[#062443]">{label}</span>
      {children}
    </label>
  );
}

export function UsuarioModal({ open, usuarioToEdit, oficinas, onClose, onSubmit }: UsuarioModalProps) {
  const isEditing = !!usuarioToEdit;
  const [rolSel, setRolSel] = useState("Recepcionista");
  const [oficinaSel, setOficinaSel] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (usuarioToEdit) {
      setRolSel(usuarioToEdit.rol || "Recepcionista");

      // Vincular por ID o por coincidencia de nombre (ej. "TRUJILLO")
      if (usuarioToEdit.oficinaId) {
        setOficinaSel(String(usuarioToEdit.oficinaId));
      } else if (usuarioToEdit.oficinaNombre) {
        const match = oficinas.find(
          (o) => o.nombre.trim().toLowerCase() === usuarioToEdit.oficinaNombre?.trim().toLowerCase()
        );
        setOficinaSel(match ? String(match.oficinaId) : "");
      } else {
        setOficinaSel("");
      }
    } else {
      setRolSel("Recepcionista");
      setOficinaSel(oficinas.length > 0 ? String(oficinas[0].oficinaId) : "");
    }
  }, [usuarioToEdit, open, oficinas]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaveError("");

    const form = new FormData(e.currentTarget);
    const username = String(form.get("username") ?? "").trim();
    const nombres = String(form.get("nombres") ?? "").trim();
    const apellidos = String(form.get("apellidos") ?? "").trim();
    const dni = String(form.get("dni") ?? "").trim() || null;
    const email = String(form.get("email") ?? "").trim() || null;
    const password = String(form.get("password") ?? "").trim();
    const rol = String(form.get("rol") ?? "Recepcionista");
    const oficinaId = oficinaSel ? Number(oficinaSel) : null;
    const activo = form.get("activo") === "true";

    if (!username || !nombres || !apellidos) {
      setSaveError("Completa los campos obligatorios (*).");
      return;
    }

    if (!isEditing && !password) {
      setSaveError("La contraseña es obligatoria para un nuevo usuario.");
      return;
    }

    if (rol === "Recepcionista" && !oficinaId) {
      setSaveError("Es obligatorio asignar una oficina a los recepcionistas.");
      return;
    }

    setSaving(true);
    try {
      if (isEditing) {
        await onSubmit({
          username,
          nombres,
          apellidos,
          dni,
          email,
          nuevaPassword: password || null,
          rol,
          oficinaId,
          activo,
        });
      } else {
        await onSubmit({
          username,
          nombres,
          apellidos,
          dni,
          email,
          passwordHash: password,
          rol,
          oficinaId,
        });
      }
      onClose();
    } catch (cause: any) {
      setSaveError(cause?.response?.data?.mensaje || "Error al procesar usuario.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog open className="fixed inset-0 z-50 m-auto max-h-[90dvh] w-[calc(100%_-_32px)] max-w-lg overflow-y-auto rounded-3xl border-0 bg-white p-6 text-[#062443] shadow-2xl">
      <div className="mb-6 flex items-start justify-between">
        <h2 className="text-xl font-bold">
          {isEditing ? `Editar Usuario (${usuarioToEdit.username})` : "Nuevo Usuario / Recepcionista"}
        </h2>
        <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100">
          <X size={20} />
        </button>
      </div>

      {saveError && <p className="mb-4 rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-700">{saveError}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre de Usuario (Login) *">
            <input name="username" defaultValue={usuarioToEdit?.username} required placeholder="Ej. anatorres" className={inputStyle} />
          </Field>

          <Field label="DNI (Opcional)">
            <input name="dni" defaultValue={usuarioToEdit?.dni || ""} maxLength={8} placeholder="Ej. 72839485" className={inputStyle} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombres *">
            <input name="nombres" defaultValue={usuarioToEdit?.nombres} required placeholder="Ej. Ana Maria" className={inputStyle} />
          </Field>
          <Field label="Apellidos *">
            <input name="apellidos" defaultValue={usuarioToEdit?.apellidos} required placeholder="Ej. Torres Lopez" className={inputStyle} />
          </Field>
        </div>

        <Field label="Correo Electrónico (Opcional)">
          <input name="email" type="email" defaultValue={usuarioToEdit?.email || ""} placeholder="recepcion.trujillo@jjr.pe" className={inputStyle} />
        </Field>

        <Field label={isEditing ? "Nueva Contraseña (Dejar en blanco para mantener la actual)" : "Contraseña *"}>
          <input name="password" type="password" required={!isEditing} placeholder="••••••••" className={inputStyle} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Rol *">
            <select name="rol" value={rolSel} onChange={(e) => setRolSel(e.target.value)} className={inputStyle}>
              <option value="Recepcionista">Recepcionista</option>
              <option value="Gerente">Gerente</option>
              <option value="Administrador">Administrador</option>
            </select>
          </Field>

          <Field label="Oficina *">
            <select
              name="oficinaId"
              value={oficinaSel}
              onChange={(e) => setOficinaSel(e.target.value)}
              disabled={rolSel === "Administrador"}
              required={rolSel === "Recepcionista"}
              className={inputStyle}
            >
              <option value="">{rolSel === "Administrador" ? "Acceso Global (Todas)" : "Selecciona una oficina"}</option>
              {oficinas.map((o) => (
                <option key={o.oficinaId} value={String(o.oficinaId)}>
                  {o.nombre}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {isEditing && (
          <Field label="Estado de Cuenta *">
            <select name="activo" defaultValue={String(usuarioToEdit?.activo ?? true)} className={inputStyle}>
              <option value="true">Activo (Puede iniciar sesión)</option>
              <option value="false">Inactivo (Acceso bloqueado)</option>
            </select>
          </Field>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-[#062443]">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="rounded-xl bg-[#075BC6] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#062443]">
            {saving ? "Guardando…" : isEditing ? "Guardar Cambios" : "Crear Usuario"}
          </button>
        </div>
      </form>
    </dialog>
  );
}