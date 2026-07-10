import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users, CalendarClock, ClipboardList, FileText, Wallet, ClipboardCheck,
  Truck, Receipt, Plus, X, Search, Pencil, Trash2, Printer, ChevronRight,
  CircleDot, CheckCircle2, XCircle, Clock, AlertTriangle, Save, Building2,
  FileSpreadsheet, Loader2
} from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "./supabaseClient";

/* ---------------------------------------------------------------------- */
/*  SIMECO · GESTIÓN — herramienta interna de comercial y servicio         */
/*  Módulos: Clientes · Agenda · Requerimientos · Cotizaciones ·           */
/*  Centro de Costos · Órdenes de Servicio · Actas de Entrega ·            */
/*  Facturación                                                            */
/* ---------------------------------------------------------------------- */

const STORAGE_KEY = "simeco-gestion-data";

const EMPTY = {
  clients: [],
  agenda: [],
  requirements: [],
  quotations: [],
  costCenters: [],
  serviceOrders: [],
  actas: [],
  invoices: [],
  counters: { cot: 0, cc: 0, os: 0, acta: 0, fact: 0 },
};

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const cop = (n) =>
  (Number(n) || 0).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const todayISO = () => new Date().toISOString().slice(0, 10);
const yy = () => String(new Date().getFullYear()).slice(-2);

const NAV = [
  { key: "clientes", label: "Clientes", icon: Users },
  { key: "agenda", label: "Agenda", icon: CalendarClock },
  { key: "requerimientos", label: "Requerimientos", icon: ClipboardList },
  { key: "cotizaciones", label: "Cotizaciones", icon: FileText },
  { key: "centrocostos", label: "Centro de Costos", icon: Wallet },
  { key: "ordenes", label: "Órdenes de Servicio", icon: ClipboardCheck },
  { key: "actas", label: "Actas de Entrega", icon: Truck },
  { key: "facturacion", label: "Facturación", icon: Receipt },
];

const STATUS_STYLES = {
  Borrador: "bg-slate-100 text-slate-600 border-slate-300",
  Enviada: "bg-sky-50 text-sky-700 border-sky-300",
  Aprobada: "bg-emerald-50 text-emerald-700 border-emerald-300",
  Rechazada: "bg-rose-50 text-rose-700 border-rose-300",
  Vencida: "bg-amber-50 text-amber-700 border-amber-300",
  Pendiente: "bg-slate-100 text-slate-600 border-slate-300",
  Aprobado: "bg-emerald-50 text-emerald-700 border-emerald-300",
  "En ejecución": "bg-sky-50 text-sky-700 border-sky-300",
  Cerrada: "bg-emerald-50 text-emerald-700 border-emerald-300",
  Pagada: "bg-emerald-50 text-emerald-700 border-emerald-300",
  Realizado: "bg-emerald-50 text-emerald-700 border-emerald-300",
};

function Badge({ children }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[children] || "bg-slate-100 text-slate-600 border-slate-300"}`}>
      <CircleDot size={10} strokeWidth={3} />
      {children}
    </span>
  );
}

function Field({ label, children, span }) {
  return (
    <label className={`flex flex-col gap-1 ${span ? "sm:col-span-2" : ""}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#C97A2B] focus:ring-2 focus:ring-[#C97A2B]/20";

function TextInput(props) {
  return <input {...props} className={inputCls + " " + (props.className || "")} />;
}
function TextArea(props) {
  return <textarea {...props} className={inputCls + " min-h-[70px] " + (props.className || "")} />;
}
function Select({ children, ...props }) {
  return (
    <select {...props} className={inputCls}>
      {children}
    </select>
  );
}

