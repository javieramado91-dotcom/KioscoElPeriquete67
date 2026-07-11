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
import { formatearMoneda, fechaLegible, fechaFriendly, nombreMes } from "./utils/format.js";
import { escaparHTML } from "./utils/html.js";
import { feriadosDelAnio, tipoDeDia } from "./utils/feriados.js";

// Colores para el gráfico día por día según el tipo de día.
const COLOR_DIA = {
  semana: "#ffc20e", // amarillo (día común)
  finde: "#3b82f6", // azul (fin de semana)
  feriado: "#8b5cf6", // violeta (feriado)
};
const TEXTO_DIA = {
  semana: "Día de semana",
  finde: "Fin de semana",
  feriado: "Feriado",
};

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

    <section class="chart-card chart-card--wide">
      <h3 class="section-title" id="tituloDiario">Ganancia día por día del mes</h3>
      <p class="muted" id="ayudaDiario" hidden>
        Elegí un mes arriba para ver cómo se movieron las ventas día por día.
      </p>
      <div id="wrapDiario">
        <div class="leyenda-dias">
          <span><i style="background:#ffc20e"></i> Día de semana</span>
          <span><i style="background:#3b82f6"></i> Fin de semana</span>
          <span><i style="background:#8b5cf6"></i> Feriado</span>
        </div>
        <canvas id="chartDiario"></canvas>
      </div>
    </section>

    <section class="chart-card chart-card--wide">
      <h3 class="section-title">Mes típico: promedio por día (comparación de meses)</h3>
      <p class="muted">
        La línea roja gruesa es el <strong>promedio de todos los meses</strong> del año:
        te dice en qué parte del mes se vende más y en cuál menos. Tocá un mes acá abajo
        para dibujarlo encima y compararlo con el promedio.
      </p>
      <div id="chipsMeses" class="chips-meses"></div>
      <canvas id="chartPromedio"></canvas>
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
  let chartDiario = null;
  let chartPromedio = null;

  // --- Referencias DOM ---
  const filtroAnio = document.getElementById("filtroAnio");
  const filtroMes = document.getElementById("filtroMes");
  const statMes = document.getElementById("statMes");
  const statAnio = document.getElementById("statAnio");
  const statDias = document.getElementById("statDias");
  const statPromedio = document.getElementById("statPromedio");
  const tablaBody = document.getElementById("tablaBody");
  const tablaVacia = document.getElementById("tablaVacia");
  const tituloDiario = document.getElementById("tituloDiario");
  const ayudaDiario = document.getElementById("ayudaDiario");
  const wrapDiario = document.getElementById("wrapDiario");

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
  const diaDe = (iso) => Number(iso.slice(8, 10)); // 1-31

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
    renderChartDiario(delAnio, anio, mesSel);
    renderChartPromedio(delAnio);
  }

  function renderChartPromedio(delAnio) {
    // Promedio de ganancia por día del mes (posición 1..31), tomando todos
    // los meses del año. Solo se promedian los días que tienen registro.
    const suma = new Array(31).fill(0);
    const cuenta = new Array(31).fill(0);
    // Serie por mes: 31 posiciones, null donde no hay dato.
    const porMes = Array.from({ length: 12 }, () => new Array(31).fill(null));

    delAnio.forEach((g) => {
      const d = diaDe(g.fecha) - 1; // 0..30
      const m = mesDe(g.fecha);
      suma[d] += g.monto;
      cuenta[d] += 1;
      porMes[m][d] = (porMes[m][d] || 0) + g.monto;
    });

    const promedio = suma.map((s, i) => (cuenta[i] ? s / cuenta[i] : null));
    const labels = Array.from({ length: 31 }, (_, i) => i + 1);

    // Dataset principal: el promedio (línea roja gruesa).
    const datasets = [
      {
        label: "Promedio",
        data: promedio,
        borderColor: "#e02d2d",
        backgroundColor: "rgba(224,45,45,.12)",
        borderWidth: 3,
        pointRadius: 3,
        pointBackgroundColor: "#e02d2d",
        tension: 0.3,
        fill: true,
        spanGaps: true,
        order: 0,
      },
    ];

    // Una línea fina por mes con datos, oculta por defecto. Se prende/apaga
    // con los botones táctiles de arriba (no con la referencia de Chart.js).
    const meses = []; // { label, color, idx }
    for (let m = 0; m < 12; m++) {
      if (porMes[m].every((v) => v === null)) continue;
      const color = `hsl(${Math.round((m * 360) / 12)}, 70%, 52%)`;
      datasets.push({
        label: nombreMes(m),
        data: porMes[m],
        borderColor: color,
        backgroundColor: color,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
        spanGaps: true,
        hidden: true, // arranca oculta; el promedio es lo que se ve primero
        order: 1,
      });
      meses.push({ label: nombreMes(m), color, idx: datasets.length - 1 });
    }

    const ctx = document.getElementById("chartPromedio");
    chartPromedio?.destroy();
    chartPromedio = new Chart(ctx, {
      type: "line",
      data: { labels, datasets },
      options: {
        ...chartOpciones(),
        plugins: {
          legend: { display: false }, // usamos botones propios, más táctiles
          tooltip: {
            callbacks: {
              title: (items) => `Día ${items[0].label} del mes`,
              label: (ctx) =>
                `${ctx.dataset.label}: ` + formatearMoneda(ctx.parsed.y),
            },
          },
        },
        scales: {
          ...chartOpciones().scales,
          x: { title: { display: true, text: "Día del mes" } },
        },
      },
    });

    // Botones para prender/apagar cada mes sobre el promedio.
    const chips = document.getElementById("chipsMeses");
    chips.innerHTML = "";
    if (!meses.length) {
      chips.innerHTML =
        '<span class="muted">Todavía no hay meses cargados en este año.</span>';
      return;
    }
    meses.forEach(({ label, color, idx }) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip-mes";
      btn.textContent = label;
      btn.style.setProperty("--c", color);
      btn.addEventListener("click", () => {
        const visible = chartPromedio.isDatasetVisible(idx);
        if (visible) chartPromedio.hide(idx);
        else chartPromedio.show(idx);
        btn.classList.toggle("activo", !visible);
      });
      chips.appendChild(btn);
    });
  }

  function renderChartDiario(delAnio, anio, mesSel) {
    // Solo tiene sentido con un mes concreto elegido.
    if (mesSel === "todos") {
      chartDiario?.destroy();
      chartDiario = null;
      wrapDiario.hidden = true;
      ayudaDiario.hidden = false;
      tituloDiario.textContent = "Ganancia día por día del mes";
      return;
    }

    const mes = Number(mesSel);
    wrapDiario.hidden = false;
    ayudaDiario.hidden = true;
    tituloDiario.textContent = `Ganancia día por día — ${nombreMes(mes)} ${anio}`;

    // Feriados del año (para pintar y explicar cada día).
    const feriados = feriadosDelAnio(anio);
    const mm = String(mes + 1).padStart(2, "0");

    // Cantidad de días del mes (el día 0 del mes siguiente = último día).
    const diasEnMes = new Date(anio, mes + 1, 0).getDate();
    const porDia = new Array(diasEnMes).fill(0);
    delAnio
      .filter((g) => mesDe(g.fecha) === mes)
      .forEach((g) => (porDia[diaDe(g.fecha) - 1] += g.monto));

    // Para cada día: su fecha ISO, color por tipo de día y texto del globito.
    const fechas = [];
    const colores = [];
    const detalleDia = [];
    for (let d = 1; d <= diasEnMes; d++) {
      const isoFecha = `${anio}-${mm}-${String(d).padStart(2, "0")}`;
      const tipo = tipoDeDia(isoFecha, feriados);
      fechas.push(isoFecha);
      colores.push(COLOR_DIA[tipo]);
      detalleDia.push(
        tipo === "feriado"
          ? `Feriado · ${feriados.get(isoFecha)}`
          : TEXTO_DIA[tipo]
      );
    }

    const ctx = document.getElementById("chartDiario");
    chartDiario?.destroy();
    chartDiario = new Chart(ctx, {
      type: "bar",
      data: {
        labels: porDia.map((_, i) => i + 1),
        datasets: [
          {
            label: "Ganancia del día",
            data: porDia,
            backgroundColor: colores,
            borderColor: colores,
            borderWidth: 1,
            borderRadius: 5,
          },
        ],
      },
      options: {
        ...chartOpciones(),
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              // Título: fecha completa ("Viernes 11 de julio de 2026").
              title: (items) => fechaFriendly(fechas[items[0].dataIndex]),
              // Línea 1: ingreso del día.
              label: (ctx) => "Ingreso: " + formatearMoneda(ctx.parsed.y),
              // Línea 2: qué tipo de día es.
              afterLabel: (ctx) => detalleDia[ctx.dataIndex],
            },
          },
        },
        scales: {
          ...chartOpciones().scales,
          x: { title: { display: true, text: "Día del mes" } },
        },
      },
    });
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
      options: {
        ...chartOpciones(),
        plugins: {
          legend: { display: true },
          tooltip: {
            callbacks: {
              title: (items) => `${nombreMes(items[0].dataIndex)} ${anio}`,
              label: (ctx) => "Ganancia: " + formatearMoneda(ctx.parsed.y),
            },
          },
        },
      },
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
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            // Por defecto el globito muestra el monto en pesos.
            label: (ctx) => formatearMoneda(ctx.parsed.y),
          },
        },
      },
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
