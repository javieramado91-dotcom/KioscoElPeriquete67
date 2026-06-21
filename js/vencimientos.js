// =============================================================
//  CONTROLADOR DE CONTROL DE VENCIMIENTOS
// -------------------------------------------------------------
//  Muestra los productos perecederos agrupados por estado:
//  vencidos, vencen esta semana, este mes, en fecha y sin fecha.
//  Con tarjetas de resumen arriba y buscador.
// =============================================================

import { protegerPagina } from "./utils/guards.js";
import { montarLayout } from "./components/navbar.js";
import { listarProductos, filtrarPorTexto } from "./services/productos.service.js";
import { estadoVencimiento, textoDias } from "./utils/vencimientos.js";
import { fechaLegible } from "./utils/format.js";

const SECCIONES = [
  { clave: "vencido", titulo: "🔴 Vencidos" },
  { clave: "pronto", titulo: "🟠 Vencen esta semana" },
  { clave: "proximo", titulo: "🟡 Próximos (este mes)" },
  { clave: "ok", titulo: "🟢 En fecha" },
  { clave: "sinfecha", titulo: "⚪ Sin fecha cargada" },
];

(async function init() {
  const { perfil } = await protegerPagina();

  const contenido = document.createElement("div");
  contenido.innerHTML = `
    <header class="page-header">
      <h1>📅 Control de vencimientos</h1>
      <p class="muted">Mirá qué productos están por vencer y actuá a tiempo.</p>
    </header>

    <section class="grid-stats">
      <div class="stat-card stat-vencido">
        <div class="stat-label">Vencidos</div>
        <div class="stat-value" id="cVencidos">0</div>
      </div>
      <div class="stat-card stat-pronto">
        <div class="stat-label">Vencen esta semana</div>
        <div class="stat-value" id="cSemana">0</div>
      </div>
      <div class="stat-card stat-proximo">
        <div class="stat-label">Vencen este mes</div>
        <div class="stat-value" id="cMes">0</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Perecederos totales</div>
        <div class="stat-value" id="cTotal">0</div>
      </div>
    </section>

    <div class="buscador buscador-grande">
      <input type="search" id="buscador" placeholder="🔎 Buscar producto perecedero..." />
    </div>

    <div id="secciones"></div>
    <div id="vacio" class="empty-state" hidden>
      Todavía no tenés productos perecederos cargados.
      Marcá "Este producto vence" al cargar un producto en Stock.
    </div>
  `;

  montarLayout({ activo: "vencimientos", perfil, contenido });

  const cVencidos = document.getElementById("cVencidos");
  const cSemana = document.getElementById("cSemana");
  const cMes = document.getElementById("cMes");
  const cTotal = document.getElementById("cTotal");
  const secciones = document.getElementById("secciones");
  const vacio = document.getElementById("vacio");
  const buscador = document.getElementById("buscador");

  let perecederos = [];

  function render(items) {
    // --- Tarjetas de resumen (sobre TODOS los perecederos) ---
    let nVenc = 0, nSemana = 0, nMes = 0;
    perecederos.forEach((p) => {
      const e = estadoVencimiento(p.fecha_vencimiento);
      if (e.clave === "vencido") nVenc++;
      if (e.dias !== null && e.dias >= 0 && e.dias <= 7) nSemana++;
      if (e.dias !== null && e.dias >= 0 && e.dias <= 30) nMes++;
    });
    cVencidos.textContent = nVenc;
    cSemana.textContent = nSemana;
    cMes.textContent = nMes;
    cTotal.textContent = perecederos.length;

    // --- Agrupar items filtrados por estado ---
    const grupos = {};
    items.forEach((p) => {
      const e = estadoVencimiento(p.fecha_vencimiento);
      (grupos[e.clave] = grupos[e.clave] || []).push({ p, e });
    });

    secciones.innerHTML = "";
    vacio.hidden = items.length > 0;

    SECCIONES.forEach(({ clave, titulo }) => {
      const lista = grupos[clave];
      if (!lista || !lista.length) return;

      // Ordenar por días (más urgente primero).
      lista.sort((a, b) => (a.e.dias ?? 9e9) - (b.e.dias ?? 9e9));

      const bloque = document.createElement("section");
      bloque.className = "venc-seccion";
      bloque.innerHTML = `<h3 class="section-title">${titulo} <span class="venc-count">${lista.length}</span></h3>`;

      lista.forEach(({ p, e }) => {
        const item = document.createElement("div");
        item.className = `venc-item venc-${e.clave}`;
        item.innerHTML = `
          <div class="producto-info">
            <div class="producto-nombre">${p.nombre}</div>
            <div class="producto-extra">${[p.marca, p.detalle].filter(Boolean).join(" · ") || "—"}</div>
          </div>
          <div class="venc-derecha">
            <div class="venc-fecha">${p.fecha_vencimiento ? fechaLegible(p.fecha_vencimiento) : "—"}</div>
            <div class="venc-dias venc-badge-${e.clave}">${e.emoji} ${textoDias(e.dias)}</div>
          </div>
        `;
        bloque.appendChild(item);
      });

      secciones.appendChild(bloque);
    });
  }

  buscador.addEventListener("input", () => {
    render(filtrarPorTexto(perecederos, buscador.value));
  });

  const todos = await listarProductos();
  perecederos = todos.filter((p) => p.perecedero);
  render(perecederos);
})();
