# El Periquete — Contexto del proyecto (ancla para nuevas sesiones)

> **Leé esto primero al empezar cada sesión.** Resume qué es el proyecto, cómo está
> hecho, cómo se publica y todo lo construido hasta hoy.
> **Última actualización: 2026-06-27.**

---

## 1. Qué es

Sistema web de gestión para la despensa/kiosco **"El Periquete"** (Argentina).
Lo usa **Javier** (dueño, **NO técnico**) y una empleada (tampoco muy técnica).
Por eso todo tiene que ser **simple, intuitivo, en español rioplatense, mobile-first**.

- **Dueño / interlocutor:** Javier Amado — `javieramado91@gmail.com`.
- Hablale en **criollo/argentino**, sin tecnicismos. Explicá con analogías.
- **Verificá las cosas antes de hacerlo probar** (Javier se frustra si "no funciona").

## 2. Stack y arquitectura

- **HTML + CSS + JavaScript puro** (ES Modules vía `importmap`, **sin frameworks, sin build step**).
- **Firebase**: Authentication (Email/Password) + Firestore. SDK v10 modular por CDN.
- **Sitio 100% estático** servido por Vercel. **Ya NO hay funciones serverless** (`api/` quedó vacío; se eliminó toda la IA).
- **Sin Node local instalado** en la PC de Javier (no se pueden correr scripts node localmente).

### Despliegue (importante)
- **GitHub:** `https://github.com/javieramado91-dotcom/KioscoElPeriquete67` (rama `main`).
- **Vercel:** se despliega **solo con cada push a `main`**. URL pública: `https://kiosco-el-periquete67.vercel.app`.
- Flujo de trabajo: editar → `git add/commit/push` → Vercel publica en ~30–60s.
- **Verificación sin login**: como no se puede navegar al dominio de la app desde el navegador
  controlado, y los guardados necesitan la sesión de Javier, se verifica leyendo los archivos
  publicados con `curl` (ej. `curl -s .../js/cuentas.js | grep ...`). El **build de Vercel**
  se confirma con las herramientas MCP de Vercel (`list_deployments`, estado `READY`).
- IDs Vercel: project `prj_W3rEHfe41qqDjHmcxiMSbT32z5kg`, team `team_nkTMXZTZn6NIYlPjppLChYkp`.

### Firebase
- Proyecto: **`kioscoelperiquete67`** (plan **Spark / gratis**).
- **Reglas de Firestore = SIMPLES**: cualquier usuario **autenticado** puede leer/escribir todo
  (`allow read, write: if request.auth != null`). Se publicaron el **2026-06-22**.
  → **Ventaja: agregar colecciones nuevas NO requiere tocar las reglas.**
- Publicar reglas SOLO lo puede hacer Javier (es un cambio de seguridad; el asistente no lo hace).
  Se hace en console.firebase.google.com → Firestore → Reglas → Publicar.
- **Colecciones:** `usuarios`, `ganancias`, `productos`, `clientes`, `movimientos`, `notas`.

## 3. Estructura de carpetas

```
index.html            -> login (entrada)
pages/                -> inicio, ganancias, inventario, precios, vencimientos, estadisticas, cuentas
js/                   -> un controlador por página (inventario.js, cuentas.js, etc.)
  components/         -> navbar.js (layout: sidebar PC + bottom-nav celular), scanner.js (código de barras)
  services/           -> acceso a Firestore: productos, ganancias, usuarios, cuentas, catalogo (Open Food Facts)
  utils/              -> format, guards (protección de páginas), rubros, vencimientos, html (escaparHTML anti-XSS)
  firebase/           -> firebase-config.js (credenciales del proyecto)
css/                  -> variables (tokens), base (login), layout (sidebar/topbar/bottom-nav), components
assets/               -> favicon.svg (gatito negro) + logo.png (logo real del negocio)
firebase/firestore.rules -> reglas (versión simple); referencia, se publican a mano en la consola
```

## 4. Módulos hechos

1. **Login** (`index.html` + `js/login.js`) — Firebase Auth.
2. **Inicio / Dashboard** (`inicio.js`) — bienvenida, **Avisos** de productos por vencer, grilla de módulos.
3. **Ganancias** (`ganancias.js`) — carga diaria de lo que entró (1 doc por día, id = fecha).
4. **Inventario** (`inventario.js`) — **alta tipo ASISTENTE (wizard) paso a paso**:
   código de barras → nombre → marca → detalle → rubro (botones) → precio → cantidad →
   ¿tiene vencimiento? → guardar. Carga **100% manual** (sin IA). Lista con buscador, filtro por
   rubro, edición y borrado. Prefill opcional por código de barras desde **Open Food Facts**.
5. **Precios** (`precios.js`) — consulta por texto o código de barras; muestra precio y stock.
6. **Vencimientos** (`vencimientos.js`) — agrupa por estado (vencido/semana/mes/en fecha/sin fecha)
   y **ordena por rubro**, con filtro y resumen.
