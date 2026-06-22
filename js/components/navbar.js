// =============================================================
//  COMPONENTE NAVBAR / LAYOUT
// -------------------------------------------------------------
//  Arma la navegación compartida por todas las páginas privadas.
//
//  Pensado para ser INTUITIVO en celular:
//   - En PC: menú lateral (sidebar) clásico.
//   - En celular: barra de botones grandes ABAJO (como WhatsApp /
//     Instagram) + una barra simple arriba con el nombre y "Salir".
//
//  Para agregar un módulo futuro, se toca solo el array MENU.
// =============================================================

import { logout } from "../services/auth.service.js";
import { escaparHTML } from "../utils/html.js";

// Módulos del sistema.
//  - label: texto largo (menú lateral en PC)
//  - corto: texto corto (barra inferior del celular)
// `bottom: false` => aparece en el menú lateral (PC) pero NO en la barra
// inferior del celular (para no amontonar botones).
const MENU = [
  { id: "inicio", label: "Inicio", corto: "Inicio", icono: "🏠", href: "inicio.html" },
  { id: "ganancias", label: "Ingresar Ganancias", corto: "Cargar", icono: "💵", href: "ganancias.html" },
  { id: "inventario", label: "Inventario", corto: "Stock", icono: "📦", href: "inventario.html" },
  { id: "precios", label: "Consultar Precios", corto: "Precios", icono: "🔖", href: "precios.html" },
  { id: "cuentas", label: "Cuentas Corrientes", corto: "Cuentas", icono: "🧾", href: "cuentas.html", bottom: false },
  { id: "vencimientos", label: "Vencimientos", corto: "Vencim.", icono: "📅", href: "vencimientos.html", bottom: false },
  { id: "estadisticas", label: "Estadísticas", corto: "Resumen", icono: "📊", href: "estadisticas.html" },
  // Próximamente: Gastos, Ventas, Caja, Proveedores...
];

async function cerrarSesion() {
  await logout();
  window.location.replace("../index.html");
}

/**
 * Inyecta el layout completo dentro del elemento con id="app".
 *
 * @param {object} opciones
 * @param {string} opciones.activo  id del módulo actual (se resalta).
 * @param {object} opciones.perfil  perfil del usuario (nombre, rol).
 * @param {HTMLElement} opciones.contenido  contenido de la página.
 */
export function montarLayout({ activo, perfil, contenido }) {
  const root = document.getElementById("app");
  const nombre = perfil?.nombre || "Usuario";
  const rol = perfil?.rol || "usuario";

  // Links del menú lateral (PC).
  const linksLaterales = MENU.map(
    (m) => `
      <a href="${m.href}" class="nav-link ${m.id === activo ? "active" : ""}">
        <span class="nav-icon">${m.icono}</span>
        <span class="nav-text">${m.label}</span>
      </a>`
  ).join("");

  // Botones de la barra inferior (celular). Excluye los `bottom: false`.
  const linksInferiores = MENU.filter((m) => m.bottom !== false).map(
    (m) => `
      <a href="${m.href}" class="bottom-link ${m.id === activo ? "active" : ""}">
        <span class="bottom-icon">${m.icono}</span>
        <span class="bottom-text">${m.corto}</span>
      </a>`
  ).join("");

  root.innerHTML = `
    <!-- Barra superior (visible solo en celular) -->
    <header class="topbar">
      <div class="topbar-brand"><span>🛒</span> El Periquete</div>
      <button class="topbar-logout" id="btnLogoutTop">Salir</button>
    </header>

    <!-- Menú lateral (visible solo en PC) -->
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-logo">🛒</div>
        <div>
          <div class="brand-name">El Periquete</div>
          <div class="brand-sub">Despensa</div>
        </div>
      </div>

      <nav class="nav">${linksLaterales}</nav>

      <div class="sidebar-footer">
        <div class="user-box">
          <div class="user-avatar">${escaparHTML(nombre.charAt(0).toUpperCase())}</div>
          <div class="user-info">
            <div class="user-name">${escaparHTML(nombre)}</div>
            <div class="user-role badge badge-${escaparHTML(rol)}">${escaparHTML(rol)}</div>
          </div>
        </div>
        <button class="btn btn-ghost btn-block" id="btnLogout">Cerrar sesión</button>
      </div>
    </aside>

    <!-- Contenido de la página -->
    <main class="content" id="content"></main>

    <!-- Barra de botones inferior (visible solo en celular) -->
    <nav class="bottom-nav">${linksInferiores}</nav>
  `;

  // Insertamos el contenido específico de cada página.
  document.getElementById("content").appendChild(contenido);

  // --- Logout (ambos botones: lateral y superior) ---
  document.getElementById("btnLogout").addEventListener("click", cerrarSesion);
  document.getElementById("btnLogoutTop").addEventListener("click", cerrarSesion);
}
