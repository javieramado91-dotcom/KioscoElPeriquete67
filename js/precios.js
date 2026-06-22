// =============================================================
//  CONTROLADOR DE CONSULTA DE PRECIOS
// -------------------------------------------------------------
//  Dos formas de encontrar el precio de un producto:
//   1. 🔎 Escribiendo el nombre o tipo.
//   2. 📊 Escaneando el código de barras.
// =============================================================

import { protegerPagina } from "./utils/guards.js";
import { montarLayout } from "./components/navbar.js";
import {
  listarProductos,
  filtrarPorTexto,
  filtrarPorRubro,
  buscarEnListaPorCodigo,
} from "./services/productos.service.js";
import { escanearCodigo } from "./components/scanner.js";
import { formatearMoneda } from "./utils/format.js";
import { RUBROS } from "./utils/rubros.js";
import { escaparHTML } from "./utils/html.js";

(async function init() {
  const { perfil } = await protegerPagina();

  const contenido = document.createElement("div");
  contenido.innerHTML = `
    <header class="page-header">
      <h1>🔖 Consultar precios</h1>
      <p class="muted">Buscá un producto y mirá su precio.</p>
    </header>

    <div class="buscador buscador-grande">
      <input type="search" id="buscador" placeholder="🔎 Escribí el nombre del producto..." />
    </div>
    <div class="filtro-rubro">
      <select id="filtroRubro">
        <option value="todos">🏷️ Todos los rubros</option>
        ${RUBROS.map((r) => `<option value="${r}">${r}</option>`).join("")}
      </select>
    </div>

    <div class="acciones-busqueda">
      <button type="button" class="btn btn-outline" id="btnCodigo">📊 Escanear código de barras</button>
    </div>

    <div id="estadoCarga" class="estado-carga"></div>
    <div id="msg" class="message"></div>

    <section class="lista-productos" id="resultados"></section>
    <div id="sinResultados" class="empty-state" hidden>
      No encontré ningún producto. Probá con otra palabra.
    </div>
  `;

  montarLayout({ activo: "precios", perfil, contenido });

  const buscador = document.getElementById("buscador");
  const filtroRubro = document.getElementById("filtroRubro");
  const btnCodigo = document.getElementById("btnCodigo");
  const estado = document.getElementById("estadoCarga");
  const msg = document.getElementById("msg");
  const resultados = document.getElementById("resultados");
  const sinResultados = document.getElementById("sinResultados");

  let productos = [];

  function mostrarMensaje(texto, tipo) {
    msg.textContent = texto;
    msg.className = `message message-${tipo}`;
  }
  function mostrarEstado(texto) {
    estado.innerHTML = texto ? `<span class="spinner"></span> ${texto}` : "";
    estado.style.display = texto ? "flex" : "none";
  }

  function render(items, mostrarVacio = true) {
    resultados.innerHTML = "";
    sinResultados.hidden = !(mostrarVacio && items.length === 0);
    items.forEach((p) => {
      const div = document.createElement("div");
      div.className = "producto-item";
      const cant = p.cantidad != null ? p.cantidad : 0;
      div.innerHTML = `
        <div class="producto-info">
          <div class="producto-nombre">${escaparHTML(p.nombre)}</div>
          <div class="producto-extra">${escaparHTML([p.marca, p.detalle].filter(Boolean).join(" · ") || "—")}</div>
          <div class="producto-tags">
            <span class="rubro-chip">🏷️ ${escaparHTML(p.rubro || "Otros")}</span>
            <span class="rubro-chip">📦 ${cant} u.</span>
          </div>
        </div>
        <div class="producto-precio grande">${formatearMoneda(p.precio)}</div>
      `;
      resultados.appendChild(div);
    });
  }

  // 1) Buscar escribiendo y/o por rubro
  function aplicarBusqueda() {
    mostrarMensaje("", "");
    const texto = buscador.value.trim();
    const rubro = filtroRubro.value;
    if (!texto && rubro === "todos") {
      render([], false); // sin criterio, no mostramos nada
      return;
    }
    const res = filtrarPorTexto(filtrarPorRubro(productos, rubro), texto);
    render(res, true);
  }
  buscador.addEventListener("input", aplicarBusqueda);
  filtroRubro.addEventListener("change", aplicarBusqueda);

  // 2) Buscar por código de barras
  btnCodigo.addEventListener("click", async () => {
    mostrarMensaje("", "");
    const codigo = await escanearCodigo();
    if (!codigo) return;
    const encontrados = buscarEnListaPorCodigo(productos, codigo);
    if (encontrados.length) {
      buscador.value = "";
      render(encontrados);
    } else {
      render([], false);
      mostrarMensaje("Ese código no está en tu inventario todavía.", "error");
    }
  });

  productos = await listarProductos();
})();
