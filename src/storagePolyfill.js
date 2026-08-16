
// =====================================================================
// SIMECO GESTIÓN · Guardia.jsx — la puerta de entrada
//
// QUÉ HACE
// --------
// Es un envoltorio. Se pone alrededor de la app entera y decide:
//   · ¿No hay sesión?  → muestra el formulario de login y nada más.
//   · ¿Hay sesión?     → deja pasar y muestra la app normal.
//
// EL MISMO TRUCO DE LA CLASE 1
// ----------------------------
// App.jsx NO SE TOCA. Otra vez. En React, un componente puede recibir a
// otro adentro (eso es "children"), y así le pones un filtro delante sin
// modificarlo por dentro. Es como poner un torniquete en la entrada del
// edificio: las oficinas siguen igual.
//
// El cambio en main.jsx son 3 líneas. Nada más.
//
// NO HAY BOTÓN DE "REGISTRARSE", Y ES A PROPÓSITO
// -----------------------------------------------
// Los usuarios los creas tú desde el panel de Supabase. Si hubiera un
// botón de registro, cualquiera que encuentre la dirección se crearía
// una cuenta y entraría. La app solo deja iniciar sesión, no crearla.
// =====================================================================
 
import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
 
export default function Guardia({ children }) {
  // sesion === undefined → todavía no sabemos (estamos preguntando)
  // sesion === null      → no hay nadie con login
  // sesion === {...}     → hay usuario
  const [sesion, setSesion] = useState(undefined);
 
  useEffect(() => {
    // 1. ¿Hay una sesión guardada de la última vez? Supabase la recuerda
    //    en el navegador, así que no hay que entrar cada mañana.
    supabase.auth.getSession().then(({ data }) => setSesion(data.session));
 
    // 2. Quedarse escuchando: si entra o sale, la pantalla reacciona sola.
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => {
      setSesion(s);
    });
 
    // 3. Al desmontar el componente, dejamos de escuchar. Si no se hace,
    //    quedan "escuchas" colgados consumiendo memoria.
    return () => sub.subscription.unsubscribe();
  }, []);
 
  if (sesion === undefined) return <Cargando />;
  if (!sesion) return <Login />;
 
  return (
    <>
      {children}
      <BotonSalir correo={sesion.user?.email} />
    </>
  );
}
 
/* -------------------------------------------------------------------- */
 
function Cargando() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <p className="text-sm text-slate-400">Cargando…</p>
    </div>
  );
}
 
/* -------------------------------------------------------------------- */
 
function Login() {
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [entrando, setEntrando] = useState(false);
 
  const entrar = async (e) => {
    e.preventDefault(); // evita que el navegador recargue la página
    setEntrando(true);
    setError("");
 
    const { error } = await supabase.auth.signInWithPassword({
      email: correo.trim(),
      password: clave,
    });
 
    // Si sale bien, no hacemos nada aquí: el onAuthStateChange de arriba
    // se entera solo y cambia la pantalla.
    if (error) {
      // A propósito NO decimos "ese correo no existe" ni "la contraseña
      // está mala". Un mensaje genérico evita que alguien vaya probando
      // correos para descubrir cuáles son válidos.
      setError("Correo o contraseña incorrectos.");
      setEntrando(false);
    }
  };
 
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={entrar}
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-7 shadow-sm"
      >
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">
          SIMECO Gestión
        </h1>
        <p className="mt-1 mb-6 text-sm text-slate-500">
          Herramienta interna. Inicia sesión para continuar.
        </p>
 
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Correo
        </label>
        <input
          type="email"
          required
          autoComplete="username"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
        />
 
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Contraseña
        </label>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          className="mb-5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
        />
 
        {error && (
          <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
            {error}
          </div>
        )}
 
        <button
          type="submit"
          disabled={entrando}
          className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
        >
          {entrando ? "Entrando…" : "Entrar"}
        </button>
 
        <p className="mt-5 text-center text-[11px] leading-relaxed text-slate-400">
          ¿Sin cuenta o clave olvidada? Las cuentas se crean desde el panel
          de Supabase.
        </p>
      </form>
    </div>
  );
}
 
/* -------------------------------------------------------------------- */
 
function BotonSalir({ correo }) {
  return (
    <button
      onClick={() => supabase.auth.signOut()}
      title={correo}
      className="fixed bottom-4 right-4 z-50 rounded-full border border-slate-300 bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur transition hover:bg-white hover:text-slate-900"
    >
      Salir
    </button>
  );
}
