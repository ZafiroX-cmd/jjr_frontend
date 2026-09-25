import { useState } from "react";
import { AlertCircle, CheckCircle2, ChevronRight, Edit3, RefreshCw, UserPlus, X } from "lucide-react";
import { useUsuarios } from "../hooks/useUsuarios";
import { UsuarioModal } from "../components/usuarios/UsuarioModal";
import type { Usuario } from "../types/usuario";

export default function UsuariosPage() {
  const { usuarios, oficinas, loading, error, reload, crearUsuario, actualizarUsuario } = useUsuarios();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);
  const [successMsg, setSuccessMsg] = useState("");

  const handleEdit = (usuario: Usuario) => {
    setSelectedUser(usuario);
    setModalOpen(true);
  };

  const handleCreateNew = () => {
    setSelectedUser(null);
    setModalOpen(true);
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-4 font-sans text-[#062443] sm:p-6 xl:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 flex items-center gap-1 text-xs text-slate-500">
            Gestión humana <ChevronRight size={13} /> Usuarios & Acceso
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Personal de Sistema & Recepcionistas</h1>
          <p className="mt-2 text-sm text-slate-500">
            Administra las credenciales, contraseñas y asignación de oficinas para el personal de counter.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreateNew}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#075BC6] px-4 py-3 text-sm font-semibold text-white shadow-sm transition duration-300 hover:bg-[#062443]"
        >
          <UserPlus size={18} /> Registrar Recepcionista / Usuario
        </button>
      </header>

      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 size={18} />
          <span className="flex-1">{successMsg}</span>
          <button type="button" onClick={() => setSuccessMsg("")} className="p-1"><X size={16} /></button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-bold">Usuarios con Acceso</h2>
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold hover:bg-blue-50"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Actualizar
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Nombre Completo</th>
                <th className="px-5 py-3.5">Usuario (Login)</th>
                <th className="px-5 py-3.5">DNI / Email</th>
                <th className="px-5 py-3.5">Rol</th>
                <th className="px-5 py-3.5">Oficina Asignada</th>
                <th className="px-5 py-3.5">Estado</th>
                <th className="px-5 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usuarios?.map((u) => (
                <tr key={u.usuarioId} className="hover:bg-blue-50/50">
                  <td className="px-5 py-4 font-semibold">{u.nombreCompleto || `${u.nombres} ${u.apellidos}`}</td>
                  <td className="px-5 py-4 font-bold text-slate-700">{u.username}</td>
                  <td className="px-5 py-4 text-slate-500">
                    {u.dni || "—"} {u.email ? `· ${u.email}` : ""}
                  </td>
                  <td className="px-5 py-4 font-bold text-[#075BC6]">{u.rol}</td>
                  <td className="px-5 py-4 font-medium">
                    {u.oficinaNombre || (u.oficinaId ? `Oficina ${u.oficinaId}` : "— (Todas / Admin)")}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${u.activo ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
                      {u.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleEdit(u)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-semibold text-[#075BC6] hover:bg-blue-50"
                    >
                      <Edit3 size={14} /> Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <UsuarioModal
        open={modalOpen}
        usuarioToEdit={selectedUser}
        oficinas={oficinas}
        onClose={() => setModalOpen(false)}
        onSubmit={async (data) => {
          if (selectedUser) {
            await actualizarUsuario(selectedUser.usuarioId, data);
            setSuccessMsg(`Usuario '${data.username}' actualizado correctamente.`);
          } else {
            await crearUsuario(data);
            setSuccessMsg("Usuario registrado correctamente.");
          }
        }}
      />
    </div>
  );
}