function Panel({ title, subtitle, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/40" onClick={onClose}>
      <div
        className={`h-full w-full ${wide ? "max-w-3xl" : "max-w-xl"} overflow-y-auto bg-[#FBFAF8] shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-[#FBFAF8]/95 px-6 py-4 backdrop-blur">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#1B2430]">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-200">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, text, cta, onClick }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white/60 py-16 text-center">
      <Icon size={28} className="text-slate-300" />
      <p className="max-w-xs text-sm text-slate-500">{text}</p>
      {cta && (
        <button onClick={onClick} className="rounded-md bg-[#1B2430] px-4 py-2 text-sm font-medium text-white hover:bg-[#2A3542]">
          {cta}
        </button>
      )}
    </div>
  );
}

function Th({ children }) {
  return <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">{children}</th>;
}
function Td({ children, mono }) {
  return <td className={`px-3 py-2.5 text-sm text-slate-700 ${mono ? "font-mono text-xs" : ""}`}>{children}</td>;
}

function RowActions({ onEdit, onDelete }) {
  return (
    <div className="flex justify-end gap-1">
      {onEdit && (
        <button onClick={onEdit} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800">
          <Pencil size={14} />
        </button>
      )}
      {onDelete && (
        <button onClick={onDelete} className="rounded p-1.5 text-rose-400 hover:bg-rose-50 hover:text-rose-600">
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

/* ----------------------------- LINE ITEMS ------------------------------ */
function LineItems({ label, items, setItems }) {
  const total = items.reduce((s, r) => s + (Number(r.cant) || 0) * (Number(r.valorUnit) || 0), 0);
  const upd = (i, field, val) => {
    const copy = items.map((r, idx) => (idx === i ? { ...r, [field]: val } : r));
    setItems(copy);
  };
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
        <button
          type="button"
          onClick={() => setItems([...items, { desc: "", cant: 1, und: "und", valorUnit: 0 }])}
          className="flex items-center gap-1 text-xs font-medium text-[#C97A2B] hover:underline"
        >
          <Plus size={12} /> Ítem
        </button>
      </div>
      {items.length === 0 && <p className="py-2 text-xs text-slate-400">Sin ítems.</p>}
      <div className="space-y-1.5">
        {items.map((r, i) => (
          <div key={i} className="grid grid-cols-12 gap-1.5">
            <input
              placeholder="Descripción"
              value={r.desc}
              onChange={(e) => upd(i, "desc", e.target.value)}
              className="col-span-5 rounded border border-slate-200 px-2 py-1 text-xs"
            />
            <input
              type="number"
              placeholder="Cant"
              value={r.cant}
              onChange={(e) => upd(i, "cant", e.target.value)}
              className="col-span-2 rounded border border-slate-200 px-2 py-1 text-xs"
            />
            <input
              placeholder="Und"
              value={r.und}
              onChange={(e) => upd(i, "und", e.target.value)}
              className="col-span-2 rounded border border-slate-200 px-2 py-1 text-xs"
            />
            <input
              type="number"
              placeholder="V. Unit"
              value={r.valorUnit}
              onChange={(e) => upd(i, "valorUnit", e.target.value)}
              className="col-span-2 rounded border border-slate-200 px-2 py-1 text-xs"
            />
            <button type="button" onClick={() => setItems(items.filter((_, idx) => idx !== i))} className="col-span-1 text-slate-300 hover:text-rose-500">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-2 text-right text-xs font-semibold text-slate-600">Subtotal: {cop(total)}</div>
    </div>
  );
}

/* ------------------------- ITEMS CON IMPORTAR EXCEL --------------------- */
const ROLES_RECURSO_HUMANO = [
  "Ingeniero de proyectos",
  "Coordinador de proyectos",
  "Supervisor técnico",
  "Técnico electricista",
  "Ayudante electricista",
  "Coordinador EHSQ",
  "Supervisor EHSQ",
  "Rescatista",
  "Almacenista",
  "Delineante Industrial",
];

// Busca la columna correcta sin importar mayúsculas, tildes o el nombre exacto
function encontrarColumnaExcel(fila, posibles) {
  const claves = Object.keys(fila);
  const normalizar = (s) => s.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  for (const posible of posibles) {
    const encontrada = claves.find((k) => normalizar(k).includes(normalizar(posible)));
    if (encontrada) return fila[encontrada];
  }
  return "";
}

// Tabla editable de ítems (descripción, cantidad, unidad/días, observaciones)
// con botón para importar filas desde un Excel/CSV. Se usa en Materiales,
// Mano de obra, Recurso humano y Herramientas de la Requisición.
function ItemsConImportar({ label, items, setItems, unidadLabel = "Und", claveUnidad = "und", claveDescripcion = ["descripcion", "material", "item", "producto"], sugerencias }) {
  const lista = items || [];
  const datalistId = sugerencias ? `sugerencias-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined;
  const [importando, setImportando] = useState(false);
  const [error, setError] = useState("");

  const add = () => setItems([...lista, { desc: "", cant: "", [claveUnidad]: "", obs: "" }]);
  const upd = (i, field, val) => setItems(lista.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)));
  const del = (i) => setItems(lista.filter((_, idx) => idx !== i));

  const importarExcel = async (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setImportando(true);
    setError("");
    try {
      const buffer = await archivo.arrayBuffer();
      const libro = XLSX.read(buffer, { type: "array" });
      const hoja = libro.Sheets[libro.SheetNames[0]];
      const filas = XLSX.utils.sheet_to_json(hoja, { defval: "" });
      if (!filas.length) {
        setError("El archivo no tiene filas de datos legibles.");
        return;
      }
      const nuevas = filas
        .map((fila) => ({
          desc: String(encontrarColumnaExcel(fila, claveDescripcion)),
          cant: String(encontrarColumnaExcel(fila, ["cantidad", "cant"])),
          [claveUnidad]: String(encontrarColumnaExcel(fila, claveUnidad === "dias" ? ["dias", "días"] : ["unidad", "und", "um"])),
          obs: String(encontrarColumnaExcel(fila, ["observaciones", "obs", "nota"])),
        }))
        .filter((r) => r.desc.trim() !== "");
      if (!nuevas.length) {
        setError("No se encontraron columnas de descripción/cantidad reconocibles. Revisa los encabezados del Excel.");
        return;
      }
      const conDatos = lista.filter((r) => (r.desc || "").trim() !== "");
      setItems([...conDatos, ...nuevas]);
    } catch (err) {
      setError("No se pudo leer el archivo. Confirma que sea un .xlsx o .csv válido.");
    } finally {
      setImportando(false);
      e.target.value = "";
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1 text-xs font-medium text-emerald-700 hover:underline">
            {importando ? <Loader2 size={12} className="animate-spin" /> : <FileSpreadsheet size={12} />}
            {importando ? "Leyendo..." : "Importar Excel"}
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={importarExcel} disabled={importando} />
          </label>
          <button type="button" onClick={add} className="flex items-center gap-1 text-xs font-medium text-[#C97A2B] hover:underline">
            <Plus size={12} /> Ítem
          </button>
        </div>
      </div>
      {error && <div className="mb-2 rounded bg-rose-50 px-2 py-1 text-[11px] text-rose-600">{error}</div>}
      {sugerencias && (
        <datalist id={datalistId}>
          {sugerencias.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
      {lista.length === 0 && <p className="py-2 text-xs text-slate-400">Sin ítems.</p>}
      <div className="space-y-1.5">
        {lista.map((r, i) => (
          <div key={i} className="grid grid-cols-12 gap-1.5">
            <input
              placeholder="Descripción"
              value={r.desc || ""}
              onChange={(e) => upd(i, "desc", e.target.value)}
              list={datalistId}
              className="col-span-5 rounded border border-slate-200 px-2 py-1 text-xs"
            />
            <input
              type="number"
              placeholder="Cant"
              value={r.cant || ""}
              onChange={(e) => upd(i, "cant", e.target.value)}
              className="col-span-2 rounded border border-slate-200 px-2 py-1 text-xs"
            />
            <input
              placeholder={unidadLabel}
              value={r[claveUnidad] || ""}
              onChange={(e) => upd(i, claveUnidad, e.target.value)}
              className="col-span-2 rounded border border-slate-200 px-2 py-1 text-xs"
            />
            <input
              placeholder="Observaciones"
              value={r.obs || ""}
              onChange={(e) => upd(i, "obs", e.target.value)}
              className="col-span-2 rounded border border-slate-200 px-2 py-1 text-xs"
            />
            <button type="button" onClick={() => del(i)} className="col-span-1 text-slate-300 hover:text-rose-500">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Convierte un requerimiento (formato local del formulario) a las columnas
// de la tabla requisiciones_cotizacion en Supabase.
function requerimientoAFilaSupabase(r, clientName) {
  return {
    cliente: clientName(r.clientId) !== "—" ? clientName(r.clientId) : "(sin cliente)",
    client_local_id: r.clientId || null,
    fecha_solicitud: r.fecha || null,
    fecha_limite: r.fechaLimite || null,
    solicitante_nombre: r.personaContacto || null,
    solicitante_correo: r.correoContacto || null,
    solicitante_telefono: r.telefonoContacto || null,
    proyecto: r.proyecto || null,
    servicio: r.servicio || null,
    palabra_clave: r.palabraClave || null,
    alcance: r.alcance || null,
    detalle: r.detalle || null,
    materiales: r.materiales || [],
    mano_obra: r.manoObra || [],
    recurso_humano: r.recursoHumano || [],
    herramientas: r.herramientas || [],
  };
}

// Convierte una fila de Supabase de vuelta al formato local del formulario.
function filaSupabaseARequerimiento(row) {
  return {
    id: row.id,
    clientId: row.client_local_id || "",
    _clienteGuardado: row.cliente || "", // respaldo por si el cliente no existe localmente en este dispositivo
    fecha: row.fecha_solicitud || "",
    fechaLimite: row.fecha_limite || "",
    personaContacto: row.solicitante_nombre || "",
    correoContacto: row.solicitante_correo || "",
    telefonoContacto: row.solicitante_telefono || "",
    proyecto: row.proyecto || "",
    servicio: row.servicio || "",
    palabraClave: row.palabra_clave || "",
    alcance: row.alcance || "",
    detalle: row.detalle || "",
    materiales: row.materiales || [],
    manoObra: row.mano_obra || [],
    recursoHumano: row.recurso_humano || [],
    herramientas: row.herramientas || [],
  };
}

function calcCotizacion(q) {
  const sum = (arr) => (arr || []).reduce((s, r) => s + (Number(r.cant) || 0) * (Number(r.valorUnit) || 0), 0);
  const materiales = sum(q.materiales);
  const equipos = sum(q.equipos);
  const manoObra = sum(q.manoObra);
  const directos =
    materiales + equipos + manoObra + (Number(q.alimentacionHospedaje) || 0) + (Number(q.transportePersonal) || 0) + (Number(q.transporteMateriales) || 0);
  const indirectos = directos * ((Number(q.costosIndirectosPct) || 0) / 100);
  const sub1 = directos + indirectos;
  const financieros = sub1 * ((Number(q.costosFinancierosPct) || 0) / 100);
  const costoTotal = sub1 + financieros;
  const margen = (Number(q.margenPct) || 0) / 100;
  const precioVenta = margen < 1 ? costoTotal / (1 - margen) : costoTotal;
  return { materiales, equipos, manoObra, directos, indirectos, financieros, costoTotal, precioVenta };
}

/* =========================================================================
   APP
   ========================================================================= */
export default function App() {
  const [data, setData] = useState(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("clientes");
  const [prefillReqId, setPrefillReqId] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, false);
        if (res?.value) setData({ ...EMPTY, ...JSON.parse(res.value) });
      } catch {
        /* no data yet */
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const [loadingRequirements, setLoadingRequirements] = useState(true);

  // Los requerimientos (Requisición del cliente) ya no dependen de
  // localStorage: se cargan desde Supabase y quedan disponibles desde
  // cualquier dispositivo/navegador. Esto sobreescribe lo que hubiera
  // quedado guardado localmente bajo "requirements".
  const reloadRequirements = useCallback(async () => {
    setLoadingRequirements(true);
    const { data: rows, error } = await supabase
      .from("requisiciones_cotizacion")
      .select("*")
      .order("updated_at", { ascending: false });
    if (!error && rows) {
      const mapeados = rows.map(filaSupabaseARequerimiento);
      setData((prev) => ({ ...prev, requirements: mapeados }));
    }
    setLoadingRequirements(false);
  }, []);

  useEffect(() => {
    reloadRequirements();
  }, [reloadRequirements]);

  const persist = useCallback(async (next) => {
    setData(next);
    try {
      await window.storage.set(STORAGE_KEY, JSON.stringify(next), false);
    } catch {
      setToast("No se pudo guardar. Intenta de nuevo.");
      setTimeout(() => setToast(""), 3000);
    }
  }, []);

  const update = useCallback(
    (key, updater) => {
      setData((prev) => {
        const next = { ...prev, [key]: updater(prev[key]) };
        window.storage.set(STORAGE_KEY, JSON.stringify(next), false).catch(() => {});
        return next;
      });
    },
    []
  );

  const bumpCounter = (name) => {
    let val;
    setData((prev) => {
      val = (prev.counters[name] || 0) + 1;
      const next = { ...prev, counters: { ...prev.counters, [name]: val } };
      window.storage.set(STORAGE_KEY, JSON.stringify(next), false).catch(() => {});
      return next;
    });
    return val;
  };

  const clientName = (id) => data.clients.find((c) => c.id === id)?.nombre || "—";

  if (!loaded) {
    return <div className="flex h-screen items-center justify-center bg-[#F5F4F1] text-sm text-slate-400">Cargando…</div>;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F5F4F1] text-[#1B2430]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');
        .font-display { font-family: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif; }
        body, .font-body { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; }
        @media print {
          .no-print { display: none !important; }
          .print-area { position: absolute; inset: 0; }
        }
      `}</style>

      {/* SIDEBAR */}
      <aside className="no-print flex w-60 shrink-0 flex-col border-r border-slate-800 bg-[#1B2430]">
        <div className="flex items-center gap-2 border-b border-white/10 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#C97A2B]">
            <Building2 size={16} className="text-white" />
          </div>
          <div>
            <p className="font-display text-sm font-semibold text-white leading-tight">SIMECO</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Ingeniería · Gestión</p>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = tab === n.key;
            return (
              <button
                key={n.key}
                onClick={() => setTab(n.key)}
                className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition ${
                  active ? "bg-[#C97A2B] text-white font-medium" : "text-slate-300 hover:bg-white/5"
                }`}
              >
                <Icon size={15} />
                {n.label}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-white/10 px-5 py-3 text-[10px] text-slate-500">
          SIMECO Ingeniería S.A.S. · NIT 805.008.141-7
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 overflow-y-auto">
        {tab === "clientes" && <ClientesView data={data} update={update} />}
        {tab === "agenda" && <AgendaView data={data} update={update} clientName={clientName} />}
        {tab === "requerimientos" && (
          <RequerimientosView
            data={data}
            update={update}
            clientName={clientName}
            reloadRequirements={reloadRequirements}
            loadingRequirements={loadingRequirements}
            onCotizar={(id) => {
              setPrefillReqId(id);
              setTab("cotizaciones");
            }}
          />
        )}
        {tab === "cotizaciones" && (
          <CotizacionesView
            data={data}
            update={update}
            bumpCounter={bumpCounter}
            clientName={clientName}
            prefillReqId={prefillReqId}
            clearPrefillReqId={() => setPrefillReqId(null)}
          />
        )}
        {tab === "centrocostos" && <CentroCostosView data={data} update={update} bumpCounter={bumpCounter} clientName={clientName} />}
        {tab === "ordenes" && <OrdenesView data={data} update={update} bumpCounter={bumpCounter} clientName={clientName} />}
        {tab === "actas" && <ActasView data={data} update={update} bumpCounter={bumpCounter} clientName={clientName} />}
        {tab === "facturacion" && <FacturacionView data={data} update={update} bumpCounter={bumpCounter} clientName={clientName} />}
      </main>

      {toast && (
        <div className="fixed bottom-4 right-4 rounded-md bg-rose-600 px-4 py-2 text-sm text-white shadow-lg">{toast}</div>
      )}
    </div>
  );
}

/* =========================================================================
   1-2. CLIENTES (selección por caracterización + listado)
   ========================================================================= */
function ClientesView({ data, update }) {
  const [panel, setPanel] = useState(null); // null | 'new' | client object
  const [q, setQ] = useState("");
  const [filterCal, setFilterCal] = useState("Todas");

  const filtered = data.clients.filter((c) => {
    const matchesQ = (c.nombre + c.sector + c.ciudad).toLowerCase().includes(q.toLowerCase());
    const matchesCal = filterCal === "Todas" || c.caracterizacion?.calificacion === filterCal;
    return matchesQ && matchesCal;
  });

  const save = (client) => {
    if (client.id) {
      update("clients", (arr) => arr.map((c) => (c.id === client.id ? client : c)));
    } else {
      update("clients", (arr) => [...arr, { ...client, id: uid() }]);
    }
    setPanel(null);
  };
  const remove = (id) => update("clients", (arr) => arr.filter((c) => c.id !== id));

  return (
    <ViewShell
      title="Clientes"
      subtitle="Caracterización, selección y listado de clientes"
      action={
        <button onClick={() => setPanel("new")} className="btnPrimary">
          <Plus size={14} /> Nuevo cliente
        </button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, sector o ciudad…" className={inputCls + " pl-8"} />
        </div>
        <Select value={filterCal} onChange={(e) => setFilterCal(e.target.value)}>
          {["Todas", "A", "B", "C"].map((v) => (
            <option key={v} value={v}>{v === "Todas" ? "Todas las calificaciones" : `Calificación ${v}`}</option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} text="Aún no hay clientes registrados. Crea el primero para empezar a caracterizarlos y darles seguimiento." cta="Nuevo cliente" onClick={() => setPanel("new")} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <Th>Cliente</Th><Th>Sector</Th><Th>Ciudad</Th><Th>Contacto</Th><Th>Calificación</Th><Th>Potencial</Th><Th></Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/60 cursor-pointer" onClick={() => setPanel(c)}>
                  <Td><span className="font-medium text-slate-800">{c.nombre}</span></Td>
                  <Td>{c.sector}</Td>
                  <Td>{c.ciudad}</Td>
                  <Td>{c.contactoNombre}</Td>
                  <Td><CalBadge value={c.caracterizacion?.calificacion} /></Td>
                  <Td>{c.caracterizacion?.potencial}</Td>
                  <Td onClick={(e) => e.stopPropagation()}>
                    <RowActions onEdit={() => setPanel(c)} onDelete={() => remove(c.id)} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {panel && <ClientForm initial={panel === "new" ? null : panel} onSave={save} onClose={() => setPanel(null)} />}
    </ViewShell>
  );
}

function CalBadge({ value }) {
  const styles = { A: "bg-emerald-50 text-emerald-700 border-emerald-300", B: "bg-amber-50 text-amber-700 border-amber-300", C: "bg-slate-100 text-slate-500 border-slate-300" };
  if (!value) return <span className="text-slate-300">—</span>;
  return <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold ${styles[value]}`}>{value}</span>;
}

function ClientForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(
    initial || {
      nombre: "", nit: "", sector: "", ciudad: "", direccion: "",
      contactoNombre: "", contactoCargo: "", telefono: "", correo: "",
      caracterizacion: { tamano: "Mediana", criticidad: "Media", potencial: "Medio", calificacion: "B" },
      notas: "",
    }
  );
  const set = (k, v) => setF({ ...f, [k]: v });
  const setCar = (k, v) => setF({ ...f, caracterizacion: { ...f.caracterizacion, [k]: v } });

  return (
    <Panel title={initial ? "Editar cliente" : "Nuevo cliente"} subtitle="Datos generales y caracterización comercial" onClose={onClose}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nombre / Razón social" span><TextInput value={f.nombre} onChange={(e) => set("nombre", e.target.value)} /></Field>
        <Field label="NIT"><TextInput value={f.nit} onChange={(e) => set("nit", e.target.value)} /></Field>
        <Field label="Sector"><TextInput value={f.sector} onChange={(e) => set("sector", e.target.value)} placeholder="Alimentos, farma, minería…" /></Field>
        <Field label="Ciudad"><TextInput value={f.ciudad} onChange={(e) => set("ciudad", e.target.value)} /></Field>
        <Field label="Dirección"><TextInput value={f.direccion} onChange={(e) => set("direccion", e.target.value)} /></Field>
        <Field label="Persona de contacto"><TextInput value={f.contactoNombre} onChange={(e) => set("contactoNombre", e.target.value)} /></Field>
        <Field label="Cargo"><TextInput value={f.contactoCargo} onChange={(e) => set("contactoCargo", e.target.value)} /></Field>
        <Field label="Teléfono"><TextInput value={f.telefono} onChange={(e) => set("telefono", e.target.value)} /></Field>
        <Field label="Correo electrónico"><TextInput type="email" value={f.correo} onChange={(e) => set("correo", e.target.value)} /></Field>

        <div className="sm:col-span-2 mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Caracterización</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Tamaño">
              <Select value={f.caracterizacion.tamano} onChange={(e) => setCar("tamano", e.target.value)}>
                {["Grande", "Mediana", "Pequeña"].map((v) => <option key={v}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Criticidad">
              <Select value={f.caracterizacion.criticidad} onChange={(e) => setCar("criticidad", e.target.value)}>
                {["Alta", "Media", "Baja"].map((v) => <option key={v}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Potencial">
              <Select value={f.caracterizacion.potencial} onChange={(e) => setCar("potencial", e.target.value)}>
                {["Alto", "Medio", "Bajo"].map((v) => <option key={v}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Calificación">
              <Select value={f.caracterizacion.calificacion} onChange={(e) => setCar("calificacion", e.target.value)}>
                {["A", "B", "C"].map((v) => <option key={v}>{v}</option>)}
              </Select>
            </Field>
          </div>
        </div>
        <Field label="Notas" span><TextArea value={f.notas} onChange={(e) => set("notas", e.target.value)} /></Field>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="btnGhost">Cancelar</button>
        <button onClick={() => onSave(f)} className="btnPrimary"><Save size={14} /> Guardar</button>
      </div>
    </Panel>
  );
}

/* =========================================================================
   2. AGENDA — atención y seguimiento
   ========================================================================= */
function AgendaView({ data, update, clientName }) {
  const [panel, setPanel] = useState(null);
  const sorted = [...data.agenda].sort((a, b) => (a.fecha > b.fecha ? 1 : -1));

  const save = (item) => {
    if (item.id) update("agenda", (arr) => arr.map((a) => (a.id === item.id ? item : a)));
    else update("agenda", (arr) => [...arr, { ...item, id: uid() }]);
    setPanel(null);
  };
  const remove = (id) => update("agenda", (arr) => arr.filter((a) => a.id !== id));
  const toggle = (item) => save({ ...item, estado: item.estado === "Realizado" ? "Pendiente" : "Realizado" });

  return (
    <ViewShell title="Agenda" subtitle="Seguimiento y atención a clientes" action={
      <button onClick={() => setPanel("new")} className="btnPrimary"><Plus size={14} /> Nueva actividad</button>
    }>
      {sorted.length === 0 ? (
        <EmptyState icon={CalendarClock} text="No hay actividades programadas. Agenda visitas, llamadas o seguimientos con tus clientes." cta="Nueva actividad" onClick={() => setPanel("new")} />
      ) : (
        <div className="space-y-2">
          {sorted.map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
              <button onClick={() => toggle(a)} className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${a.estado === "Realizado" ? "border-emerald-500 bg-emerald-500" : "border-slate-300"}`}>
                {a.estado === "Realizado" && <CheckCircle2 size={14} className="text-white" />}
              </button>
              <div className="w-24 shrink-0 font-mono text-xs text-slate-500">{a.fecha}</div>
              <span className="w-24 shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-center text-[11px] font-medium text-slate-600">{a.tipo}</span>
              <div className="flex-1 min-w-0">
                <p className={`truncate text-sm font-medium ${a.estado === "Realizado" ? "text-slate-400 line-through" : "text-slate-800"}`}>{clientName(a.clientId)}</p>
                <p className="truncate text-xs text-slate-500">{a.descripcion}</p>
              </div>
              <RowActions onEdit={() => setPanel(a)} onDelete={() => remove(a.id)} />
            </div>
          ))}
        </div>
      )}
      {panel && <AgendaForm initial={panel === "new" ? null : panel} clients={data.clients} onSave={save} onClose={() => setPanel(null)} />}
    </ViewShell>
  );
}

function AgendaForm({ initial, clients, onSave, onClose }) {
  const [f, setF] = useState(initial || { clientId: clients[0]?.id || "", fecha: todayISO(), tipo: "Seguimiento", descripcion: "", responsable: "", estado: "Pendiente" });
  const set = (k, v) => setF({ ...f, [k]: v });
  return (
    <Panel title={initial ? "Editar actividad" : "Nueva actividad"} onClose={onClose}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Cliente" span>
          <Select value={f.clientId} onChange={(e) => set("clientId", e.target.value)}>
            {clients.length === 0 && <option value="">Sin clientes registrados</option>}
            {clients.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </Select>
        </Field>
        <Field label="Fecha"><TextInput type="date" value={f.fecha} onChange={(e) => set("fecha", e.target.value)} /></Field>
        <Field label="Tipo">
          <Select value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>
            {["Visita", "Llamada", "Correo", "Seguimiento", "Reunión"].map((v) => <option key={v}>{v}</option>)}
          </Select>
        </Field>
        <Field label="Responsable"><TextInput value={f.responsable} onChange={(e) => set("responsable", e.target.value)} /></Field>
        <Field label="Estado">
          <Select value={f.estado} onChange={(e) => set("estado", e.target.value)}>
            {["Pendiente", "Realizado"].map((v) => <option key={v}>{v}</option>)}
          </Select>
        </Field>
        <Field label="Descripción" span><TextArea value={f.descripcion} onChange={(e) => set("descripcion", e.target.value)} /></Field>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="btnGhost">Cancelar</button>
        <button onClick={() => onSave(f)} className="btnPrimary"><Save size={14} /> Guardar</button>
      </div>
    </Panel>
  );
}

/* =========================================================================
   3. REQUERIMIENTOS — alcance del servicio
   ========================================================================= */
function RequerimientosView({ data, update, clientName, reloadRequirements, loadingRequirements, onCotizar }) {
  const [panel, setPanel] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const save = async (r) => {
    setGuardando(true);
    const fila = requerimientoAFilaSupabase(r, clientName);
    let error;
    if (r.id) {
      ({ error } = await supabase.from("requisiciones_cotizacion").update(fila).eq("id", r.id));
    } else {
      ({ error } = await supabase.from("requisiciones_cotizacion").insert(fila));
    }
    setGuardando(false);
    if (error) {
      alert("No se pudo guardar en Supabase: " + error.message);
      console.error(error);
      return;
    }
    await reloadRequirements();
    setPanel(null);
  };

  const remove = async (id) => {
    if (!confirm("¿Eliminar este requerimiento? Esta acción no se puede deshacer.")) return;
    const { error } = await supabase.from("requisiciones_cotizacion").delete().eq("id", id);
    if (error) {
      alert("No se pudo eliminar en Supabase: " + error.message);
      console.error(error);
      return;
    }
    await reloadRequirements();
  };

  return (
    <ViewShell title="Requerimientos" subtitle="Requisición del cliente (FO.GGC.02) — guardado en Supabase, disponible desde cualquier dispositivo" action={
      <button onClick={() => setPanel("new")} className="btnPrimary"><Plus size={14} /> Nuevo requerimiento</button>
    }>
      {loadingRequirements ? (
        <p className="py-10 text-center text-sm text-slate-400">Cargando requerimientos desde Supabase…</p>
      ) : data.requirements.length === 0 ? (
        <EmptyState icon={ClipboardList} text="Registra la requisición del cliente (servicio o proyecto) para definir el alcance antes de cotizar." cta="Nuevo requerimiento" onClick={() => setPanel("new")} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.requirements.map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4 cursor-pointer hover:border-[#C97A2B]/50" onClick={() => setPanel(r)}>
              <div className="flex items-start justify-between">
                <p className="font-medium text-slate-800">{clientName(r.clientId) !== "—" ? clientName(r.clientId) : r._clienteGuardado || "—"}</p>
                <span className="font-mono text-[11px] text-slate-400">{r.fecha}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{r.personaContacto} · {r.correoContacto}</p>
              {(r.proyecto || r.servicio) && (
                <p className="mt-1 text-xs text-slate-500">
                  {r.proyecto && <span><b>Proyecto:</b> {r.proyecto}</span>}
                  {r.proyecto && r.servicio && " · "}
                  {r.servicio && <span><b>Servicio:</b> {r.servicio}</span>}
                </p>
              )}
              <p className="mt-2 line-clamp-3 text-sm text-slate-600">{r.alcance}</p>
              <div className="mt-3 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                {onCotizar && (
                  <button
                    onClick={() => onCotizar(r.id)}
                    className="flex items-center gap-1 rounded-md bg-[#C97A2B]/10 px-2.5 py-1 text-xs font-medium text-[#C97A2B] hover:bg-[#C97A2B]/20"
                  >
                    <FileText size={12} /> Cotizar
                  </button>
                )}
                <RowActions onEdit={() => setPanel(r)} onDelete={() => remove(r.id)} />
              </div>
            </div>
          ))}
        </div>
      )}
      {panel && (
        <RequerimientoForm
          initial={panel === "new" ? null : panel}
          clients={data.clients}
          onSave={save}
          onClose={() => setPanel(null)}
          guardando={guardando}
        />
      )}
    </ViewShell>
  );
}

function RequerimientoForm({ initial, clients, onSave, onClose, guardando }) {
  const DEFAULT_F = {
    clientId: clients[0]?.id || "",
    fecha: todayISO(),
    fechaLimite: "",
    personaContacto: "",
    correoContacto: "",
    telefonoContacto: "",
    proyecto: "",
    servicio: "",
    palabraClave: "",
    alcance: "",
    detalle: "",
    materiales: [],
    manoObra: [],
    recursoHumano: [],
    herramientas: [],
  };
  // Combina con valores por defecto para que requerimientos creados ANTES
  // de agregar estos campos (materiales, manoObra, etc.) no rompan la app
  // al editarlos — de lo contrario f.materiales sería undefined.
  const [f, setF] = useState(initial ? { ...DEFAULT_F, ...initial } : DEFAULT_F);
  const set = (k, v) => setF({ ...f, [k]: v });
  const cliente = clients.find((c) => c.id === f.clientId);
  useEffect(() => {
    if (cliente && !initial) {
      setF((prev) => ({ ...prev, personaContacto: cliente.contactoNombre, correoContacto: cliente.correo, telefonoContacto: cliente.telefono }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.clientId]);

  return (
    <Panel title={initial ? "Editar requerimiento" : "Nuevo requerimiento"} subtitle="FO.GGC.02 — Formato de Requisición de Cotización" onClose={onClose} wide>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Cliente" span>
          <Select value={f.clientId} onChange={(e) => set("clientId", e.target.value)}>
            {clients.length === 0 && <option value="">Sin clientes registrados</option>}
            {clients.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </Select>
        </Field>
        {cliente && (
          <div className="sm:col-span-2 rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 grid grid-cols-2 gap-1">
            <span><b>NIT:</b> {cliente.nit || "—"}</span>
            <span><b>Ciudad:</b> {cliente.ciudad || "—"}</span>
            <span><b>Sector:</b> {cliente.sector || "—"}</span>
            <span><b>Dirección:</b> {cliente.direccion || "—"}</span>
          </div>
        )}
        <Field label="Fecha de la solicitud"><TextInput type="date" value={f.fecha} onChange={(e) => set("fecha", e.target.value)} /></Field>
        <Field label="Fecha límite de envío de cotización"><TextInput type="date" value={f.fechaLimite} onChange={(e) => set("fechaLimite", e.target.value)} /></Field>
        <Field label="Persona de contacto"><TextInput value={f.personaContacto} onChange={(e) => set("personaContacto", e.target.value)} /></Field>
        <Field label="Correo electrónico"><TextInput type="email" value={f.correoContacto} onChange={(e) => set("correoContacto", e.target.value)} /></Field>
        <Field label="Teléfono"><TextInput value={f.telefonoContacto} onChange={(e) => set("telefonoContacto", e.target.value)} /></Field>
        <Field label="Palabra clave"><TextInput value={f.palabraClave} onChange={(e) => set("palabraClave", e.target.value)} /></Field>
        <Field label="Proyecto"><TextInput placeholder="Nombre o alcance general" value={f.proyecto} onChange={(e) => set("proyecto", e.target.value)} /></Field>
        <Field label="Servicio"><TextInput placeholder="Clasificación específica del servicio" value={f.servicio} onChange={(e) => set("servicio", e.target.value)} /></Field>
        <Field label="Alcance del servicio / proyecto" span><TextArea value={f.alcance} onChange={(e) => set("alcance", e.target.value)} className="min-h-[100px]" /></Field>
        <Field label="Detalle técnico / observaciones" span><TextArea value={f.detalle} onChange={(e) => set("detalle", e.target.value)} /></Field>

        <div className="sm:col-span-2">
          <ItemsConImportar label="Materiales" items={f.materiales} setItems={(v) => set("materiales", v)} unidadLabel="Und" claveUnidad="und" claveDescripcion={["descripcion", "material", "item", "producto"]} />
        </div>
        <div className="sm:col-span-2">
          <ItemsConImportar label="Mano de obra" items={f.manoObra} setItems={(v) => set("manoObra", v)} unidadLabel="Und" claveUnidad="und" claveDescripcion={["descripcion", "mano de obra", "item"]} />
        </div>
        <div className="sm:col-span-2">
          <ItemsConImportar label="Recurso humano" items={f.recursoHumano} setItems={(v) => set("recursoHumano", v)} unidadLabel="Días" claveUnidad="dias" claveDescripcion={["descripcion", "rol", "cargo"]} sugerencias={ROLES_RECURSO_HUMANO} />
        </div>
        <div className="sm:col-span-2">
          <ItemsConImportar label="Herramientas o equipos especiales" items={f.herramientas} setItems={(v) => set("herramientas", v)} unidadLabel="Und" claveUnidad="und" claveDescripcion={["descripcion", "herramienta", "equipo", "item"]} />
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="btnGhost">Cancelar</button>
        <button onClick={() => onSave(f)} disabled={guardando} className="btnPrimary" style={{ opacity: guardando ? 0.6 : 1 }}>
          <Save size={14} /> {guardando ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </Panel>
  );
}

/* =========================================================================
   4-6. COTIZACIONES — crear, almacenar por cliente, seguimiento y control
   ========================================================================= */
function CotizacionesView({ data, update, bumpCounter, clientName, prefillReqId, clearPrefillReqId }) {
  const [panel, setPanel] = useState(null);
  const [printQ, setPrintQ] = useState(null);
  const [filterEstado, setFilterEstado] = useState("Todas");
  const [filterClient, setFilterClient] = useState("Todos");

  // Si llegamos aquí desde el botón "Cotizar" de un Requerimiento,
  // abrimos automáticamente el panel de nueva cotización.
  useEffect(() => {
    if (prefillReqId) setPanel("new");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillReqId]);

  const list = data.quotations
    .filter((q) => filterEstado === "Todas" || q.estado === filterEstado)
    .filter((q) => filterClient === "Todos" || q.clientId === filterClient)
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  const save = (q) => {
    if (q.id) {
      update("quotations", (arr) => arr.map((x) => (x.id === q.id ? q : x)));
    } else {
      const n = bumpCounter("cot");
      const consecutivo = `COT-${String(n).padStart(3, "0")}-${yy()}`;
      update("quotations", (arr) => [
        ...arr,
        { ...q, id: uid(), consecutivo, historial: [{ fecha: todayISO(), evento: "Cotización creada" }] },
      ]);
    }
    setPanel(null);
  };
  const remove = (id) => update("quotations", (arr) => arr.filter((q) => q.id !== id));

  const setEstado = (q, estado) => {
    const historial = [...(q.historial || []), { fecha: todayISO(), evento: `Estado cambiado a ${estado}` }];
    update("quotations", (arr) => arr.map((x) => (x.id === q.id ? { ...x, estado, historial } : x)));
  };

  // control summary
  const summary = ["Borrador", "Enviada", "Aprobada", "Rechazada", "Vencida"].map((e) => ({
    estado: e,
    count: data.quotations.filter((q) => q.estado === e).length,
    value: data.quotations.filter((q) => q.estado === e).reduce((s, q) => s + calcCotizacion(q).precioVenta, 0),
  }));

  return (
    <ViewShell title="Cotizaciones" subtitle="Creación, seguimiento y control de cotizaciones por cliente" action={
      <button onClick={() => setPanel("new")} className="btnPrimary"><Plus size={14} /> Nueva cotización</button>
    }>
      {/* control panel */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {summary.map((s) => (
          <button key={s.estado} onClick={() => setFilterEstado(filterEstado === s.estado ? "Todas" : s.estado)}
            className={`rounded-lg border p-3 text-left transition ${filterEstado === s.estado ? "border-[#C97A2B] bg-[#C97A2B]/5" : "border-slate-200 bg-white"}`}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{s.estado}</p>
            <p className="font-display text-lg font-semibold text-slate-800">{s.count}</p>
            <p className="text-[11px] text-slate-400">{cop(s.value)}</p>
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <Select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)}>
          {["Todas", "Borrador", "Enviada", "Aprobada", "Rechazada", "Vencida"].map((v) => <option key={v}>{v}</option>)}
        </Select>
        <Select value={filterClient} onChange={(e) => setFilterClient(e.target.value)}>
          <option value="Todos">Todos los clientes</option>
          {data.clients.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </Select>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={FileText} text="No hay cotizaciones que coincidan. Crea una nueva cotización para un cliente." cta="Nueva cotización" onClick={() => setPanel("new")} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr><Th>Consecutivo</Th><Th>Cliente</Th><Th>Referencia</Th><Th>Fecha</Th><Th>Valor</Th><Th>Estado</Th><Th></Th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((q) => {
                const { precioVenta } = calcCotizacion(q);
                return (
                  <tr key={q.id} className="hover:bg-slate-50/60">
                    <Td mono>{q.consecutivo}</Td>
                    <Td>{clientName(q.clientId)}</Td>
                    <Td>{q.referencia}</Td>
                    <Td mono>{q.fecha}</Td>
                    <Td>{cop(precioVenta)}</Td>
                    <Td>
                      <select value={q.estado} onChange={(e) => setEstado(q, e.target.value)} className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs">
                        {["Borrador", "Enviada", "Aprobada", "Rechazada", "Vencida"].map((v) => <option key={v}>{v}</option>)}
                      </select>
                    </Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setPrintQ(q)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100"><Printer size={14} /></button>
                        <RowActions onEdit={() => setPanel(q)} onDelete={() => remove(q.id)} />
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {panel && (
        <CotizacionForm
          initial={panel === "new" ? null : panel}
          clients={data.clients}
          requirements={data.requirements}
          prefillReqId={panel === "new" ? prefillReqId : null}
          onSave={save}
          onClose={() => {
            setPanel(null);
            clearPrefillReqId?.();
          }}
        />
      )}
      {printQ && <CotizacionPrint q={printQ} client={data.clients.find((c) => c.id === printQ.clientId)} onClose={() => setPrintQ(null)} />}
    </ViewShell>
  );
}

function CotizacionForm({ initial, clients, requirements, prefillReqId, onSave, onClose }) {
  const [f, setF] = useState(() => {
    if (initial) return initial;
    const base = {
      ciudad: "Santiago de Cali", fecha: todayISO(), clientId: clients[0]?.id || "",
      personaContacto: "", correoContacto: "", referencia: "", alcance: "",
      materiales: [], equipos: [], manoObra: [],
      alimentacionHospedaje: 0, transportePersonal: 0, transporteMateriales: 0,
      costosIndirectosPct: 10, costosFinancierosPct: 3, margenPct: 25,
      tiempoEntrega: "", formaPago: "50% anticipo, 50% contra entrega", garantia: "12 meses por defectos de fabricación e instalación",
      validez: "30 días calendario", firmante: "Ing. Luis Fernando Montenegro — Director General y Comercial",
      estado: "Borrador",
    };
    // Si venimos de "Cotizar" en un Requerimiento, arrancamos ya con
    // el cliente correcto seleccionado (se completa el resto abajo).
    if (prefillReqId) {
      const r = requirements.find((x) => x.id === prefillReqId);
      if (r) return { ...base, clientId: r.clientId || base.clientId };
    }
    return base;
  });
  const set = (k, v) => setF({ ...f, [k]: v });
  const calc = calcCotizacion(f);
  const reqsForClient = requirements.filter((r) => r.clientId === f.clientId);

  // Convierte los ítems de la RQ (desc/cant/und o dias/obs) al formato que
  // usa la tabla de la cotización (desc/cant/und/valorUnit). El valor
  // unitario queda en 0 porque la RQ no trae precios — esos se completan
  // aquí, en el Cotizador.
  const itemsDesdeRQ = (items, claveUnidad = "und") =>
    (items || []).map((it) => ({ desc: it.desc || "", cant: it.cant || "", und: it[claveUnidad] || "", valorUnit: 0 }));

  const applyRequirement = (id) => {
    const r = requirements.find((x) => x.id === id);
    if (!r) return;
    setF((prev) => ({
      ...prev,
      alcance: r.alcance || prev.alcance,
      personaContacto: r.personaContacto || prev.personaContacto,
      correoContacto: r.correoContacto || prev.correoContacto,
      materiales: itemsDesdeRQ(r.materiales, "und"),
      equipos: itemsDesdeRQ(r.herramientas, "und"),
      manoObra: [...itemsDesdeRQ(r.manoObra, "und"), ...itemsDesdeRQ(r.recursoHumano, "dias")],
    }));
  };

  useEffect(() => {
    const c = clients.find((c) => c.id === f.clientId);
    if (c && !initial) setF((prev) => ({ ...prev, personaContacto: c.contactoNombre, correoContacto: c.correo, ciudad: c.ciudad || prev.ciudad }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.clientId]);

  // Si llegamos desde el botón "Cotizar" de un Requerimiento, aplicamos
  // esa RQ automáticamente una sola vez al abrir el formulario — después
  // del efecto de cliente de arriba, para que sus datos no se pierdan.
  useEffect(() => {
    if (prefillReqId && !initial) applyRequirement(prefillReqId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillReqId]);

  return (
    <Panel title={initial ? `Editar ${initial.consecutivo}` : "Nueva cotización"} subtitle="Define alcance, costos, margen y condiciones" onClose={onClose} wide>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Ciudad"><TextInput value={f.ciudad} onChange={(e) => set("ciudad", e.target.value)} /></Field>
        <Field label="Fecha"><TextInput type="date" value={f.fecha} onChange={(e) => set("fecha", e.target.value)} /></Field>
        <Field label="Referencia"><TextInput value={f.referencia} onChange={(e) => set("referencia", e.target.value)} placeholder="Objeto breve de la cotización" /></Field>

        <Field label="Cliente" span>
          <Select value={f.clientId} onChange={(e) => set("clientId", e.target.value)}>
            {clients.length === 0 && <option value="">Sin clientes registrados</option>}
            {clients.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </Select>
        </Field>
        {reqsForClient.length > 0 && (
          <Field label="Cargar desde requerimiento (trae alcance, materiales, mano de obra y herramientas)">
            <Select defaultValue="" onChange={(e) => e.target.value && applyRequirement(e.target.value)}>
              <option value="">Seleccionar…</option>
              {reqsForClient.map((r) => <option key={r.id} value={r.id}>{r.fecha} — {(r.alcance || r.proyecto || r.servicio || "Sin descripción").slice(0, 30)}…</option>)}
            </Select>
          </Field>
        )}
        <Field label="Persona de contacto"><TextInput value={f.personaContacto} onChange={(e) => set("personaContacto", e.target.value)} /></Field>
        <Field label="Correo electrónico" span><TextInput type="email" value={f.correoContacto} onChange={(e) => set("correoContacto", e.target.value)} /></Field>
        <Field label="Alcance" span><TextArea value={f.alcance} onChange={(e) => set("alcance", e.target.value)} className="min-h-[90px]" /></Field>
      </div>

      <div className="mt-4 space-y-3">
        <LineItems label="Materiales eléctricos" items={f.materiales} setItems={(v) => set("materiales", v)} />
        <LineItems label="Equipos y herramientas" items={f.equipos} setItems={(v) => set("equipos", v)} />
        <LineItems label="Mano de obra" items={f.manoObra} setItems={(v) => set("manoObra", v)} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Alimentación y hospedaje"><TextInput type="number" value={f.alimentacionHospedaje} onChange={(e) => set("alimentacionHospedaje", e.target.value)} /></Field>
        <Field label="Transporte de personal"><TextInput type="number" value={f.transportePersonal} onChange={(e) => set("transportePersonal", e.target.value)} /></Field>
        <Field label="Transporte de materiales"><TextInput type="number" value={f.transporteMateriales} onChange={(e) => set("transporteMateriales", e.target.value)} /></Field>
        <Field label="Costos indirectos (%)"><TextInput type="number" value={f.costosIndirectosPct} onChange={(e) => set("costosIndirectosPct", e.target.value)} /></Field>
        <Field label="Costos financieros (%)"><TextInput type="number" value={f.costosFinancierosPct} onChange={(e) => set("costosFinancierosPct", e.target.value)} /></Field>
        <Field label="Margen bruto (%)"><TextInput type="number" value={f.margenPct} onChange={(e) => set("margenPct", e.target.value)} /></Field>
      </div>

      <div className="mt-4 rounded-lg border border-[#C97A2B]/30 bg-[#C97A2B]/5 p-4">
        <div className="flex justify-between text-sm text-slate-600"><span>Costo directo</span><span>{cop(calc.directos)}</span></div>
        <div className="flex justify-between text-sm text-slate-600"><span>Costos indirectos</span><span>{cop(calc.indirectos)}</span></div>
        <div className="flex justify-between text-sm text-slate-600"><span>Costos financieros</span><span>{cop(calc.financieros)}</span></div>
        <div className="flex justify-between text-sm text-slate-600 border-t border-[#C97A2B]/20 mt-1 pt-1"><span>Costo total</span><span>{cop(calc.costoTotal)}</span></div>
        <div className="mt-1 flex justify-between font-display text-lg font-semibold text-[#1B2430]"><span>Precio de venta</span><span>{cop(calc.precioVenta)}</span></div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Tiempo de entrega"><TextInput value={f.tiempoEntrega} onChange={(e) => set("tiempoEntrega", e.target.value)} placeholder="Ej: 15 días hábiles" /></Field>
        <Field label="Forma de pago"><TextInput value={f.formaPago} onChange={(e) => set("formaPago", e.target.value)} /></Field>
        <Field label="Garantía"><TextInput value={f.garantia} onChange={(e) => set("garantia", e.target.value)} /></Field>
        <Field label="Validez de la oferta"><TextInput value={f.validez} onChange={(e) => set("validez", e.target.value)} /></Field>
        <Field label="Firma" span><TextInput value={f.firmante} onChange={(e) => set("firmante", e.target.value)} /></Field>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="btnGhost">Cancelar</button>
        <button onClick={() => onSave(f)} className="btnPrimary"><Save size={14} /> Guardar cotización</button>
      </div>
    </Panel>
  );
}

function CotizacionPrint({ q, client, onClose }) {
  const calc = calcCotizacion(q);
  const rows = [
    q.materiales.length > 0 && { desc: "Materiales eléctricos", total: calc.materiales },
    q.equipos.length > 0 && { desc: "Equipos y herramientas", total: calc.equipos },
    q.manoObra.length > 0 && { desc: "Mano de obra", total: calc.manoObra },
    Number(q.alimentacionHospedaje) > 0 && { desc: "Alimentación y hospedaje", total: Number(q.alimentacionHospedaje) },
    Number(q.transportePersonal) > 0 && { desc: "Transporte de personal", total: Number(q.transportePersonal) },
    Number(q.transporteMateriales) > 0 && { desc: "Transporte de materiales", total: Number(q.transporteMateriales) },
  ].filter(Boolean);

  return (
    <Panel title={`Vista cliente — ${q.consecutivo}`} subtitle="Formato de envío al cliente" onClose={onClose} wide>
      <div className="print-area rounded-lg border border-slate-200 bg-white p-8 font-body text-sm text-slate-800">
        <div className="flex items-start justify-between border-b border-slate-200 pb-4">
          <div>
            <p className="font-display text-lg font-bold">SIMECO INGENIERÍA S.A.S.</p>
            <p className="text-xs text-slate-500">NIT 805.008.141-7 · Santiago de Cali, Colombia</p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p><b>Consecutivo:</b> {q.consecutivo}</p>
            <p><b>Ciudad y fecha:</b> {q.ciudad}, {q.fecha}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <p><b>Cliente:</b> {client?.nombre}</p>
          <p><b>Referencia:</b> {q.referencia}</p>
          <p><b>Atención:</b> {q.personaContacto}</p>
          <p><b>Correo:</b> {q.correoContacto}</p>
        </div>

        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Alcance</p>
        <p className="mt-1 whitespace-pre-wrap text-sm">{q.alcance}</p>

        <table className="mt-4 w-full border-collapse text-xs">
          <thead>
            <tr className="border-b-2 border-slate-800">
              <th className="py-1.5 text-left">ITEM</th><th className="text-left">DESCRIPCIÓN</th><th className="text-right">CANT</th><th className="text-right">UND</th><th className="text-right">V TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-slate-200">
                <td className="py-1.5">{i + 1}</td><td>{r.desc}</td><td className="text-right">1</td><td className="text-right">Global</td><td className="text-right">{cop(r.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-800 font-semibold">
              <td colSpan={4} className="py-2 text-right">PRECIO DE VENTA</td><td className="py-2 text-right">{cop(calc.precioVenta)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <p><b>Tiempo de entrega:</b> {q.tiempoEntrega}</p>
          <p><b>Forma de pago:</b> {q.formaPago}</p>
          <p><b>Garantía:</b> {q.garantia}</p>
          <p><b>Validez:</b> {q.validez}</p>
        </div>

        <div className="mt-8 text-sm">
          <p className="border-t border-slate-400 pt-2 inline-block">{q.firmante}</p>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2 no-print">
        <button onClick={onClose} className="btnGhost">Cerrar</button>
        <button onClick={() => window.print()} className="btnPrimary"><Printer size={14} /> Imprimir / PDF</button>
      </div>
    </Panel>
  );
}

/* =========================================================================
   7. CENTRO DE COSTOS y aprobación
   ========================================================================= */
function CentroCostosView({ data, update, bumpCounter, clientName }) {
  const [panel, setPanel] = useState(null);
  const approvedQuotes = data.quotations.filter((q) => q.estado === "Aprobada");

  const save = (cc) => {
    if (cc.id) update("costCenters", (arr) => arr.map((x) => (x.id === cc.id ? cc : x)));
    else {
      const n = bumpCounter("cc");
      update("costCenters", (arr) => [...arr, { ...cc, id: uid(), codigo: `CC-${String(n).padStart(3, "0")}-${yy()}` }]);
    }
    setPanel(null);
  };
  const remove = (id) => update("costCenters", (arr) => arr.filter((c) => c.id !== id));
  const aprobar = (cc, aprobado) =>
    update("costCenters", (arr) => arr.map((x) => (x.id === cc.id ? { ...x, estado: aprobado ? "Aprobado" : "Rechazado", fechaAprobacion: todayISO() } : x)));

  return (
    <ViewShell title="Centro de Costos" subtitle="Creación y aprobación de centros de costo por proyecto" action={
      <button onClick={() => setPanel("new")} className="btnPrimary"><Plus size={14} /> Nuevo centro de costo</button>
    }>
      {data.costCenters.length === 0 ? (
        <EmptyState icon={Wallet} text="Crea un centro de costos a partir de una cotización aprobada para autorizar el presupuesto del proyecto." cta="Nuevo centro de costo" onClick={() => setPanel("new")} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50"><tr><Th>Código</Th><Th>Cliente</Th><Th>Cotización</Th><Th>Presupuesto</Th><Th>Responsable</Th><Th>Estado</Th><Th></Th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {data.costCenters.map((cc) => {
                const q = data.quotations.find((q) => q.id === cc.quotationId);
                return (
                  <tr key={cc.id} className="hover:bg-slate-50/60">
                    <Td mono>{cc.codigo}</Td>
                    <Td>{q ? clientName(q.clientId) : "—"}</Td>
                    <Td mono>{q?.consecutivo || "—"}</Td>
                    <Td>{cop(cc.presupuestoAprobado)}</Td>
                    <Td>{cc.responsable}</Td>
                    <Td><Badge>{cc.estado}</Badge></Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        {cc.estado === "Pendiente" && (
                          <>
                            <button onClick={() => aprobar(cc, true)} className="rounded p-1.5 text-emerald-500 hover:bg-emerald-50"><CheckCircle2 size={14} /></button>
                            <button onClick={() => aprobar(cc, false)} className="rounded p-1.5 text-rose-400 hover:bg-rose-50"><XCircle size={14} /></button>
                          </>
                        )}
                        <RowActions onEdit={() => setPanel(cc)} onDelete={() => remove(cc.id)} />
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {panel && <CentroCostoForm initial={panel === "new" ? null : panel} quotations={approvedQuotes} clientName={clientName} onSave={save} onClose={() => setPanel(null)} />}
    </ViewShell>
  );
}

function CentroCostoForm({ initial, quotations, clientName, onSave, onClose }) {
  const [f, setF] = useState(initial || { quotationId: quotations[0]?.id || "", presupuestoAprobado: 0, responsable: "", estado: "Pendiente", aprobadoPor: "", fecha: todayISO(), notas: "" });
  const set = (k, v) => setF({ ...f, [k]: v });
  const q = quotations.find((x) => x.id === f.quotationId) || quotations.find((x) => x.id === initial?.quotationId);
  useEffect(() => {
    if (q && !initial) set("presupuestoAprobado", calcCotizacion(q).precioVenta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.quotationId]);

  return (
    <Panel title={initial ? `Editar ${initial.codigo}` : "Nuevo centro de costo"} onClose={onClose}>
      <div className="grid grid-cols-1 gap-3">
        <Field label="Cotización aprobada">
          <Select value={f.quotationId} onChange={(e) => set("quotationId", e.target.value)}>
            {quotations.length === 0 && <option value="">No hay cotizaciones aprobadas</option>}
            {quotations.map((qq) => <option key={qq.id} value={qq.id}>{qq.consecutivo} — {clientName(qq.clientId)}</option>)}
          </Select>
        </Field>
        <Field label="Presupuesto aprobado"><TextInput type="number" value={f.presupuestoAprobado} onChange={(e) => set("presupuestoAprobado", e.target.value)} /></Field>
        <Field label="Responsable del proyecto"><TextInput value={f.responsable} onChange={(e) => set("responsable", e.target.value)} /></Field>
        <Field label="Aprobado por"><TextInput value={f.aprobadoPor} onChange={(e) => set("aprobadoPor", e.target.value)} placeholder="Ing. Luis Fernando Montenegro" /></Field>
        <Field label="Fecha"><TextInput type="date" value={f.fecha} onChange={(e) => set("fecha", e.target.value)} /></Field>
        <Field label="Notas"><TextArea value={f.notas} onChange={(e) => set("notas", e.target.value)} /></Field>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="btnGhost">Cancelar</button>
        <button onClick={() => onSave(f)} className="btnPrimary"><Save size={14} /> Guardar</button>
      </div>
    </Panel>
  );
}

/* =========================================================================
   8. ÓRDENES DE SERVICIO
   ========================================================================= */
function OrdenesView({ data, update, bumpCounter, clientName }) {
  const [panel, setPanel] = useState(null);
  const approvedCC = data.costCenters.filter((c) => c.estado === "Aprobado");

  const save = (o) => {
    if (o.id) update("serviceOrders", (arr) => arr.map((x) => (x.id === o.id ? o : x)));
    else {
      const n = bumpCounter("os");
      update("serviceOrders", (arr) => [...arr, { ...o, id: uid(), numero: `OS-${String(n).padStart(3, "0")}-${yy()}` }]);
    }
    setPanel(null);
  };
  const remove = (id) => update("serviceOrders", (arr) => arr.filter((o) => o.id !== id));

  return (
    <ViewShell title="Órdenes de Servicio" subtitle="Ejecución del proyecto autorizado" action={
      <button onClick={() => setPanel("new")} className="btnPrimary"><Plus size={14} /> Nueva orden</button>
    }>
      {data.serviceOrders.length === 0 ? (
        <EmptyState icon={ClipboardCheck} text="Genera una orden de servicio a partir de un centro de costos aprobado." cta="Nueva orden" onClick={() => setPanel("new")} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50"><tr><Th>N° Orden</Th><Th>Cliente</Th><Th>Responsable</Th><Th>Inicio</Th><Th>Fin estimado</Th><Th>Estado</Th><Th></Th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {data.serviceOrders.map((o) => {
                const cc = data.costCenters.find((c) => c.id === o.costCenterId);
                const q = data.quotations.find((q) => q.id === cc?.quotationId);
                return (
                  <tr key={o.id} className="hover:bg-slate-50/60">
                    <Td mono>{o.numero}</Td>
                    <Td>{q ? clientName(q.clientId) : "—"}</Td>
                    <Td>{o.responsable}</Td>
                    <Td mono>{o.fechaInicio}</Td>
                    <Td mono>{o.fechaFinEstimada}</Td>
                    <Td><Badge>{o.estado}</Badge></Td>
                    <Td><RowActions onEdit={() => setPanel(o)} onDelete={() => remove(o.id)} /></Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {panel && <OrdenForm initial={panel === "new" ? null : panel} costCenters={approvedCC} data={data} clientName={clientName} onSave={save} onClose={() => setPanel(null)} />}
    </ViewShell>
  );
}

function OrdenForm({ initial, costCenters, data, clientName, onSave, onClose }) {
  const [f, setF] = useState(initial || { costCenterId: costCenters[0]?.id || "", responsable: "", alcance: "", fechaInicio: todayISO(), fechaFinEstimada: "", estado: "En ejecución" });
  const set = (k, v) => setF({ ...f, [k]: v });
  return (
    <Panel title={initial ? `Editar ${initial.numero}` : "Nueva orden de servicio"} onClose={onClose}>
      <div className="grid grid-cols-1 gap-3">
        <Field label="Centro de costos">
          <Select value={f.costCenterId} onChange={(e) => set("costCenterId", e.target.value)}>
            {costCenters.length === 0 && <option value="">No hay centros de costo aprobados</option>}
            {costCenters.map((cc) => {
              const q = data.quotations.find((q) => q.id === cc.quotationId);
              return <option key={cc.id} value={cc.id}>{cc.codigo} — {q ? clientName(q.clientId) : ""}</option>;
            })}
          </Select>
        </Field>
        <Field label="Responsable / cuadrilla"><TextInput value={f.responsable} onChange={(e) => set("responsable", e.target.value)} /></Field>
        <Field label="Alcance de la orden"><TextArea value={f.alcance} onChange={(e) => set("alcance", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha de inicio"><TextInput type="date" value={f.fechaInicio} onChange={(e) => set("fechaInicio", e.target.value)} /></Field>
          <Field label="Fecha fin estimada"><TextInput type="date" value={f.fechaFinEstimada} onChange={(e) => set("fechaFinEstimada", e.target.value)} /></Field>
        </div>
        <Field label="Estado">
          <Select value={f.estado} onChange={(e) => set("estado", e.target.value)}>
            {["En ejecución", "Cerrada", "Suspendida"].map((v) => <option key={v}>{v}</option>)}
          </Select>
        </Field>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="btnGhost">Cancelar</button>
        <button onClick={() => onSave(f)} className="btnPrimary"><Save size={14} /> Guardar</button>
      </div>
    </Panel>
  );
}

/* =========================================================================
   9. ACTAS DE ENTREGA
   ========================================================================= */
function ActasView({ data, update, bumpCounter, clientName }) {
  const [panel, setPanel] = useState(null);
  const save = (a) => {
    if (a.id) update("actas", (arr) => arr.map((x) => (x.id === a.id ? a : x)));
    else {
      const n = bumpCounter("acta");
      update("actas", (arr) => [...arr, { ...a, id: uid(), numero: `ACT-${String(n).padStart(3, "0")}-${yy()}` }]);
    }
    setPanel(null);
  };
  const remove = (id) => update("actas", (arr) => arr.filter((a) => a.id !== id));

  return (
    <ViewShell title="Actas de Entrega" subtitle="Cierre formal del servicio ejecutado" action={
      <button onClick={() => setPanel("new")} className="btnPrimary"><Plus size={14} /> Nueva acta</button>
    }>
      {data.actas.length === 0 ? (
        <EmptyState icon={Truck} text="Registra el acta de entrega al cerrar una orden de servicio." cta="Nueva acta" onClick={() => setPanel("new")} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50"><tr><Th>N° Acta</Th><Th>Orden</Th><Th>Fecha</Th><Th>Recibido por</Th><Th>Entregado por</Th><Th></Th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {data.actas.map((a) => {
                const o = data.serviceOrders.find((o) => o.id === a.serviceOrderId);
                return (
                  <tr key={a.id} className="hover:bg-slate-50/60">
                    <Td mono>{a.numero}</Td><Td mono>{o?.numero || "—"}</Td><Td mono>{a.fecha}</Td><Td>{a.recibidoPor}</Td><Td>{a.entregadoPor}</Td>
                    <Td><RowActions onEdit={() => setPanel(a)} onDelete={() => remove(a.id)} /></Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {panel && <ActaForm initial={panel === "new" ? null : panel} serviceOrders={data.serviceOrders} onSave={save} onClose={() => setPanel(null)} />}
    </ViewShell>
  );
}

function ActaForm({ initial, serviceOrders, onSave, onClose }) {
  const [f, setF] = useState(initial || { serviceOrderId: serviceOrders[0]?.id || "", fecha: todayISO(), descripcionEntrega: "", recibidoPor: "", entregadoPor: "", observaciones: "" });
  const set = (k, v) => setF({ ...f, [k]: v });
  return (
    <Panel title={initial ? `Editar ${initial.numero}` : "Nueva acta de entrega"} onClose={onClose}>
      <div className="grid grid-cols-1 gap-3">
        <Field label="Orden de servicio">
          <Select value={f.serviceOrderId} onChange={(e) => set("serviceOrderId", e.target.value)}>
            {serviceOrders.length === 0 && <option value="">No hay órdenes de servicio</option>}
            {serviceOrders.map((o) => <option key={o.id} value={o.id}>{o.numero}</option>)}
          </Select>
        </Field>
        <Field label="Fecha"><TextInput type="date" value={f.fecha} onChange={(e) => set("fecha", e.target.value)} /></Field>
        <Field label="Descripción de la entrega"><TextArea value={f.descripcionEntrega} onChange={(e) => set("descripcionEntrega", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Recibido por (cliente)"><TextInput value={f.recibidoPor} onChange={(e) => set("recibidoPor", e.target.value)} /></Field>
          <Field label="Entregado por (Simeco)"><TextInput value={f.entregadoPor} onChange={(e) => set("entregadoPor", e.target.value)} /></Field>
        </div>
        <Field label="Observaciones"><TextArea value={f.observaciones} onChange={(e) => set("observaciones", e.target.value)} /></Field>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="btnGhost">Cancelar</button>
        <button onClick={() => onSave(f)} className="btnPrimary"><Save size={14} /> Guardar</button>
      </div>
    </Panel>
  );
}

/* =========================================================================
   10. FACTURACIÓN
   ========================================================================= */
function FacturacionView({ data, update, bumpCounter, clientName }) {
  const [panel, setPanel] = useState(null);
  const save = (inv) => {
    if (inv.id) update("invoices", (arr) => arr.map((x) => (x.id === inv.id ? inv : x)));
    else {
      const n = bumpCounter("fact");
      update("invoices", (arr) => [...arr, { ...inv, id: uid(), numero: `FE-${String(n).padStart(3, "0")}-${yy()}` }]);
    }
    setPanel(null);
  };
  const remove = (id) => update("invoices", (arr) => arr.filter((i) => i.id !== id));
  const marcarPagada = (inv) => update("invoices", (arr) => arr.map((x) => (x.id === inv.id ? { ...x, estado: "Pagada", fechaPago: todayISO() } : x)));

  const totalPendiente = data.invoices.filter((i) => i.estado === "Pendiente").reduce((s, i) => s + Number(i.valor || 0), 0);
  const totalPagado = data.invoices.filter((i) => i.estado === "Pagada").reduce((s, i) => s + Number(i.valor || 0), 0);

  return (
    <ViewShell title="Facturación" subtitle="Facturación de las actas de entrega cerradas" action={
      <button onClick={() => setPanel("new")} className="btnPrimary"><Plus size={14} /> Nueva factura</button>
    }>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:w-96">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-[11px] font-semibold uppercase text-amber-700">Pendiente</p>
          <p className="font-display text-lg font-semibold text-amber-800">{cop(totalPendiente)}</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-[11px] font-semibold uppercase text-emerald-700">Pagado</p>
          <p className="font-display text-lg font-semibold text-emerald-800">{cop(totalPagado)}</p>
        </div>
      </div>

      {data.invoices.length === 0 ? (
        <EmptyState icon={Receipt} text="Registra la facturación asociada a un acta de entrega." cta="Nueva factura" onClick={() => setPanel("new")} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50"><tr><Th>N° Factura</Th><Th>Acta</Th><Th>Fecha</Th><Th>Valor</Th><Th>Estado</Th><Th></Th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {data.invoices.map((inv) => {
                const a = data.actas.find((a) => a.id === inv.actaId);
                return (
                  <tr key={inv.id} className="hover:bg-slate-50/60">
                    <Td mono>{inv.numero}</Td><Td mono>{a?.numero || "—"}</Td><Td mono>{inv.fecha}</Td><Td>{cop(inv.valor)}</Td>
                    <Td><Badge>{inv.estado}</Badge></Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        {inv.estado === "Pendiente" && (
                          <button onClick={() => marcarPagada(inv)} className="rounded p-1.5 text-emerald-500 hover:bg-emerald-50"><CheckCircle2 size={14} /></button>
                        )}
                        <RowActions onEdit={() => setPanel(inv)} onDelete={() => remove(inv.id)} />
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {panel && <FacturaForm initial={panel === "new" ? null : panel} actas={data.actas} onSave={save} onClose={() => setPanel(null)} />}
    </ViewShell>
  );
}

function FacturaForm({ initial, actas, onSave, onClose }) {
  const [f, setF] = useState(initial || { actaId: actas[0]?.id || "", fecha: todayISO(), valor: 0, estado: "Pendiente", fechaPago: "" });
  const set = (k, v) => setF({ ...f, [k]: v });
  return (
    <Panel title={initial ? `Editar ${initial.numero}` : "Nueva factura"} onClose={onClose}>
      <div className="grid grid-cols-1 gap-3">
        <Field label="Acta de entrega">
          <Select value={f.actaId} onChange={(e) => set("actaId", e.target.value)}>
            {actas.length === 0 && <option value="">No hay actas de entrega</option>}
            {actas.map((a) => <option key={a.id} value={a.id}>{a.numero}</option>)}
          </Select>
        </Field>
        <Field label="Fecha"><TextInput type="date" value={f.fecha} onChange={(e) => set("fecha", e.target.value)} /></Field>
        <Field label="Valor"><TextInput type="number" value={f.valor} onChange={(e) => set("valor", e.target.value)} /></Field>
        <Field label="Estado">
          <Select value={f.estado} onChange={(e) => set("estado", e.target.value)}>
            {["Pendiente", "Pagada"].map((v) => <option key={v}>{v}</option>)}
          </Select>
        </Field>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="btnGhost">Cancelar</button>
        <button onClick={() => onSave(f)} className="btnPrimary"><Save size={14} /> Guardar</button>
      </div>
    </Panel>
  );
}

/* --------------------------------- SHELL -------------------------------- */
function ViewShell({ title, subtitle, action, children }) {
  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[#1B2430]">{title}</h1>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
      <style>{`
        .btnPrimary { display:inline-flex; align-items:center; gap:6px; background:#1B2430; color:white; padding:8px 14px; border-radius:8px; font-size:13px; font-weight:500; }
        .btnPrimary:hover { background:#2A3542; }
        .btnGhost { display:inline-flex; align-items:center; gap:6px; background:white; border:1px solid #CBD5E1; color:#334155; padding:8px 14px; border-radius:8px; font-size:13px; font-weight:500; }
        .btnGhost:hover { background:#F1F5F9; }
      `}</style>
    </div>
  );
}