7. **Estadísticas** (`estadisticas.js`) — Chart.js (barras/líneas de ganancias).
8. **Cuentas Corrientes** (`cuentas.js` + `services/cuentas.service.js`) — **fiado**, módulo estrella:
   - Clientes con avatar, saldo (debe/al día), última actividad. Filtros (Todos/Deben/Al día) y orden.
   - Detalle: saldo grande, totales fiado/pagado, **acciones rápidas**: Fiar, Cobrar,
     **Saldar** (paga todo de un toque), **WhatsApp** (recordatorio con el monto, `wa.me`).
   - **Historial con saldo corriente**.
   - **📌 Pizarra de novedades** por cliente: anotar cosas NO monetarias (botellas/envases que debe,
     encargues). Notas que se marcan resueltas (tachado) o se borran. Badge "📌 N" en la tarjeta.

### Modelo de datos clave
- **`productos`**: nombre, marca, detalle, precio, **cantidad** (stock, para futuro módulo de ventas),
  codigo_barras, rubro, **tiene_vencimiento** (bool), fecha_vencimiento, creado_por, fecha_creacion.
  (Modelo viejo `perecedero`/`tipo_vencimiento`/`clasificacion_*` quedó OBSOLETO; el código tiene
  compatibilidad para leer datos viejos.)
- **`clientes`**: nombre, telefono, notas, creado_por, fecha_creacion.
- **`movimientos`** (cuenta corriente): cliente_id, tipo (`cargo`|`pago`), monto, detalle, fecha, ...
- **`notas`** (pizarra): cliente_id, texto, hecho (bool), ...
- **Saldo** del cliente = Σ cargos − Σ pagos. Positivo = debe.

## 5. Diseño / marca

- **Tema rojo y amarillo.** Tokens en `css/variables.css`: `--color-primary` rojo `#e02d2d`,
  `--color-accent` amarillo `#ffc20e`, fondo cálido. Botones/encabezados rojos, chips/seleccionados amarillos.
- **Logo real** en `assets/logo.png` (gatito negro "Kiosco Periquete", imagen redonda con esquinas negras
  → se recorta en círculo por CSS: `.brand-img`, `.topbar-logo`, `.login-logo`). Reemplazó al 🛒.
- **Favicon**: `assets/favicon.svg` (gatito negro con ojos amarillos). (Pendiente opcional: usar el logo redondo).
- Los colores **semáforo de vencimientos** (rojo/naranja/amarillo/verde) se mantienen: comunican estado.

## 6. Convenciones al programar

- **Seguridad XSS:** SIEMPRE usar `escaparHTML()` (de `js/utils/html.js`) al meter datos del usuario en `innerHTML`.
- **Rubros:** lista fija en `js/utils/rubros.js` (15 rubros). Usarla, no inventar.
- **Formato:** `js/utils/format.js` (formatearMoneda, parsearMonto, hoyISO, fechaLegible).
- **Layout/menú:** para sumar un módulo, agregar item en el array `MENU` de `js/components/navbar.js`
  (con `bottom: false` si no va en la barra inferior del celular) y, si querés acceso desde el cel,
  una tarjeta en la grilla de `inicio.js`.
- **Nueva página:** copiar el `<head>` de una existente (importmap + favicon + 4 css), `<div id="app">`,
  y `<script type="module" src="../js/MIPAGINA.js">`.
- Todas las páginas privadas empiezan con `protegerPagina()` (redirige al login si no hay sesión).
- Mensajes de error al guardar: mostrar el código real (`err?.code || err?.message`) para diagnosticar.

## 7. Historia / decisiones importantes

- **Se eliminó toda la IA** (foto/Gemini y clasificación automática de rubro/perecedero). La clave de
  Gemini se quedó sin crédito (recarga mínima USD 25 en Argentina) y Javier no quiso pagar. El alta es
  manual. Se borraron `api/*`, `api-auth.mjs`, `ia.service.js`, `clasificador-local.js`, etc.
- Las reglas estrictas viejas bloqueaban módulos nuevos → se pasó a **reglas simples** (auth-required).

## 8. Ideas / pendientes (para retomar)

- Límite de fiado por cliente (avisar si se pasa).
- Exportar/compartir lista de deudores.
- Sumar las novedades pendientes (pizarra) al mensaje de WhatsApp.
- Cambiar el favicon por el logo redondo (opcional).
- Logo con **fondo transparente** (queda mejor sobre la barra roja).
- Futuro módulo de **Ventas** (descontaría la `cantidad`/stock de productos).

## 9. Memoria adicional

Hay memoria persistente del asistente en `~/.claude/projects/.../memory/` (MEMORY.md + archivos):
`proyecto-el-periquete`, `usuario-javier-no-tecnico`, `ia-clasificacion-local`, `plan-carga-manual`.
Mantener ambos (este CLAUDE.md y esa memoria) actualizados al cerrar sesiones largas.
