# Simeco Gestión — App instalable (PWA)

Esta es la misma aplicación que usas en Claude, empaquetada como una app web
que puedes instalar en un iPhone o Android desde el navegador, sin pasar por
App Store ni Play Store.

Los datos (clientes, cotizaciones, etc.) se guardan **en el navegador del
celular donde la instales**. Si la abres en varios celulares, cada uno
tendrá su propia información — no se sincroniza entre equipos, a menos que
más adelante conectemos una base de datos en la nube.

---

## Opción recomendada: publicar con Vercel (gratis, sin usar tu computador)

1. Crea una cuenta gratis en https://vercel.com (puedes entrar con tu cuenta
   de GitHub, Google, etc.)
2. Sube esta carpeta a un repositorio de GitHub:
   - Crea una cuenta en https://github.com si no tienes.
   - Crea un repositorio nuevo (por ejemplo "simeco-gestion").
   - Sube todos los archivos de esta carpeta (GitHub te deja arrastrar los
     archivos directamente desde el navegador, con el botón
     "Add file → Upload files").
3. En Vercel, dale a "Add New… → Project", elige el repositorio que acabas
   de subir, y presiona "Deploy". Vercel detecta que es un proyecto Vite y
   lo instala y compila automáticamente.
4. En 1-2 minutos te da un enlace tipo `https://simeco-gestion.vercel.app`.

## Instalar la app en el celular

**iPhone (Safari):**
1. Abre el enlace en Safari.
2. Toca el botón de compartir (el cuadrado con la flecha hacia arriba).
3. Elige "Agregar a pantalla de inicio".

**Android (Chrome):**
1. Abre el enlace en Chrome.
2. Toca el menú (los tres puntos, arriba a la derecha).
3. Elige "Instalar app" o "Agregar a pantalla de inicio".

Después de instalarla, el ícono queda en la pantalla de inicio como
cualquier otra app, y abre en pantalla completa (sin la barra del
navegador).

---

## Alternativa: correrlo tú mismo en tu computador (requiere Node.js)

Si prefieres compilarlo tú mismo antes de subirlo a algún hosting:

```bash
npm install
npm run build
```

Esto genera una carpeta `dist/` con la app ya compilada y lista para subir
a cualquier hosting (Vercel, Netlify, tu propio servidor, etc.). También
puedes probarla localmente antes de publicar con:

```bash
npm run dev
```

y abrir la dirección que te muestre en la terminal (usualmente
`http://localhost:5173`).

---

## ¿Y si más adelante quiero que los datos se sincronicen entre varios
celulares o computadores?

Eso requiere conectar una base de datos en la nube (por ejemplo Supabase,
que tiene plan gratuito). Es un cambio en `src/storagePolyfill.js` para que
en lugar de guardar en el navegador, guarde y lea de esa base de datos.
Cuando quieras dar ese paso, dímelo y lo dejamos listo.
