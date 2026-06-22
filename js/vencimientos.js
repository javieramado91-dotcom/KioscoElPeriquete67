// =============================================================
//  CONTROLADOR DE CONTROL DE VENCIMIENTOS
// -------------------------------------------------------------
//  Muestra los productos con vencimiento agrupados por estado
//  (vencidos, esta semana, este mes, en fecha y sin fecha) y,
//  dentro de cada estado, ORDENADOS POR RUBRO. Con tarjetas de
//  resumen, buscador y filtro por rubro. Le da prioridad a lo
//  que está por vencer.
// =============================================================

import { protegerPagina } from "./utils/guards.js";
import { montarLayout } from "./components/navbar.js";
import {
  listarProductos,
  filtrarPorTexto,
  filtrarPorRubro,
} from "./services/productos.service.js";
import { estadoVencimiento, textoDias } from "./utils/vencimientos.js";
import { fechaLegible } from "./utils/format.js";
import { RUBROS } from "./utils/rubros.js";
import { escaparHTML } from "./utils/html.js";

const SECCIONES = [
  { clave: "vencido", titulo: "🔴 Vencidos" },
  { clave: "pronto", titulo: "🟠 Vencen esta semana" },
  { clave: "proximo", titulo: "🟡 Próximos (este mes)" },
  { clave: "ok", titulo: "🟢 En fecha" },
  { clave: "sinfecha", titulo: "⚪ Sin fecha cargada" },
];

// ¿El producto se controla por vencimiento? (compatible con datos viejos)
function tieneVenc(p) {
  return p.tiene_vencimiento === true
    || (p.tiene_vencimiento === undefined
      && (!!p.fecha_vencimiento || p.perecedero === true));
}

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
        <div class="stat-label">Con vencimiento</div>
        <div class="stat-value" id="cTotal">0</div>
      </div>
    </section>

    <div class="filtros-stock">
      <input type="search" id="buscador" placeholder="🔎 Buscar producto..." />
      <select id="filtroRubro">
        <option value="todos">🏷️ Todos los rubros</option>
        ${RUBROS.map((r) => `<option value="${r}">${r}</option>`).join("")}
      </select>
    </div>

    <div id="secciones"></div>
    <div id="vacio" class="empty-state" hidden>
      No hay productos con vencimiento para mostrar.
      Cargá productos en Stock y marcá que tienen fecha de vencimiento.
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
  const filtroRubro = document.getElementById("filtroRubro");

  let conVencimiento = [];

  function render(items) {
    // --- Tarjetas de resumen (sobre TODOS los que tienen vencimiento) ---
    let nVenc = 0, nSemana = 0, nMes = 0;
    conVencimiento.forEach((p) => {
      const e = estadoVencimiento(p.fecha_vencimiento);
      if (e.clave === "vencido") nVenc++;
      if (e.dias !== null && e.dias >= 0 && e.dias <= 7) nSemana++;
      if (e.dias !== null && e.dias >= 0 && e.dias <= 30) nMes++;
    });
    cVencidos.textContent = nVenc;
    cSemana.textContent = nSemana;
    cMes.textContent = nMes;
    cTotal.textContent = conVencimiento.length;

    // --- Agrupar items filtrados por estado ---
    const grupos = {};
    items.forEach((p) => {
      const e = estadoVencimiento(p.fecha_vencimiento);
      (grupos[e.clave] = grupos[e.clave] || []).push({ p, e });
    });

    secciones.innerHTML = "";
    vacio.hidden = items.length > 0;

    SECCIONES.forEach(({ clave, titulo }) => {
      const listaSec = grupos[clave];
      if (!listaSec || !listaSec.length) return;

      // Dentro del estado: ordenar POR RUBRO y, dentro del rubro, por urgencia.
      listaSec.sort((a, b) => {
        const ra = a.p.rubro || "Otros";
        const rb = b.p.rubro || "Otros";
        if (ra !== rb) return ra.localeCompare(rb);
        return (a.e.dias ?? 9e9) - (b.e.dias ?? 9e9);
      });

      const bloque = document.createElement("section");
      bloque.className = "venc-seccion";
      bloque.innerHTML = `<h3 class="section-title">${titulo} <span class="venc-count">${listaSec.length}</span></h3>`;

      let rubroActual = null;
      listaSec.forEach(({ p, e }) => {
        const rub = p.rubro || "Otros";
        if (rub !== rubroActual) {
          rubroActual = rub;
          const sub = document.createElement("div");
          sub.className = "venc-rubro-sub";
          sub.innerHTML = `🏷️ ${escaparHTML(rub)}`;
          bloque.appendChild(sub);
        }
        const cant = p.cantidad != null ? p.cantidad : 0;
        const item = document.createElement("div");
        item.className = `venc-item venc-${e.clave}`;
        item.innerHTML = `
          <div class="producto-info">
            <div class="producto-nombre">${escaparHTML(p.nombre)}</div>
            <div class="producto-extra">${escaparHTML([p.marca, p.detalle].filter(Boolean).join(" · ") || "—")} · 📦 ${cant} u.</div>
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

  function aplicar() {
    render(filtrarPorTexto(filtrarPorRubro(conVencimiento, filtroRubro.value), buscador.value));
  }
  buscador.addEventListener("input", aplicar);
  filtroRubro.addEventListener("change", aplicar);

  const todos = await listarProductos();
  conVencimiento = todos.filter(tieneVenc);
  render(conVencimiento);
})();
