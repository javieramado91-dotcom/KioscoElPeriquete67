// =============================================================
//  CONTROLADOR DEL MÓDULO ESTADÍSTICAS
// -------------------------------------------------------------
//  Calcula totales, promedios y dibuja gráficos con Chart.js.
//  Chart.js se carga por CDN en estadisticas.html (variable
//  global `Chart`).
//
//  Filtros:
//   - Año  -> afecta el resumen anual, el gráfico mensual y la tabla.
//   - Mes  -> afecta el resumen mensual y la tabla.
// =============================================================

import { protegerPagina } from "./utils/guards.js";
import { montarLayout } from "./components/navbar.js";
import { listarGanancias, eliminarGanancia } from "./services/ganancias.service.js";
import { esAdmin } from "./services/usuarios.service.js";
import { formatearMoneda, fechaLegible, nombreMes } from "./utils/format.js";
import { escaparHTML } from "./utils/html.js";

(async function init() {
  const { perfil } = await protegerPagina();
  const admin = esAdmin(perfil);

  const contenido = document.createElement("div");
  contenido.innerHTML = `
    <header class="page-header">
      <h1>Estadísticas</h1>
      <p class="muted">Resumen de las ganancias de la despensa.</p>
    </header>

    <section class="filters">
      <div class="form-row inline">
        <label for="filtroAnio">Año</label>
        <select id="filtroAnio"></select>
      </div>
      <div class="form-row inline">
        <label for="filtroMes">Mes</label>
        <select id="filtroMes">
          <option value="todos">Todos</option>
        </select>
      </div>
    </section>

    <section class="grid-stats">
      <div class="stat-card">
        <div class="stat-label">Ganado este mes</div>
        <div class="stat-value" id="statMes">—</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Ganado este año</div>
        <div class="stat-value" id="statAnio">—</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Días cargados</div>
        <div class="stat-value" id="statDias">—</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Promedio diario</div>
        <div class="stat-value" id="statPromedio">—</div>
      </div>
    </section>

    <section class="grid-charts">
      <div class="chart-card">
        <h3 class="section-title">Ganancia por mes (año seleccionado)</h3>
        <canvas id="chartMensual"></canvas>
      </div>
      <div class="chart-card">
        <h3 class="section-title">Ganancia por año</h3>
        <canvas id="chartAnual"></canvas>
      </div>
    </section>

    <h3 class="section-title">Detalle de ganancias</h3>
    <section class="table-card">
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th class="text-right">Monto</th>
              <th>Observación</th>
              ${admin ? "<th></th>" : ""}
            </tr>
          </thead>
          <tbody id="tablaBody"></tbody>
        </table>
      </div>
      <div id="tablaVacia" class="empty-state" hidden>
        Todavía no hay ganancias registradas para este filtro.
      </div>
    </section>
  `;

  montarLayout({ activo: "estadisticas", perfil, contenido });

  // --- Estado en memoria ---
  let todas = [];
  let chartMensual = null;
  let chartAnual = null;

  // --- Referencias DOM ---
  const filtroAnio = document.getElementById("filtroAnio");
  const filtroMes = document.getElementById("filtroMes");
  const statMes = document.getElementById("statMes");
  const statAnio = document.getElementById("statAnio");
  const statDias = document.getElementById("statDias");
  const statPromedio = document.getElementById("statPromedio");
  const tablaBody = document.getElementById("tablaBody");
  const tablaVacia = document.getElementById("tablaVacia");

  // Poblar selector de meses.
  for (let i = 0; i < 12; i++) {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = nombreMes(i);
    filtroMes.appendChild(opt);
  }

  // Helpers de extracción de partes de "YYYY-MM-DD".
  const anioDe = (iso) => Number(iso.slice(0, 4));
  const mesDe = (iso) => Number(iso.slice(5, 7)) - 1; // 0-11

  async function cargar() {
    todas = await listarGanancias();

    // Años disponibles (de los datos + el año actual).
    const anios = new Set(todas.map((g) => anioDe(g.fecha)));
    anios.add(new Date().getFullYear());
    filtroAnio.innerHTML = "";
    [...anios]
      .sort((a, b) => b - a)
      .forEach((a) => {
        const opt = document.createElement("option");
        opt.value = String(a);
        opt.textContent = a;
        filtroAnio.appendChild(opt);
      });

    // Valores por defecto: año y mes actuales.
    filtroAnio.value = String(new Date().getFullYear());
    filtroMes.value = String(new Date().getMonth());

    render();
  }

  function render() {
    const anio = Number(filtroAnio.value);
    const mesSel = filtroMes.value; // "todos" o "0".."11"

    const delAnio = todas.filter((g) => anioDe(g.fecha) === anio);

    // --- Tarjetas ---
    const totalAnio = delAnio.reduce((s, g) => s + g.monto, 0);
    const mesActual = new Date().getMonth();
    const delMesActual = delAnio.filter((g) => mesDe(g.fecha) === mesActual);
    const totalMes = delMesActual.reduce((s, g) => s + g.monto, 0);

    statAnio.textContent = formatearMoneda(totalAnio);
    statMes.textContent = formatearMoneda(totalMes);
    statDias.textContent = delAnio.length;
    statPromedio.textContent = formatearMoneda(
      delAnio.length ? totalAnio / delAnio.length : 0
    );

    // --- Tabla (respeta filtro de mes) ---
    const filas =
      mesSel === "todos"
        ? delAnio
        : delAnio.filter((g) => mesDe(g.fecha) === Number(mesSel));
    renderTabla(filas);

    // --- Gráficos ---
    renderChartMensual(delAnio, anio);
    renderChartAnual();
  }

  function renderTabla(filas) {
    tablaBody.innerHTML = "";
    tablaVacia.hidden = filas.length > 0;

    filas.forEach((g) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${fechaLegible(g.fecha)}</td>
        <td class="text-right">${formatearMoneda(g.monto)}</td>
        <td class="muted">${escaparHTML(g.observacion || "—")}</td>
        ${
          admin
            ? `<td class="text-right">
                 <button class="btn-icon" data-del="${g.fecha}" title="Eliminar">🗑️</button>
               </td>`
            : ""
        }
      `;
      tablaBody.appendChild(tr);
    });

    // Eliminar (solo admin).
    if (admin) {
      tablaBody.querySelectorAll("[data-del]").forEach((b) => {
        b.addEventListener("click", async () => {
          const fecha = b.getAttribute("data-del");
          if (!confirm(`¿Eliminar la ganancia del ${fechaLegible(fecha)}?`)) return;
          await eliminarGanancia(fecha);
          await cargar();
        });
      });
    }
  }

  function renderChartMensual(delAnio, anio) {
    // Suma por mes (índices 0-11).
    const porMes = new Array(12).fill(0);
    delAnio.forEach((g) => (porMes[mesDe(g.fecha)] += g.monto));

    const ctx = document.getElementById("chartMensual");
    chartMensual?.destroy();
    chartMensual = new Chart(ctx, {
      type: "bar",
      data: {
        labels: porMes.map((_, i) => nombreMes(i).slice(0, 3)),
        datasets: [
          {
            label: `Ganancia ${anio}`,
            data: porMes,
            backgroundColor: "#ffc20e",
            borderColor: "#e02d2d",
            borderWidth: 2,
            borderRadius: 6,
          },
        ],
      },
      options: chartOpciones(),
    });
  }

  function renderChartAnual() {
    // Suma por año (todos los registros).
    const mapa = {};
    todas.forEach((g) => {
      const a = anioDe(g.fecha);
      mapa[a] = (mapa[a] || 0) + g.monto;
    });
    const anios = Object.keys(mapa).sort();

    const ctx = document.getElementById("chartAnual");
    chartAnual?.destroy();
    chartAnual = new Chart(ctx, {
      type: "line",
      data: {
        labels: anios,
        datasets: [
          {
            label: "Ganancia por año",
            data: anios.map((a) => mapa[a]),
            borderColor: "#e02d2d",
            backgroundColor: "rgba(224,45,45,.15)",
            fill: true,
            tension: 0.3,
            pointRadius: 5,
          },
        ],
      },
      options: chartOpciones(),
    });
  }

  function chartOpciones() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true } },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (v) => "$" + v.toLocaleString("es-AR") },
        },
      },
    };
  }

  // Eventos de filtros.
  filtroAnio.addEventListener("change", render);
  filtroMes.addEventListener("change", render);

  await cargar();
})();
