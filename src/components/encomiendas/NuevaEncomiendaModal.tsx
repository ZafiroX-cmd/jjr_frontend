import { useState } from 'react';
import { Check, LoaderCircle, PackagePlus, Plus, Search, Trash2 } from 'lucide-react';
import type { CrearEncomiendaDto } from '../../types/encomienda';
import type { RecursosViaje } from '../../types/viaje';

export type TipoComprobante = 'NOTA_DE_VENTA' | 'BOLETA' | 'FACTURA';

interface Props {
  open: boolean;
  recursos: RecursosViaje;
  esAdmin?: boolean; // Permite elegir origen libremente si es true
  oficinaUsuarioNombre?: string; // Nombre de la oficina fija del recepcionista (ej. 'TRUJILLO')
  onClose: () => void;
  onSubmit: (dto: CrearEncomiendaDto) => Promise<void>;
  // Callback para consultar cliente (Local + RENIEC/SUNAT)
  onBuscarCliente?: (documento: string) => Promise<{ nombres: string; telefono?: string } | null>;
}

interface ItemEncomienda {
  id: string;
  cantidad: number;
  descripcion: string;
  pesoKg: number;
  volumenM3?: number;
  monto: number;
}

const inputStyle =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-[#062443] outline-none transition duration-300 focus:border-[#075BC6] focus:bg-white focus:ring-2 focus:ring-blue-100';

export function NuevaEncomiendaModal({
  open,
  recursos,
  esAdmin = false,
  oficinaUsuarioNombre = 'TRUJILLO',
  onClose,
  onSubmit,
  onBuscarCliente,
}: Props) {
  // Estado de Origen: Administrador selecciona libremente; Recepcionista tiene valor fijo
  const [origenNombre, setOrigenNombre] = useState<string>(oficinaUsuarioNombre.toUpperCase());
  const [destinoNombre, setDestinoNombre] = useState<'CHILLIA' | 'DELICIANA' | string>('CHILLIA');
  const [viajeId, setViajeId] = useState<string>('');
  const [tipoComprobante, setTipoComprobante] = useState<TipoComprobante>('BOLETA');
  const [porPagar, setPorPagar] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Estados Formulario Remitente
  const [remitenteDoc, setRemitenteDoc] = useState('');
  const [remitenteNombres, setRemitenteNombres] = useState('');
  const [remitenteTelefono, setRemitenteTelefono] = useState('');
  const [buscandoRemitente, setBuscandoRemitente] = useState(false);

  // Estados Formulario Destinatario
  const [destinatarioDoc, setDestinatarioDoc] = useState('');
  const [destinatarioNombres, setDestinatarioNombres] = useState('');
  const [destinatarioTelefono, setDestinatarioTelefono] = useState('');
  const [buscandoDestinatario, setBuscandoDestinatario] = useState(false);

  // Ítems y Modal Secundario
  const [items, setItems] = useState<ItemEncomienda[]>([]);
  const [showItemModal, setShowItemModal] = useState(false);

  // Formulario de Ítem
  const [cantItem, setCantItem] = useState<number>(1);
  const [descItem, setDescItem] = useState<string>('');
  const [pesoItem, setPesoItem] = useState<number>(0);
  const [volumenItem, setVolumenItem] = useState<number>(0);
  const [montoItem, setMontoItem] = useState<number>(0);

  if (!open) return null;

  // Acceso a la lista de viajes/salidas desde recursos
  const listaViajes: any[] =
    (recursos as any)?.viajes ||
    (recursos as any)?.salidas ||
    (recursos as any)?.salidasProgramadas ||
    (Array.isArray(recursos) ? recursos : []);

  // Filtrado flexible por origen y destino
  const viajesDisponibles = listaViajes.filter((v: any) => {
    const orig = String(
      v.oficinaOrigenNombre || v.origenNombre || v.rutaOrigen || v.origen || v.oficinaOrigen || ''
    ).toUpperCase();

    const dest = String(
      v.oficinaDestinoNombre || v.destinoNombre || v.rutaDestino || v.destino || v.oficinaDestino || ''
    ).toUpperCase();

    const coincideOrigen = !orig || orig.includes(origenNombre) || origenNombre.includes(orig);
    const coincideDestino = !dest || dest.includes(destinoNombre) || destinoNombre.includes(dest);

    return coincideOrigen && coincideDestino;
  });

  // Opciones a desplegar (con respaldo si no hay coincidencia estricta)
  const opcionesAEnviar = viajesDisponibles.length > 0 ? viajesDisponibles : listaViajes;

  // Función para buscar documento (DNI/RUC) usando el callback
  const handleBuscarDocumento = async (tipo: 'remitente' | 'destinatario') => {
    const doc = tipo === 'remitente' ? remitenteDoc.trim() : destinatarioDoc.trim();
    if (!doc || (doc.length !== 8 && doc.length !== 11)) return;

    if (tipo === 'remitente') setBuscandoRemitente(true);
    else setBuscandoDestinatario(true);

    try {
      if (onBuscarCliente) {
        const resultado = await onBuscarCliente(doc);
        if (resultado) {
          if (tipo === 'remitente') {
            setRemitenteNombres(resultado.nombres);
            if (resultado.telefono) setRemitenteTelefono(resultado.telefono);
          } else {
            setDestinatarioNombres(resultado.nombres);
            if (resultado.telefono) setDestinatarioTelefono(resultado.telefono);
          }
        }
      }
    } catch (err) {
      console.error('Error al consultar documento:', err);
    } finally {
      if (tipo === 'remitente') setBuscandoRemitente(false);
      else setBuscandoDestinatario(false);
    }
  };

  // --- CÁLCULOS SEGÚN COMPROBANTE ---
  const total = items.reduce((acc, it) => acc + it.monto, 0);
  const esComprobanteOficial = tipoComprobante === 'BOLETA' || tipoComprobante === 'FACTURA';

  // Boleta / Factura: El precio ingresado incluye el 18% IGV
  const subtotal = esComprobanteOficial ? total / 1.18 : total;
  const igv = esComprobanteOficial ? total - subtotal : 0;

  const pesoTotal = items.reduce((acc, it) => acc + it.pesoKg, 0);
  const cantidadTotalBultos = items.reduce((acc, it) => acc + it.cantidad, 0);

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!descItem.trim() || montoItem <= 0) return;

    const newItem: ItemEncomienda = {
      id: crypto.randomUUID(),
      cantidad: cantItem,
      descripcion: descItem.trim(),
      pesoKg: pesoItem,
      volumenM3: volumenItem,
      monto: montoItem,
    };

    setItems([...items, newItem]);
    setCantItem(1);
    setDescItem('');
    setPesoItem(0);
    setVolumenItem(0);
    setMontoItem(0);
    setShowItemModal(false);
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((it) => it.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg('');

    if (items.length === 0) {
      setErrorMsg('Debes agregar al menos un ítem a la encomienda.');
      return;
    }

    if (!viajeId) {
      setErrorMsg('Selecciona el carro programado para el envío.');
      return;
    }

    if (tipoComprobante === 'FACTURA' && remitenteDoc.length !== 11) {
      setErrorMsg('Para emitir Factura de Venta se requiere un RUC válido de 11 dígitos en el Remitente.');
      return;
    }

    const resumenDescripcion = items
      .map((it) => `${it.cantidad}x ${it.descripcion}`)
      .join(', ');

    const oficinaOrigen =
      recursos.oficinas?.find((o) => o.nombre.toUpperCase().includes(origenNombre))?.oficinaId || 1;
    const oficinaDestino =
      recursos.oficinas?.find((o) => o.nombre.toUpperCase().includes(destinoNombre))?.oficinaId || 2;

    setSaving(true);
    try {
      await onSubmit({
        oficinaOrigenId: oficinaOrigen,
        oficinaDestinoId: oficinaDestino,
        viajeId,
        tipoComprobante,
        remitenteDocumento: remitenteDoc,
        remitenteNombres,
        remitenteTelefono,
        destinatarioDocumento: destinatarioDoc,
        destinatarioNombres,
        destinatarioTelefono,
        descripcion: resumenDescripcion,
        cantidadPaquetes: cantidadTotalBultos,
        pesoKg: pesoTotal,
        precioEnvio: total,
        porPagar,
        observaciones: '',
      } as any);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.mensaje || 'Error al registrar encomienda.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <dialog open className="fixed inset-0 z-50 m-auto max-h-[95dvh] w-[calc(100%_-_32px)] max-w-4xl overflow-y-auto rounded-3xl border-0 bg-white p-6 text-[#062443] shadow-2xl sm:p-8">
      {/* Header Modal */}
      <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-blue-50 p-2 text-[#075BC6]">
            <PackagePlus size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold">Registrar Encomienda</h2>
            <p className="text-xs text-slate-500">
              {esAdmin ? 'Modo Administrador (Origen libre)' : `Sede actual: ${origenNombre}`}
            </p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">✕</button>
      </div>

      {errorMsg && <p className="mb-3 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">{errorMsg}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Comprobante, Origen, Destino y Carro Programado */}
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Tipo Comprobante *</label>
            <select
              value={tipoComprobante}
              onChange={(e) => setTipoComprobante(e.target.value as TipoComprobante)}
              className={`${inputStyle} font-semibold text-[#075BC6] bg-blue-50/50`}
            >
              <option value="BOLETA">Boleta de Venta</option>
              <option value="FACTURA">Factura de Venta</option>
              <option value="NOTA_DE_VENTA">Nota de Venta</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Origen *</label>
            {esAdmin ? (
              <select
                value={origenNombre}
                onChange={(e) => {
                  setOrigenNombre(e.target.value);
                  setViajeId('');
                }}
                className={inputStyle}
              >
                {recursos?.oficinas?.map((of) => (
                  <option key={of.oficinaId} value={of.nombre.toUpperCase()}>
                    {of.nombre}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={origenNombre}
                disabled
                className={`${inputStyle} cursor-not-allowed bg-slate-200/60 font-bold text-slate-600`}
              />
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Destino *</label>
            <select
              value={destinoNombre}
              onChange={(e) => {
                setDestinoNombre(e.target.value);
                setViajeId('');
              }}
              className={inputStyle}
            >
              <option value="CHILLIA">CHILLIA</option>
              <option value="DELICIANA">DELICIANA</option>
              <option value="TRUJILLO">TRUJILLO</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Carro Programado *</label>
            <select
              value={viajeId}
              onChange={(e) => setViajeId(e.target.value)}
              required
              className={inputStyle}
            >
              <option value="">-- Seleccionar --</option>
              {opcionesAEnviar.map((v: any, idx: number) => {
                const id = v.viajeId || v.salidaId || v.id || idx;
                const hora = v.fechaHoraSalida || v.horaSalida || v.fecha || '';
                const placa = v.vehiculoPlaca || v.placa || v.vehiculo?.placa || 'Sin Placa';
                const conductor = v.conductorNombre || v.conductor || v.chofer || '';

                return (
                  <option key={id} value={id}>
                    {hora ? `${hora} · ` : ''}Placa: {placa} {conductor ? `(${conductor})` : ''}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Datos Remitente / Destinatario con Búsqueda DNI/RUC */}
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Remitente */}
          <div className="space-y-2 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3">
            <p className="text-xs font-bold text-[#075BC6]">
              Datos del Remitente {tipoComprobante === 'FACTURA' && '(Emisor RUC)'}
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              <div>
                <label className="block text-[10px] font-medium">
                  {tipoComprobante === 'FACTURA' ? 'RUC *' : 'DNI / RUC *'}
                </label>
                <div className="relative flex items-center">
                  <input
                    value={remitenteDoc}
                    onChange={(e) => setRemitenteDoc(e.target.value)}
                    onBlur={() => handleBuscarDocumento('remitente')}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleBuscarDocumento('remitente'))}
                    required
                    placeholder={tipoComprobante === 'FACTURA' ? '11 dígitos' : '8 u 11 dígitos'}
                    className={`${inputStyle} pr-8`}
                  />
                  <button
                    type="button"
                    onClick={() => handleBuscarDocumento('remitente')}
                    className="absolute right-2 text-slate-400 hover:text-[#075BC6]"
                  >
                    {buscandoRemitente ? (
                      <LoaderCircle size={13} className="animate-spin text-[#075BC6]" />
                    ) : (
                      <Search size={13} />
                    )}
                  </button>
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-medium">
                  {tipoComprobante === 'FACTURA' ? 'Razón Social *' : 'Nombres / Razón Social *'}
                </label>
                <input
                  value={remitenteNombres}
                  onChange={(e) => setRemitenteNombres(e.target.value)}
                  required
                  placeholder="Nombre o Razón Social"
                  className={inputStyle}
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-medium">Teléfono *</label>
              <input
                value={remitenteTelefono}
                onChange={(e) => setRemitenteTelefono(e.target.value)}
                required
                placeholder="987654321"
                className={inputStyle}
              />
            </div>
          </div>

          {/* Destinatario */}
          <div className="space-y-2 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3">
            <p className="text-xs font-bold text-[#075BC6]">Datos del Destinatario</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <div>
                <label className="block text-[10px] font-medium">DNI / RUC *</label>
                <div className="relative flex items-center">
                  <input
                    value={destinatarioDoc}
                    onChange={(e) => setDestinatarioDoc(e.target.value)}
                    onBlur={() => handleBuscarDocumento('destinatario')}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleBuscarDocumento('destinatario'))}
                    required
                    placeholder="8 u 11 dígitos"
                    className={`${inputStyle} pr-8`}
                  />
                  <button
                    type="button"
                    onClick={() => handleBuscarDocumento('destinatario')}
                    className="absolute right-2 text-slate-400 hover:text-[#075BC6]"
                  >
                    {buscandoDestinatario ? (
                      <LoaderCircle size={13} className="animate-spin text-[#075BC6]" />
                    ) : (
                      <Search size={13} />
                    )}
                  </button>
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-medium">Nombres / Razón Social *</label>
                <input
                  value={destinatarioNombres}
                  onChange={(e) => setDestinatarioNombres(e.target.value)}
                  required
                  placeholder="Nombre completo"
                  className={inputStyle}
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-medium">Teléfono *</label>
              <input
                value={destinatarioTelefono}
                onChange={(e) => setDestinatarioTelefono(e.target.value)}
                required
                placeholder="987654321"
                className={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* Tabla de Ítems / Mercadería */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Ítems</h3>
            <button
              type="button"
              onClick={() => setShowItemModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Plus size={14} /> Agregar Encomienda
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-slate-50 text-slate-500">
                <tr>
                  <th className="p-2">Cantidad</th>
                  <th className="p-2">Descripción</th>
                  <th className="p-2 text-right">Peso</th>
                  <th className="p-2 text-right">Volumen</th>
                  <th className="p-2 text-right">Monto</th>
                  <th className="p-2 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No hay datos
                    </td>
                  </tr>
                ) : (
                  items.map((it) => (
                    <tr key={it.id}>
                      <td className="p-2 font-medium">{it.cantidad}</td>
                      <td className="p-2">{it.descripcion}</td>
                      <td className="p-2 text-right">{it.pesoKg} kg</td>
                      <td className="p-2 text-right">{it.volumenM3 || 0} m³</td>
                      <td className="p-2 text-right font-semibold">S/ {it.monto.toFixed(2)}</td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(it.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Totales adaptados según Comprobante */}
          <div className="mt-4 flex flex-wrap items-end justify-between border-t border-slate-100 pt-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Peso Acumulado:</span>
                <input
                  readOnly
                  value={`${pesoTotal} kg`}
                  className="w-24 rounded-lg border border-slate-200 bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 pt-1 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={porPagar}
                  onChange={(e) => setPorPagar(e.target.checked)}
                  className="size-4 rounded border-slate-300 text-[#075BC6]"
                />
                Pago Contra Entrega (Por pagar en destino)
              </label>
            </div>

            <div className="space-y-1 text-right text-xs">
              <div className="flex justify-between gap-6 text-slate-500">
                <span>Subtotal</span>
                <span>S/ {subtotal.toFixed(2)}</span>
              </div>

              {esComprobanteOficial && (
                <div className="flex justify-between gap-6 text-slate-500">
                  <span>IGV (18%)</span>
                  <span>S/ {igv.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between gap-6 pt-1 text-sm font-bold text-[#062443]">
                <span>Total</span>
                <span>S/ {total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-[#062443]">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#075BC6] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#062443]">
            {saving ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />}
            {saving ? 'Guardando…' : 'Emitir Guía de Encomienda'}
          </button>
        </div>
      </form>

      {/* Modal Agregar Ítem */}
      {showItemModal && (
        <dialog open className="fixed inset-0 z-50 m-auto w-full max-w-md rounded-2xl border-0 bg-white p-6 shadow-2xl">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#062443]">Agregar Nuevo Ítem</h3>
            <button type="button" onClick={() => setShowItemModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
          </div>

          <form onSubmit={handleAddItem} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600">Cantidad *</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={cantItem}
                  onChange={(e) => setCantItem(Number(e.target.value))}
                  placeholder="Ingrese cantidad"
                  className={inputStyle}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600">Peso (kg) *</label>
                <input
                  type="number"
                  step="any"
                  min={0}
                  required
                  value={pesoItem || ''}
                  onChange={(e) => setPesoItem(Number(e.target.value))}
                  placeholder="Ingrese peso"
                  className={inputStyle}
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600">Descripción *</label>
              <input
                required
                value={descItem}
                onChange={(e) => setDescItem(e.target.value)}
                placeholder="Ingrese descripción (Ej. CAJA, FIERRO)"
                className={inputStyle}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600">Volumen (m3)</label>
                <input
                  type="number"
                  step="any"
                  min={0}
                  value={volumenItem || ''}
                  onChange={(e) => setVolumenItem(Number(e.target.value))}
                  placeholder="Ingrese volumen"
                  className={inputStyle}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600">Monto (S/) *</label>
                <input
                  type="number"
                  step="any"
                  min={0.1}
                  required
                  value={montoItem || ''}
                  onChange={(e) => setMontoItem(Number(e.target.value))}
                  placeholder="Ingrese monto"
                  className={inputStyle}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setShowItemModal(false)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Agregar Ítem
              </button>
            </div>
          </form>
        </dialog>
      )}
    </dialog>
  );
}