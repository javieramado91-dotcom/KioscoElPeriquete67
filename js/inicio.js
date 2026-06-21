// =============================================================
//  CONTROLADOR DEL MÓDULO INICIO
// -------------------------------------------------------------
//  Pantalla de bienvenida. Por ahora no muestra datos, solo
//  da la bienvenida y deja "tarjetas" preparadas para futuros
//  módulos (Gastos, Inventario, Ventas...).
// =============================================================

import { protegerPagina } from "./utils/guards.js";
import { montarLayout } from "./components/navbar.js";

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
        <p>Desde acá vas a poder administrar todo el negocio. En esta primera
        versión podés <strong>registrar las ganancias diarias</strong> y ver
        <strong>estadísticas</strong> de tu despensa.</p>
        <div class="hero-actions">
          <a href="ganancias.html" class="btn btn-primary">💵 Ingresar ganancia</a>
          <a href="estadisticas.html" class="btn btn-outline">📊 Ver estadísticas</a>
        </div>
      </div>
    </section>

    <h3 class="section-title">Módulos</h3>
    <section class="grid-cards">
      <a href="ganancias.html" class="module-card">
        <div class="module-icon">💵</div>
        <div class="module-name">Ganancias</div>
        <div class="module-desc">Registrá lo que ingresó cada día.</div>
      </a>
      <a href="estadisticas.html" class="module-card">
        <div class="module-icon">📊</div>
        <div class="module-name">Estadísticas</div>
        <div class="module-desc">Totales, promedios y gráficos.</div>
      </a>

      <a href="inventario.html" class="module-card">
        <div class="module-icon">📦</div>
        <div class="module-name">Inventario</div>
        <div class="module-desc">Cargá productos por foto o código.</div>
      </a>
      <a href="precios.html" class="module-card">
        <div class="module-icon">🔖</div>
        <div class="module-name">Precios</div>
        <div class="module-desc">Consultá precios al instante.</div>
      </a>

      <!-- Tarjetas "preparadas" para el futuro (deshabilitadas) -->
      <div class="module-card disabled">
        <div class="module-icon">🧾</div>
        <div class="module-name">Gastos</div>
        <div class="module-desc">Próximamente</div>
      </div>
      <div class="module-card disabled">
        <div class="module-icon">🛍️</div>
        <div class="module-name">Ventas</div>
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
})();
