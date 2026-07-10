import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, Image as ImageIcon, Send, FileSpreadsheet, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "./supabaseClient";

/**
 * Módulo: Requisición de Cotización (Cliente)
 * Código base: FO.GGC.02
 * Proceso: Gestión Gerencial y Comercial (B)
 *
 * Este formulario es el insumo de entrada para el Cotizador.
 * Replica 1:1 las 3 hojas del Excel original:
 *   1. Datos Generales
 *   2. Materiales
 *   3. Mano de Obra / Recurso Humano / Herramientas / Diagrama
 */

const ROLES_SUGERIDOS = [
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

const emptyMaterial = () => ({ id: crypto.randomUUID(), descripcion: "", cantidad: "", unidad: "", observaciones: "" });
const emptyManoObra = () => ({ id: crypto.randomUUID(), descripcion: "", cantidad: "", unidad: "", observaciones: "" });
const emptyRecursoHumano = () => ({ id: crypto.randomUUID(), descripcion: "", cantidad: "", dias: "", observaciones: "" });
const emptyHerramienta = () => ({ id: crypto.randomUUID(), descripcion: "", cantidad: "", unidad: "", observaciones: "" });

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  fontSize: 13,
  border: "1px solid #D3D1C7",
  borderRadius: 6,
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const labelStyle = {
  fontSize: 12,
  fontWeight: 500,
  color: "#5F5E5A",
  marginBottom: 4,
  display: "block",
};

function Field({ label, children, span }) {
  return (
    <div style={{ gridColumn: span ? `span ${span}` : undefined }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function SectionCard({ title, subtitle, children }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E5E5E5",
        borderRadius: 10,
        padding: 20,
        marginBottom: 20,
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#1F3864" }}>{title}</h3>
        {subtitle && (
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "#888780" }}>{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function TablaEditable({ columnas, filas, setFilas, nuevaFila, placeholderExtra }) {
  const actualizar = (id, campo, valor) => {
    setFilas(filas.map((f) => (f.id === id ? { ...f, [campo]: valor } : f)));
  };
  const eliminar = (id) => setFilas(filas.filter((f) => f.id !== id));

  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {columnas.map((c) => (
                <th
                  key={c.key}
                  style={{
                    textAlign: "left",
                    fontSize: 11,
                    fontWeight: 500,
                    color: "#5F5E5A",
                    padding: "6px 8px",
                    borderBottom: "1px solid #E5E5E5",
                  }}
                >
                  {c.label}
                </th>
              ))}
              <th style={{ width: 32 }} />
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={fila.id}>
                {columnas.map((c) => (
                  <td key={c.key} style={{ padding: "4px 8px", verticalAlign: "top" }}>
                    <input
                      style={inputStyle}
                      placeholder={c.placeholder || ""}
                      list={c.key === "descripcion" && placeholderExtra ? "roles-sugeridos" : undefined}
                      value={fila[c.key]}
                      onChange={(e) => actualizar(fila.id, c.key, e.target.value)}
                    />
                  </td>
                ))}
                <td style={{ padding: "4px 8px" }}>
                  <button
                    onClick={() => eliminar(fila.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#993C1D" }}
                    aria-label="Eliminar fila"
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={() => setFilas([...filas, nuevaFila()])}
        style={{
          marginTop: 10,
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: "1px dashed #B4B2A9",
          borderRadius: 6,
          padding: "6px 12px",
          fontSize: 12,
          color: "#5F5E5A",
          cursor: "pointer",
        }}
      >
        <Plus size={14} /> Agregar fila
      </button>
    </div>
  );
}

// Guarda solo el ID del borrador activo en este navegador (no los datos).
// Sirve para retomar automáticamente sin preguntar, en el mismo dispositivo.
const ID_ACTIVO_KEY = "simeco_rq_borrador_id";

const generalesVacio = {
  cliente: "",
  sede: "",
  fechaSolicitud: "",
  fechaLimite: "",
  solicitanteNombre: "",
  solicitanteCargo: "",
  solicitanteTelefono: "",
  solicitanteCorreo: "",
  proyecto: "",
  servicio: "",
  palabraClave: "",
};

// Convierte el estado del formulario al formato de columnas de Supabase
const aFilaSupabase = (generales, materiales, manoObra, recursoHumano, herramientas) => ({
  cliente: generales.cliente || "(sin nombre)",
  sede: generales.sede,
  fecha_solicitud: generales.fechaSolicitud || null,
  fecha_limite: generales.fechaLimite || null,
  solicitante_nombre: generales.solicitanteNombre,
  solicitante_cargo: generales.solicitanteCargo,
  solicitante_telefono: generales.solicitanteTelefono,
  solicitante_correo: generales.solicitanteCorreo,
  proyecto: generales.proyecto,
  servicio: generales.servicio,
  palabra_clave: generales.palabraClave,
  materiales,
  mano_obra: manoObra,
  recurso_humano: recursoHumano,
  herramientas,
});

// Convierte una fila de Supabase de vuelta al formato del formulario
const deFilaSupabase = (fila) => ({
  generales: {
    cliente: fila.cliente || "",
    sede: fila.sede || "",
    fechaSolicitud: fila.fecha_solicitud || "",
    fechaLimite: fila.fecha_limite || "",
    solicitanteNombre: fila.solicitante_nombre || "",
    solicitanteCargo: fila.solicitante_cargo || "",
    solicitanteTelefono: fila.solicitante_telefono || "",
    solicitanteCorreo: fila.solicitante_correo || "",
    proyecto: fila.proyecto || "",
    servicio: fila.servicio || "",
    palabraClave: fila.palabra_clave || "",
  },
  materiales: fila.materiales?.length ? fila.materiales : [emptyMaterial()],
  manoObra: fila.mano_obra?.length ? fila.mano_obra : [emptyManoObra()],
  recursoHumano: fila.recurso_humano?.length ? fila.recurso_humano : [emptyRecursoHumano()],
  herramientas: fila.herramientas?.length ? fila.herramientas : [emptyHerramienta()],
});

export default function RequisicionCotizacion({ onEnviarACotizador = () => {} }) {
  const [generales, setGenerales] = useState(generalesVacio);
  const [materiales, setMateriales] = useState([emptyMaterial()]);
  const [manoObra, setManoObra] = useState([emptyManoObra()]);
  const [recursoHumano, setRecursoHumano] = useState([emptyRecursoHumano()]);
  const [herramientas, setHerramientas] = useState([emptyHerramienta()]);
  // Nota: las fotos se suben aparte a Supabase Storage; ver handleArchivos.
  const [archivos, setArchivos] = useState([]);
  const [importando, setImportando] = useState(""); // "" | "materiales" | "herramientas"
  const [errorImportacion, setErrorImportacion] = useState({ materiales: "", herramientas: "" });
  const [ultimoGuardado, setUltimoGuardado] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [idActivo, setIdActivo] = useState(null);
  const [borradoresDisponibles, setBorradoresDisponibles] = useState([]);
  const [cargandoBorradores, setCargandoBorradores] = useState(true);
  const materialesInputRef = useRef(null);
  const herramientasInputRef = useRef(null);
  const primerRenderRef = useRef(true);

  // Al montar: si este navegador ya tenía una RQ en curso, la retoma sola.
  // Si no, busca en Supabase si hay borradores recientes (de cualquier
  // dispositivo) para ofrecer continuarlos.
  useEffect(() => {
    const cargar = async () => {
      const idGuardado = localStorage.getItem(ID_ACTIVO_KEY);
      if (idGuardado) {
        const { data, error } = await supabase
          .from("requisiciones_cotizacion")
          .select("*")
          .eq("id", idGuardado)
          .maybeSingle();
        if (data && !error) {
          const restaurado = deFilaSupabase(data);
          setGenerales(restaurado.generales);
          setMateriales(restaurado.materiales);
          setManoObra(restaurado.manoObra);
          setRecursoHumano(restaurado.recursoHumano);
          setHerramientas(restaurado.herramientas);
          setIdActivo(data.id);
          setUltimoGuardado("restaurado");
          setCargandoBorradores(false);
          return;
        }
      }
      // No hay borrador activo en este navegador: muestra los últimos
      // borradores guardados en Supabase (de cualquier dispositivo/usuario)
      const { data: recientes } = await supabase
        .from("requisiciones_cotizacion")
        .select("id, cliente, proyecto, servicio, updated_at")
        .eq("estado", "borrador")
        .order("updated_at", { ascending: false })
        .limit(5);
      setBorradoresDisponibles(recientes || []);
      setCargandoBorradores(false);
    };
    cargar();
  }, []);

  // Autoguardado real: cada vez que cambia algo, guarda (o crea) la fila
  // en Supabase. Ya no depende del navegador — cualquier dispositivo con
  // el mismo id puede seguir editando la misma RQ.
  useEffect(() => {
    if (primerRenderRef.current) {
      primerRenderRef.current = false;
      return;
    }
    if (cargandoBorradores) return; // evita guardar mientras aún carga el borrador inicial

    const guardar = async () => {
      setGuardando(true);
      const fila = aFilaSupabase(generales, materiales, manoObra, recursoHumano, herramientas);

      if (idActivo) {
        const { error } = await supabase
          .from("requisiciones_cotizacion")
          .update(fila)
          .eq("id", idActivo);
        if (error) console.warn("No se pudo actualizar la RQ en Supabase:", error);
      } else {
        const { data, error } = await supabase
          .from("requisiciones_cotizacion")
          .insert({ ...fila, estado: "borrador" })
          .select("id")
          .single();
        if (error) {
          console.warn("No se pudo crear la RQ en Supabase:", error);
        } else if (data) {
          setIdActivo(data.id);
          localStorage.setItem(ID_ACTIVO_KEY, data.id);
        }
      }
      setUltimoGuardado(new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setGuardando(false);
    };

    const temporizador = setTimeout(guardar, 800); // debounce: espera una pausa al escribir
    return () => clearTimeout(temporizador);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generales, materiales, manoObra, recursoHumano, herramientas]);

  const continuarBorrador = async (id) => {
    setCargandoBorradores(true);
    const { data, error } = await supabase
      .from("requisiciones_cotizacion")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (data && !error) {
      const restaurado = deFilaSupabase(data);
      setGenerales(restaurado.generales);
      setMateriales(restaurado.materiales);
      setManoObra(restaurado.manoObra);
      setRecursoHumano(restaurado.recursoHumano);
      setHerramientas(restaurado.herramientas);
      setIdActivo(data.id);
      localStorage.setItem(ID_ACTIVO_KEY, data.id);
      setUltimoGuardado("restaurado");
    }
    setBorradoresDisponibles([]);
    setCargandoBorradores(false);
  };

  const limpiarBorrador = () => {
    if (!confirm("¿Descartar este borrador y empezar una RQ nueva en blanco?")) return;
    localStorage.removeItem(ID_ACTIVO_KEY);
    setIdActivo(null);
    setGenerales(generalesVacio);
    setMateriales([emptyMaterial()]);
    setManoObra([emptyManoObra()]);
    setRecursoHumano([emptyRecursoHumano()]);
    setHerramientas([emptyHerramienta()]);
    setArchivos([]);
    setUltimoGuardado(null);
  };

  const actualizarGeneral = (campo, valor) => setGenerales((g) => ({ ...g, [campo]: valor }));

  // Busca la columna correcta sin importar mayúsculas, tildes o el nombre exacto
  const encontrarColumna = (fila, posibles) => {
    const claves = Object.keys(fila);
    const normalizar = (s) =>
      s.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    for (const posible of posibles) {
      const encontrada = claves.find((k) => normalizar(k).includes(normalizar(posible)));
      if (encontrada) return fila[encontrada];
    }
    return "";
  };

  // Importador genérico: sirve tanto para Materiales como para Herramientas
  // (misma estructura de columnas: descripción, cantidad, unidad, observaciones)
  const importarDesdeExcel = (destino, setFilas, inputRef, columnasDescripcion) => async (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setImportando(destino);
    setErrorImportacion((prev) => ({ ...prev, [destino]: "" }));
    try {
      const buffer = await archivo.arrayBuffer();
      const libro = XLSX.read(buffer, { type: "array" });
      const hoja = libro.Sheets[libro.SheetNames[0]];
      const filas = XLSX.utils.sheet_to_json(hoja, { defval: "" });

      if (!filas.length) {
        setErrorImportacion((prev) => ({ ...prev, [destino]: "El archivo no tiene filas de datos legibles." }));
        return;
      }

      const nuevasFilas = filas
        .map((fila) => ({
          id: crypto.randomUUID(),
          descripcion: String(encontrarColumna(fila, columnasDescripcion)),
          cantidad: String(encontrarColumna(fila, ["cantidad", "cant"])),
          unidad: String(encontrarColumna(fila, ["unidad", "und", "um"])),
          observaciones: String(encontrarColumna(fila, ["observaciones", "obs", "nota"])),
        }))
        // descarta filas totalmente vacías o de encabezado repetido
        .filter((m) => m.descripcion.trim() !== "");

      if (!nuevasFilas.length) {
        setErrorImportacion((prev) => ({
          ...prev,
          [destino]: "No se encontraron columnas de descripción y cantidad reconocibles. Verifica los encabezados del Excel.",
        }));
        return;
      }

      // Reemplaza filas vacías iniciales, conserva las que ya tenían datos
      setFilas((prev) => {
        const conDatos = prev.filter((f) => f.descripcion.trim() !== "");
        return [...conDatos, ...nuevasFilas];
      });
    } catch (err) {
      setErrorImportacion((prev) => ({ ...prev, [destino]: "No se pudo leer el archivo. Confirma que sea un .xlsx o .csv válido." }));
    } finally {
      setImportando("");
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const importarMaterialesDesdeExcel = importarDesdeExcel(
    "materiales",
    setMateriales,
    materialesInputRef,
    ["descripcion", "material", "item", "producto"]
  );

  const importarHerramientasDesdeExcel = importarDesdeExcel(
    "herramientas",
    setHerramientas,
    herramientasInputRef,
    ["descripcion", "herramienta", "equipo", "item"]
  );

  const handleArchivos = (e) => {
    const nuevos = Array.from(e.target.files || []).map((f) => ({
      id: crypto.randomUUID(),
      nombre: f.name,
      url: URL.createObjectURL(f),
    }));
    setArchivos((prev) => [...prev, ...nuevos]);
  };

  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // Marca la RQ como "enviada_a_cotizador" en Supabase.
  // El Cotizador debe leerla luego con:
  //   supabase.from('requisiciones_cotizacion').select('*').eq('id', rqId).single()
  // usando el id que llega aquí por onEnviarACotizador({ id, ...datos }).
  const enviar = async () => {
    if (!idActivo) {
      alert("La RQ todavía se está guardando, espera un momento y vuelve a intentar.");
      return;
    }
    setEnviando(true);
    const fila = aFilaSupabase(generales, materiales, manoObra, recursoHumano, herramientas);
    const { error } = await supabase
      .from("requisiciones_cotizacion")
      .update({ ...fila, estado: "enviada_a_cotizador" })
      .eq("id", idActivo);

    setEnviando(false);
    if (error) {
      alert("No se pudo enviar la RQ a Supabase. Revisa la consola para más detalle.");
      console.error(error);
      return;
    }

    onEnviarACotizador({
      id: idActivo,
      codigo: "FO.GGC.02",
      generales,
      materiales,
      manoObra,
      recursoHumano,
      herramientas,
      archivos,
    });
    localStorage.removeItem(ID_ACTIVO_KEY);
    setEnviado(true);
    setTimeout(() => setEnviado(false), 4000);
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", fontFamily: "system-ui, sans-serif", paddingBottom: 40 }}>
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, color: "#0F6B5C", fontWeight: 600, letterSpacing: 0.4 }}>
            B. GESTIÓN GERENCIAL Y COMERCIAL · FO.GGC.02
          </div>
          <h2 style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 600, color: "#1F3864" }}>
            Requisición de cotización
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#888780" }}>
            Registra la solicitud del cliente. Esta información alimenta directamente el Cotizador.
          </p>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
          {ultimoGuardado === "restaurado" ? (
            <div style={{ fontSize: 11.5, color: "#0F6B5C", fontWeight: 500 }}>Borrador restaurado desde Supabase</div>
          ) : guardando ? (
            <div style={{ fontSize: 11.5, color: "#888780" }}>Guardando...</div>
          ) : ultimoGuardado ? (
            <div style={{ fontSize: 11.5, color: "#888780" }}>Guardado {ultimoGuardado}</div>
          ) : null}
          {idActivo && (
            <button
              onClick={limpiarBorrador}
              style={{ background: "none", border: "none", fontSize: 11.5, color: "#993C1D", cursor: "pointer", padding: 0, marginTop: 4 }}
            >
              Descartar y empezar nueva
            </button>
          )}
        </div>
      </div>

      {borradoresDisponibles.length > 0 && (
        <div
          style={{
            background: "#FAEEDA",
            border: "1px solid #F0997B33",
            borderRadius: 8,
            padding: 14,
            marginBottom: 20,
          }}
        >
          <div style={{ fontSize: 12.5, fontWeight: 500, color: "#633806", marginBottom: 8 }}>
            Hay borradores sin terminar guardados en Supabase. ¿Quieres continuar alguno en vez de empezar uno nuevo?
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {borradoresDisponibles.map((b) => (
              <button
                key={b.id}
                onClick={() => continuarBorrador(b.id)}
                style={{
                  textAlign: "left",
                  background: "#fff",
                  border: "1px solid #E5E5E5",
                  borderRadius: 6,
                  padding: "8px 12px",
                  fontSize: 12.5,
                  cursor: "pointer",
                }}
              >
                <strong>{b.cliente || "(sin cliente)"}</strong>
                {b.proyecto ? ` — ${b.proyecto}` : ""}
                <span style={{ color: "#888780", marginLeft: 8 }}>
                  {new Date(b.updated_at).toLocaleString("es-CO")}
                </span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setBorradoresDisponibles([])}
            style={{ background: "none", border: "none", fontSize: 11.5, color: "#888780", cursor: "pointer", marginTop: 8, padding: 0 }}
          >
            No, empezar una RQ nueva
          </button>
        </div>
      )}

      <SectionCard title="Datos generales">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Nombre del cliente">
            <input style={inputStyle} value={generales.cliente} onChange={(e) => actualizarGeneral("cliente", e.target.value)} />
          </Field>
          <Field label="Sede o ciudad">
            <input style={inputStyle} value={generales.sede} onChange={(e) => actualizarGeneral("sede", e.target.value)} />
          </Field>
          <Field label="Fecha de la solicitud">
            <input type="date" style={inputStyle} value={generales.fechaSolicitud} onChange={(e) => actualizarGeneral("fechaSolicitud", e.target.value)} />
          </Field>
          <Field label="Fecha límite de envío de cotización">
            <input type="date" style={inputStyle} value={generales.fechaLimite} onChange={(e) => actualizarGeneral("fechaLimite", e.target.value)} />
          </Field>
          <Field label="Nombre de quien solicita">
            <input style={inputStyle} value={generales.solicitanteNombre} onChange={(e) => actualizarGeneral("solicitanteNombre", e.target.value)} />
          </Field>
          <Field label="Cargo de quien solicita">
            <input style={inputStyle} value={generales.solicitanteCargo} onChange={(e) => actualizarGeneral("solicitanteCargo", e.target.value)} />
          </Field>
          <Field label="Teléfono de contacto">
            <input style={inputStyle} value={generales.solicitanteTelefono} onChange={(e) => actualizarGeneral("solicitanteTelefono", e.target.value)} />
          </Field>
          <Field label="Correo electrónico">
            <input type="email" style={inputStyle} value={generales.solicitanteCorreo} onChange={(e) => actualizarGeneral("solicitanteCorreo", e.target.value)} />
          </Field>
          <Field label="Proyecto">
            <input style={inputStyle} placeholder="Nombre o alcance general" value={generales.proyecto} onChange={(e) => actualizarGeneral("proyecto", e.target.value)} />
          </Field>
          <Field label="Servicio">
            <input style={inputStyle} placeholder="Clasificación específica del servicio" value={generales.servicio} onChange={(e) => actualizarGeneral("servicio", e.target.value)} />
          </Field>
          <Field label="Palabra clave" span={2}>
            <input style={inputStyle} value={generales.palabraClave} onChange={(e) => actualizarGeneral("palabraClave", e.target.value)} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Materiales" subtitle="Descripción, cantidad, unidad y observaciones">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <button
            onClick={() => materialesInputRef.current?.click()}
            disabled={importando === "materiales"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "#E1F5EE",
              color: "#085041",
              border: "none",
              borderRadius: 6,
              padding: "7px 14px",
              fontSize: 12.5,
              fontWeight: 500,
              cursor: importando === "materiales" ? "default" : "pointer",
            }}
          >
            {importando === "materiales" ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
            {importando === "materiales" ? "Leyendo archivo..." : "Importar desde Excel"}
          </button>
          <span style={{ fontSize: 11.5, color: "#888780" }}>.xlsx o .csv — columnas: descripción, cantidad, unidad</span>
          <input
            ref={materialesInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: "none" }}
            onChange={importarMaterialesDesdeExcel}
          />
        </div>
        {errorImportacion.materiales && (
          <div
            style={{
              background: "#FAECE7",
              color: "#993C1D",
              fontSize: 12,
              padding: "8px 12px",
              borderRadius: 6,
              marginBottom: 14,
            }}
          >
            {errorImportacion.materiales}
          </div>
        )}
        <TablaEditable
          columnas={[
            { key: "descripcion", label: "Descripción", placeholder: "Ej. Cable THHN 12 AWG" },
            { key: "cantidad", label: "Cant." },
            { key: "unidad", label: "Und" },
            { key: "observaciones", label: "Observaciones" },
          ]}
          filas={materiales}
          setFilas={setMateriales}
          nuevaFila={emptyMaterial}
        />
      </SectionCard>

      <SectionCard title="Mano de obra">
        <TablaEditable
          columnas={[
            { key: "descripcion", label: "Descripción", placeholder: "Ej. Soporte técnico mecánico especializado" },
            { key: "cantidad", label: "Cant." },
            { key: "unidad", label: "Und" },
            { key: "observaciones", label: "Observaciones" },
          ]}
          filas={manoObra}
          setFilas={setManoObra}
          nuevaFila={emptyManoObra}
        />
      </SectionCard>

      <SectionCard title="Recurso humano" subtitle="Roles internos requeridos para la ejecución">
        <datalist id="roles-sugeridos">
          {ROLES_SUGERIDOS.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
        <TablaEditable
          columnas={[
            { key: "descripcion", label: "Rol", placeholder: "Ej. Supervisor técnico" },
            { key: "cantidad", label: "Cant." },
            { key: "dias", label: "Días" },
            { key: "observaciones", label: "Observaciones" },
          ]}
          filas={recursoHumano}
          setFilas={setRecursoHumano}
          nuevaFila={emptyRecursoHumano}
          placeholderExtra
        />
      </SectionCard>

      <SectionCard title="Herramientas o equipos especiales">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <button
            onClick={() => herramientasInputRef.current?.click()}
            disabled={importando === "herramientas"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "#E1F5EE",
              color: "#085041",
              border: "none",
              borderRadius: 6,
              padding: "7px 14px",
              fontSize: 12.5,
              fontWeight: 500,
              cursor: importando === "herramientas" ? "default" : "pointer",
            }}
          >
            {importando === "herramientas" ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
            {importando === "herramientas" ? "Leyendo archivo..." : "Importar desde Excel"}
          </button>
          <span style={{ fontSize: 11.5, color: "#888780" }}>.xlsx o .csv — columnas: descripción, cantidad, unidad</span>
          <input
            ref={herramientasInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: "none" }}
            onChange={importarHerramientasDesdeExcel}
          />
        </div>
        {errorImportacion.herramientas && (
          <div
            style={{
              background: "#FAECE7",
              color: "#993C1D",
              fontSize: 12,
              padding: "8px 12px",
              borderRadius: 6,
              marginBottom: 14,
            }}
          >
            {errorImportacion.herramientas}
          </div>
        )}
        <TablaEditable
          columnas={[
            { key: "descripcion", label: "Descripción" },
            { key: "cantidad", label: "Cant." },
            { key: "unidad", label: "Und" },
            { key: "observaciones", label: "Observaciones" },
          ]}
          filas={herramientas}
          setFilas={setHerramientas}
          nuevaFila={emptyHerramienta}
        />
      </SectionCard>

      <SectionCard title="Diagrama o fotos" subtitle="Evidencia visual de referencia para la cotización">
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            border: "1px dashed #B4B2A9",
            borderRadius: 8,
            padding: 24,
            cursor: "pointer",
            color: "#888780",
          }}
        >
          <ImageIcon size={22} />
          <span style={{ fontSize: 12.5 }}>Haz clic para adjuntar imágenes</span>
          <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleArchivos} />
        </label>
        {archivos.length > 0 && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            {archivos.map((a) => (
              <img
                key={a.id}
                src={a.url}
                alt={a.nombre}
                style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 6, border: "1px solid #E5E5E5" }}
              />
            ))}
          </div>
        )}
      </SectionCard>

      <button
        onClick={enviar}
        disabled={enviando}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "#1F3864",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          padding: "12px 22px",
          fontSize: 13.5,
          fontWeight: 500,
          cursor: enviando ? "default" : "pointer",
          opacity: enviando ? 0.7 : 1,
        }}
      >
        {enviando ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        {enviando ? "Enviando..." : "Enviar al Cotizador"}
      </button>
      {enviado && (
        <div
          style={{
            marginTop: 12,
            background: "#E1F5EE",
            color: "#085041",
            fontSize: 13,
            padding: "10px 14px",
            borderRadius: 6,
          }}
        >
          Requisición guardada en Supabase (id: {idActivo}). El Cotizador puede leerla consultando esa fila en la tabla "requisiciones_cotizacion".
        </div>
      )}
    </div>
  );
}
