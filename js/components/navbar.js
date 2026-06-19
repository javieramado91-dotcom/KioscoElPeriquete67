// =============================================================
//  COMPONENTE NAVBAR / SIDEBAR
// -------------------------------------------------------------
//  Renderiza el menú de navegación lateral (responsive) que se
//  comparte en todas las páginas privadas. Al estar centralizado,
//  agregar un nuevo módulo en el futuro (Gastos, Ventas, etc.)
//  es modificar UN solo array.
// =============================================================

import { logout } from "../services/auth.service.js";

// Módulos del sistema. Agregar acá los futuros módulos.
const MENU = [
  { id: "inicio", label: "Inicio", icono: "🏠", href: "inicio.html" },
  { id: "ganancias", label: "Ingresar Ganancias", icono: "💵", href: "ganancias.html" },
  { id: "estadisticas", label: "Estadísticas", icono: "📊", href: "estadisticas.html" },
  // Próximamente: Gastos, Inventario, Ventas, Caja, Proveedores...
];

/**
 * Inyecta el sidebar dentro del elemento con id="app".
 *
 * @param {object} opciones
 * @param {string} opciones.activo  id del módulo actual (resalta el link).
 * @param {object} opciones.perfil  perfil del usuario (nombre, rol).
 * @param {HTMLElement} opciones.contenido  Nodo con el contenido de la página.
 */
export function montarLayout({ activo, perfil, contenido }) {
  const root = document.getElementById("app");

  const nombre = perfil?.nombre || "Usuario";
  const rol = perfil?.rol || "usuario";

  const links = MENU.map(
    (m) => `
      <a href="${m.href}" class="nav-link ${m.id === activo ? "active" : ""}">
        <span class="nav-icon">${m.icono}</span>
        <span class="nav-text">${m.label}</span>
      </a>`
  ).join("");

  root.innerHTML = `
    <button class="menu-toggle" id="menuToggle" aria-label="Abrir menú">☰</button>

    <aside class="sidebar" id="sidebar">
      <div class="brand">
        <div class="brand-logo">🛒</div>
        <div>
          <div class="brand-name">El Periquete</div>
          <div class="brand-sub">Despensa</div>
        </div>
      </div>

      <nav class="nav">${links}</nav>

      <div class="sidebar-footer">
        <div class="user-box">
          <div class="user-avatar">${nombre.charAt(0).toUpperCase()}</div>
          <div class="user-info">
            <div class="user-name">${nombre}</div>
            <div class="user-role badge badge-${rol}">${rol}</div>
          </div>
        </div>
        <button class="btn btn-ghost btn-block" id="btnLogout">Cerrar sesión</button>
      </div>
    </aside>

    <div class="overlay" id="overlay"></div>

    <main class="content" id="content"></main>
  `;

  // Insertamos el contenido específico de cada página.
  document.getElementById("content").appendChild(contenido);

  // --- Comportamiento del menú responsive ---
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");
  const abrir = () => {
    sidebar.classList.add("open");
    overlay.classList.add("show");
  };
  const cerrar = () => {
    sidebar.classList.remove("open");
    overlay.classList.remove("show");
  };
  document.getElementById("menuToggle").addEventListener("click", abrir);
  overlay.addEventListener("click", cerrar);

  // --- Logout ---
  document.getElementById("btnLogout").addEventListener("click", async () => {
    await logout();
    window.location.replace("../index.html");
  });
}
