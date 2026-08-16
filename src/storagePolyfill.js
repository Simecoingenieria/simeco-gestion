// =====================================================================
// SIMECO GESTIÓN · storagePolyfill.js — VERSIÓN NUBE (v3)
//
// QUÉ HACE
// --------
// La versión que está hoy en GitHub guarda en localStorage: una gaveta
// privada dentro del navegador de CADA equipo. Por eso el celular y el
// PC ven datos distintos.
//
// Esta versión guarda en Supabase, en la tabla app_storage, y usa
// localStorage solo como copia de respaldo para dos cosas:
//   1. Que la app abra rápido, sin esperar la red.
//   2. Que si te quedas sin internet, sigas viendo la última versión.
//
// App.jsx NO SE TOCA. Ni una línea. La app llama a window.storage.get()
// y window.storage.set() igual que antes; lo único que cambia es a dónde
// van esos datos por dentro. Eso es una "interfaz": el enchufe queda
// igual, cambia lo que hay detrás de la pared.
//
// POR QUÉ app_storage Y NO OTRA TABLA
// -----------------------------------
// La tabla app_storage ya existía en la base, con datos dentro, y con
// las columnas exactas de esta API: key, scope, value, updated_at.
// Además tiene un disparador (trg_app_storage_log) que anota cada cambio
// en app_storage_log — una pista de auditoría automática. Se respeta lo
// que ya estaba construido en vez de duplicarlo.
//
// TODO VA CON scope = 'shared'
// ----------------------------
// App.jsx llama a estas funciones con shared = false, que en la versión
// vieja significaba "privado de este navegador". Aquí se ignora a
// propósito: el objetivo es justamente COMPARTIR entre equipos, y los
// datos que ya están en la tabla se guardaron con scope 'shared'.
//
// LÍMITE CONOCIDO (y aceptado por ahora)
// --------------------------------------
// Todo el estado va en una sola fila. Si dos personas editan al mismo
// tiempo desde equipos distintos, gana quien guarde de último. Para 2-3
// personas que no trabajan sobre lo mismo a la vez, funciona. Cuando el
// equipo crezca, se parte en tablas separadas.
// =====================================================================

import { supabase } from "./supabaseClient";

const TABLA = "app_storage";
const SCOPE = "shared";

function claveLocal(key) {
  return `simeco:shared:${key}`;
}

// Clave que usaba la versión vieja del archivo (shared = false → "user").
// Se consulta para rescatar datos de equipos que nunca subieron nada.
function claveVieja(key) {
  return `simeco:user:${key}`;
}

function leerLocal(clave) {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null; // navegador en modo privado o sin permisos
  }
}

function escribirLocal(clave, texto) {
  try {
    localStorage.setItem(clave, texto);
  } catch {
    /* sin espacio o sin permisos — la verdad está en la nube */
  }
}

// ¿Este texto JSON trae algo, o es un cascarón vacío?
// Sirve para no dar por buena una fila recién creada y en blanco.
function tieneContenido(texto) {
  if (!texto) return false;
  try {
    const o = JSON.parse(texto);
    return o && typeof o === "object" && Object.keys(o).length > 0;
  } catch {
    return String(texto).trim().length > 2;
  }
}

// Guardar en la nube. Se hace UPDATE y, si no existía la fila, INSERT.
// Se evita "upsert" a propósito: eso depende de cómo esté definida la
// restricción única de la tabla, y así funciona sin suponer nada.
async function guardarEnNube(key, value) {
  const { data, error } = await supabase
    .from(TABLA)
    .update({ value, updated_at: new Date().toISOString() })
    .eq("key", key)
    .eq("scope", SCOPE)
    .select("key");

  if (error) return error;
  if (data && data.length > 0) return null; // ya existía y se actualizó

  const { error: errIns } = await supabase
    .from(TABLA)
    .insert({ key, scope: SCOPE, value });
  return errIns || null;
}

window.storage = {
  // -------------------------------------------------------------------
  // get(key) — traer un bloque de datos
  //
  // Orden de intentos:
  //   1. La nube, si trae datos de verdad. Es la fuente de la verdad.
  //   2. Si la nube está vacía, el respaldo local (nuevo o de la versión
  //      vieja) y de paso lo sube, para que quede compartido.
  //   3. Si no hay nada en ninguna parte, lanza un error — que es lo que
  //      App.jsx espera cuando aún no hay datos (lo atrapa con try/catch
  //      y arranca con la app vacía).
  // -------------------------------------------------------------------
  async get(key, shared = false) {
    const { data, error } = await supabase
      .from(TABLA)
      .select("value")
      .eq("key", key)
      .eq("scope", SCOPE)
      .maybeSingle(); // "espero 0 o 1 fila, no me revientes si es 0"

    // --- Caso 1: la nube tiene datos ---
    if (!error && data && tieneContenido(data.value)) {
      escribirLocal(claveLocal(key), data.value);
      return { key, value: data.value, shared: true };
    }

    // --- Caso 2: la nube está vacía o no respondió. Buscamos respaldo ---
    const respaldo = leerLocal(claveLocal(key)) ?? leerLocal(claveVieja(key));

    if (respaldo !== null) {
      // Si la nube respondió bien pero venía vacía, sembramos lo que había
      // en este equipo. Si no respondió (red caída), NO subimos nada.
      if (!error && tieneContenido(respaldo)) {
        const err = await guardarEnNube(key, respaldo);
        if (!err) escribirLocal(claveLocal(key), respaldo);
      }
      return { key, value: respaldo, shared: true };
    }

    // --- Caso 3: no hay nada. La app arranca en blanco ---
    throw new Error("Key not found: " + key);
  },

  // -------------------------------------------------------------------
  // set(key, value) — guardar un bloque de datos
  //
  // Primero el respaldo local (instantáneo, nunca falla feo) y después
  // la nube. Si la nube falla, lanza el error para que App.jsx muestre
  // el aviso "No se pudo guardar".
  // -------------------------------------------------------------------
  async set(key, value, shared = false) {
    escribirLocal(claveLocal(key), value);

    const error = await guardarEnNube(key, value);
    if (error) {
      throw new Error("No se pudo guardar en la nube: " + error.message);
    }
    return { key, value, shared: true };
  },

  // -------------------------------------------------------------------
  // delete(key) — borrar un bloque
  // -------------------------------------------------------------------
  async delete(key, shared = false) {
    try {
      localStorage.removeItem(claveLocal(key));
    } catch {
      /* da igual */
    }

    const { error } = await supabase
      .from(TABLA)
      .delete()
      .eq("key", key)
      .eq("scope", SCOPE);

    if (error) {
      throw new Error("No se pudo borrar en la nube: " + error.message);
    }
    return { key, deleted: true, shared: true };
  },

  // -------------------------------------------------------------------
  // list(prefix) — listar las claves guardadas
  //
  // La app hoy no la usa, pero se mantiene para no romper la interfaz.
  // "like 'prefijo%'" en SQL es lo mismo que "empieza por".
  // -------------------------------------------------------------------
  async list(prefix = "", shared = false) {
    const { data, error } = await supabase
      .from(TABLA)
      .select("key")
      .eq("scope", SCOPE)
      .like("key", `${prefix}%`);

    if (error || !data) return { keys: [], prefix, shared: true };
    return { keys: data.map((f) => f.key), prefix, shared: true };
  },
};
