// =============================================================
//  CONTROLADOR DEL MÓDULO INICIO
// -------------------------------------------------------------
//  Pantalla de bienvenida + sección de AVISOS que muestra los
//  productos próximos a vencer (o vencidos), como un "panel de
//  noticias" del negocio.
// =============================================================

import { protegerPagina } from "./utils/guards.js";
import { montarLayout } from "./components/navbar.js";
import { listarProductos } from "./services/productos.service.js";
import { productosPorVencer, estadoVencimiento, textoDias } from "./utils/vencimientos.js";
import { escaparHTML } from "./utils/html.js";

(async function init() {
  const { perfil } = await protegerPagina();

  const contenido = document.createElement("div");
  contenido.innerHTML = `
    <header class="page-header">
      <h1>Bienvenido a <span class="accent">El Periquete</span></h1>
      <p class="muted">Sistema de gestión de la despensa. ${
        perfil?.nombre ? "Hola, " + perfil.nombre + " 👋" : ""
      }</p>
    </header>

    <section class="hero-card">
      <div>
        <h2>Tu panel de control</h2>
        <p>Desde acá administrás todo el negocio: ganancias, inventario,
        precios y el control de vencimientos.</p>
        <div class="hero-actions">
          <a href="ganancias.html" class="btn btn-primary">💵 Ingresar ganancia</a>
          <a href="inventario.html" class="btn btn-outline">📦 Cargar producto</a>
        </div>
      </div>
    </section>

    <h3 class="section-title">📰 Avisos</h3>
    <section id="avisos">
      <div class="estado-carga" style="display:flex"><span class="spinner"></span> Revisando vencimientos...</div>
    </section>

    <h3 class="section-title">Módulos</h3>
    <section class="grid-cards">
      <a href="ganancias.html" class="module-card">
        <div class="module-icon">💵</div>
        <div class="module-name">Ganancias</div>
        <div class="module-desc">Registrá lo que ingresó cada día.</div>
      </a>
      <a href="inventario.html" class="module-card">
        <div class="module-icon">📦</div>
        <div class="module-name">Inventario</div>
        <div class="module-desc">Cargá productos y controlá el stock.</div>
      </a>
      <a href="precios.html" class="module-card">
        <div class="module-icon">🔖</div>
        <div class="module-name">Precios</div>
        <div class="module-desc">Consultá precios al instante.</div>
      </a>
      <a href="vencimientos.html" class="module-card">
        <div class="module-icon">📅</div>
        <div class="module-name">Vencimientos</div>
        <div class="module-desc">Controlá lo que está por vencer.</div>
      </a>
      <a href="estadisticas.html" class="module-card">
        <div class="module-icon">📊</div>
        <div class="module-name">Estadísticas</div>
        <div class="module-desc">Totales, promedios y gráficos.</div>
      </a>

      <!-- Tarjetas "preparadas" para el futuro (deshabilitadas) -->
      <div class="module-card disabled">
        <div class="module-icon">🧾</div>
        <div class="module-name">Gastos</div>
        <div class="module-desc">Próximamente</div>
      </div>
      <div class="module-card disabled">
        <div class="module-icon">💳</div>
        <div class="module-name">Caja diaria</div>
        <div class="module-desc">Próximamente</div>
      </div>
    </section>
  `;

  montarLayout({ activo: "inicio", perfil, contenido });

  // ---------- Avisos de vencimientos ----------
  const avisos = document.getElementById("avisos");
  try {
    const productos = await listarProductos();
    const porVencer = productosPorVencer(productos, 7); // vencidos o vencen en ≤7 días
    renderAvisos(avisos, porVencer);
  } catch (e) {
    avisos.innerHTML = "";
  }
})();

function renderAvisos(cont, items) {
  if (!items.length) {
    cont.innerHTML = `<div class="aviso-ok">✅ Todo en orden: no hay productos próximos a vencer.</div>`;
    return;
  }

  const cards = items
    .slice(0, 8)
    .map((p) => {
      const e = estadoVencimiento(p.fecha_vencimiento);
      return `
        <div class="aviso-item venc-${e.clave}">
          <span class="aviso-emoji">${e.emoji}</span>
          <div class="aviso-info">
            <div class="aviso-nombre">${escaparHTML(p.nombre)}${p.marca ? " · " + escaparHTML(p.marca) : ""}</div>
            <div class="aviso-dias">${textoDias(e.dias)}</div>
          </div>
        </div>`;
    })
    .join("");

  cont.innerHTML = `
    <div class="avisos-lista">${cards}</div>
    <a href="vencimientos.html" class="btn btn-outline btn-block" style="margin-top:12px">
      📅 Ver todos los vencimientos
    </a>
  `;
}
