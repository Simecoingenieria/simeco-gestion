// =====================================================================
// SIMECO GESTIÓN · main.jsx
//
// Este es el arranque de la app: el archivo que el navegador ejecuta
// primero. Solo tiene una tarea — decir "pinta <App /> dentro del div
// que se llama root".
//
// CAMBIO DE LA CLASE 2 (3 líneas):
//   · se importa Guardia
//   · <App /> queda envuelto en <Guardia> … </Guardia>
//
// A partir de aquí, nada de la app se dibuja sin sesión iniciada.
// App.jsx sigue sin enterarse de que existe un login. Ese es el punto.
// =====================================================================

import "./storagePolyfill.js";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import Guardia from "./Guardia.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Guardia>
      <App />
    </Guardia>
  </React.StrictMode>
);
