// =============================================================
//  CONTROLADOR DEL MÓDULO INVENTARIO  (carga manual)
// -------------------------------------------------------------
//  Flujo simple y profesional, pensado para control de stock:
//   1. 📊  Arranca por el CÓDIGO DE BARRAS (si el producto tiene).
//          Si está en el catálogo, completa nombre/marca/detalle.
//   2. ✍️  Se completan a mano: nombre, marca, detalle, rubro,
//          precio y CANTIDAD (stock).
//   3. 💾  Al guardar, pregunta: ¿tiene fecha de vencimiento?
//          Si sí, la pide; si no, se guarda sin fecha.
//
//  Guarda TODA la info de cada producto para el control de stock
//  y un futuro módulo de ventas (que descontará la cantidad).
// =============================================================

import { protegerPagina } from "./utils/guards.js";
import { montarLayout } from "./components/navbar.js";
import { esAdmin } from "./services/usuarios.service.js";
import {
  listarProductos,
  agregarProducto,
  actualizarProducto,
  eliminarProducto,
  filtrarPorTexto,
  filtrarPorRubro,
} from "./services/productos.service.js";
import { buscarPorCodigoBarras } from "./services/catalogo.service.js";
import { escanearCodigo } from "./components/scanner.js";
import { formatearMoneda, parsearMonto } from "./utils/format.js";
import { estadoVencimiento, textoDias } from "./utils/vencimientos.js";
import { RUBROS } from "./utils/rubros.js";
import { escaparHTML } from "./utils/html.js";

(async function init() {
  const { user, perfil } = await protegerPagina();
  const admin = esAdmin(perfil);

  const contenido = document.createElement("div");
  contenido.innerHTML = `
    <header class="page-header">
      <h1>📦 Inventario</h1>
      <p class="muted">Cargá tus productos. Empezá por el código de barras si lo tiene. 👇</p>
    </header>

    <section class="form-card form-amable">
      <div id="estadoCarga" class="estado-carga"></div>

      <form id="formProducto" novalidate>
        <!-- Código de barras: el punto de partida -->
        <div class="field-block">
          <label for="codigoBarras">📊 Código de barras <span class="opcional">(si el producto lo tiene)</span></label>
          <div class="codigo-row">
            <input type="text" id="codigoBarras" inputmode="numeric" placeholder="Escaneá o escribí el código" />
            <button type="button" class="btn btn-primary" id="btnEscanear">📷 Escanear</button>
          </div>
          <div class="fecha-texto">Si tiene código, después buscás el precio al instante con la cámara.</div>
        </div>

        <div class="field-block">
          <label for="nombre">Nombre del producto</label>
          <input type="text" id="nombre" maxlength="100" placeholder="Ej: Gaseosa Coca-Cola" required />
        </div>

        <div class="dos-columnas">
          <div class="field-block">
            <label for="marca">Marca <span class="opcional">(opcional)</span></label>
            <input type="text" id="marca" maxlength="80" placeholder="Ej: Coca-Cola" />
          </div>
          <div class="field-block">
            <label for="detalle">Detalle <span class="opcional">(opcional)</span></label>
            <input type="text" id="detalle" maxlength="100" placeholder="Ej: 1.5 L" />
          </div>
        </div>

        <div class="field-block">
          <label for="rubro">🏷️ Rubro</label>
          <select id="rubro">
            ${RUBROS.map((r) => `<option value="${r}">${r}</option>`).join("")}
          </select>
        </div>

        <div class="dos-columnas">
          <div class="field-block">
            <label for="precio">💰 Precio</label>
            <div class="money-input" id="moneyBox">
              <span class="money-symbol">$</span>
              <input type="text" id="precio" inputmode="decimal" placeholder="0" autocomplete="off" />
            </div>
          </div>
          <div class="field-block">
            <label for="cantidad">📦 Cantidad en stock</label>
            <input type="number" id="cantidad" inputmode="numeric" min="0" step="1" placeholder="0" />
          </div>
        </div>

        <div id="msg" class="message"></div>

        <button type="submit" class="btn btn-primary btn-grande" id="btnGuardar">
          ✅ Guardar producto
        </button>
        <button type="button" class="btn btn-ghost btn-block" id="btnLimpiar">Limpiar y cargar otro</button>
      </form>
    </section>

    <h3 class="section-title">Mis productos (<span id="contadorProd">0</span>)</h3>
    <div class="filtros-stock">
      <input type="search" id="buscador" placeholder="🔎 Buscar producto..." />
      <select id="filtroRubro">
        <option value="todos">🏷️ Todos los rubros</option>
        ${RUBROS.map((r) => `<option value="${r}">${r}</option>`).join("")}
      </select>
    </div>
    <section class="lista-productos" id="listaProductos"></section>
    <div id="listaVacia" class="empty-state" hidden>Todavía no cargaste productos.</div>

    <!-- MODAL: ¿tiene fecha de vencimiento? (siempre, antes de guardar) -->
    <div class="modal-overlay" id="modalVencimiento">
      <div class="modal-card">
        <div class="modal-icono">📅</div>
        <h2 class="modal-titulo">¿Este producto tiene fecha de vencimiento?</h2>
        <p class="modal-texto">Si la tiene, la cargamos para avisarte antes de que se venza.</p>
        <div class="field-block" id="bloqueFechaModal" hidden style="margin-top:1rem">
          <label for="fechaModalVenc">📅 Fecha de vencimiento</label>
          <input type="date" id="fechaModalVenc" />
        </div>
        <div class="modal-acciones">
          <button type="button" class="btn btn-primary btn-grande" id="btnVencSi">📅 Sí, tiene vencimiento</button>
          <button type="button" class="btn btn-ghost" id="btnVencNo">No tiene vencimiento</button>
        </div>
      </div>
    </div>

    <!-- MODAL: editar un producto existente -->
    <div class="modal-overlay" id="modalEditar">
      <div class="modal-card modal-card-form">
        <div class="modal-header">
          <h2 class="modal-titulo">✏️ Editar producto</h2>
          <button type="button" class="modal-cerrar" id="btnEditarCerrar" aria-label="Cerrar">✕</button>
        </div>
        <form id="formEditar" novalidate>
          <div class="field-block">
            <label for="editCodigo">📊 Código de barras</label>
            <div class="codigo-row">
              <input type="text" id="editCodigo" inputmode="numeric" placeholder="Sin código" />
              <button type="button" class="btn btn-outline" id="btnEditarEscanear">📷</button>
            </div>
          </div>
          <div class="field-block">
            <label for="editNombre">Nombre del producto</label>
            <input type="text" id="editNombre" maxlength="100" />
          </div>
          <div class="dos-columnas">
            <div class="field-block">
              <label for="editMarca">Marca</label>
              <input type="text" id="editMarca" maxlength="80" />
            </div>
            <div class="field-block">
              <label for="editDetalle">Detalle</label>
              <input type="text" id="editDetalle" maxlength="100" />
            </div>
          </div>
          <div class="field-block">
            <label for="editRubro">🏷️ Rubro</label>
            <select id="editRubro">
              ${RUBROS.map((r) => `<option value="${r}">${r}</option>`).join("")}
            </select>
          </div>
          <div class="dos-columnas">
            <div class="field-block">
              <label for="editPrecio">💰 Precio</label>
              <div class="money-input" id="editMoneyBox">
                <span class="money-symbol">$</span>
                <input type="text" id="editPrecio" inputmode="decimal" autocomplete="off" />
              </div>
            </div>
            <div class="field-block">
              <label for="editCantidad">📦 Cantidad</label>
              <input type="number" id="editCantidad" inputmode="numeric" min="0" step="1" />
            </div>
          </div>
          <div class="field-block">
            <label class="check-line">
              <input type="checkbox" id="editTieneVenc" />
              <span>Este producto tiene fecha de vencimiento</span>
            </label>
          </div>
          <div class="field-block" id="editBloqueVenc" hidden>
            <label for="editFechaVenc">📅 Fecha de vencimiento</label>
            <input type="date" id="editFechaVenc" />
          </div>
          <div id="editMsg" class="message"></div>
          <div class="modal-acciones">
            <button type="submit" class="btn btn-primary btn-grande" id="btnEditarGuardar">💾 Guardar cambios</button>
            <button type="button" class="btn btn-ghost" id="btnEditarCancelar">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  `;

  montarLayout({ activo: "inventario", perfil, contenido });

  // --- Referencias ---
  const estado = document.getElementById("estadoCarga");
  const form = document.getElementById("formProducto");
  const codigoBarras = document.getElementById("codigoBarras");
  const btnEscanear = document.getElementById("btnEscanear");
  const nombre = document.getElementById("nombre");
  const marca = document.getElementById("marca");
  const detalle = document.getElementById("detalle");
  const rubro = document.getElementById("rubro");
  const precio = document.getElementById("precio");
  const moneyBox = document.getElementById("moneyBox");
  const cantidad = document.getElementById("cantidad");
  const msg = document.getElementById("msg");
  const btn = document.getElementById("btnGuardar");
  const btnLimpiar = document.getElementById("btnLimpiar");

  const modalVencimiento = document.getElementById("modalVencimiento");
  const bloqueFechaModal = document.getElementById("bloqueFechaModal");
  const fechaModalVenc = document.getElementById("fechaModalVenc");
  const btnVencSi = document.getElementById("btnVencSi");
  const btnVencNo = document.getElementById("btnVencNo");

  const modalEditar = document.getElementById("modalEditar");
  const editCodigo = document.getElementById("editCodigo");
  const editNombre = document.getElementById("editNombre");
  const editMarca = document.getElementById("editMarca");
  const editDetalle = document.getElementById("editDetalle");
  const editRubro = document.getElementById("editRubro");
  const editPrecio = document.getElementById("editPrecio");
  const editMoneyBox = document.getElementById("editMoneyBox");
  const editCantidad = document.getElementById("editCantidad");
  const editTieneVenc = document.getElementById("editTieneVenc");
  const editBloqueVenc = document.getElementById("editBloqueVenc");
  const editFechaVenc = document.getElementById("editFechaVenc");
  const editMsg = document.getElementById("editMsg");
  const formEditar = document.getElementById("formEditar");
  const btnEditarEscanear = document.getElementById("btnEditarEscanear");
  const btnEditarGuardar = document.getElementById("btnEditarGuardar");

  const buscador = document.getElementById("buscador");
  const filtroRubro = document.getElementById("filtroRubro");
  const lista = document.getElementById("listaProductos");
  const listaVacia = document.getElementById("listaVacia");
  const contador = document.getElementById("contadorProd");

  let productos = [];
  let editandoId = null;
  let vencimientoDecidido = false; // ¿ya respondió el modal de vencimiento?
  let tieneVencimiento = false;
  let fechaVencimientoElegida = "";

  // ---------- Helpers de UI ----------
  function mostrarMensaje(texto, tipo) {
    msg.textContent = texto;
    msg.className = `message message-${tipo}`;
  }
  function mostrarEstado(texto) {
    estado.innerHTML = texto ? `<span class="spinner"></span> ${texto}` : "";
    estado.style.display = texto ? "flex" : "none";
  }
  function limpiarFormulario() {
    form.reset();
    codigoBarras.value = "";
    vencimientoDecidido = false;
    tieneVencimiento = false;
    fechaVencimientoElegida = "";
    cerrarModalVencimiento();
    mostrarMensaje("", "");
  }

  precio.addEventListener("focus", () => moneyBox.classList.add("focus"));
  precio.addEventListener("blur", () => moneyBox.classList.remove("focus"));
  btnLimpiar.addEventListener("click", () => { limpiarFormulario(); codigoBarras.focus(); });

  // ---------- Escanear / completar por código de barras ----------
  btnEscanear.addEventListener("click", () => escanearYcompletar());

  async function escanearYcompletar() {
    const codigo = await escanearCodigo();
    if (!codigo) return;
    codigoBarras.value = codigo;
    // Si todavía no tiene nombre, buscamos en el catálogo gratuito.
    if (!nombre.value.trim()) {
      mostrarEstado("Buscando el producto en el catálogo...");
      try {
        const r = await buscarPorCodigoBarras(codigo);
        if (r && (r.nombre || r.marca)) {
          nombre.value = r.nombre || "";
          marca.value = r.marca || "";
          detalle.value = r.detalle || "";
          mostrarMensaje("✅ Producto encontrado. Revisá los datos, elegí el rubro y poné precio y cantidad.", "success");
        } else {
          mostrarMensaje("Código guardado. No estaba en el catálogo: completá los datos a mano. 🙂", "success");
        }
      } catch (_) {
        mostrarMensaje("Código guardado. Completá los datos a mano. 🙂", "success");
      } finally {
        mostrarEstado("");
      }
    } else {
      mostrarMensaje("✅ Código de barras agregado.", "success");
    }
    (nombre.value ? precio : nombre).focus();
  }

  // ---------- Modal de vencimiento ----------
  function abrirModalVencimiento() {
    bloqueFechaModal.hidden = true;
    fechaModalVenc.value = "";
    btnVencSi.textContent = "📅 Sí, tiene vencimiento";
    modalVencimiento.classList.add("abierto");
  }
  function cerrarModalVencimiento() {
    modalVencimiento.classList.remove("abierto");
  }
  btnVencSi.addEventListener("click", () => {
    // Primer toque: muestra el campo de fecha. Segundo toque (con fecha): guarda.
    if (bloqueFechaModal.hidden) {
      bloqueFechaModal.hidden = false;
      btnVencSi.textContent = "✅ Guardar con esta fecha";
      fechaModalVenc.focus();
      return;
    }
    if (!fechaModalVenc.value) {
      fechaModalVenc.focus();
      return;
    }
    tieneVencimiento = true;
    fechaVencimientoElegida = fechaModalVenc.value;
    vencimientoDecidido = true;
    btnVencSi.textContent = "📅 Sí, tiene vencimiento";
    cerrarModalVencimiento();
    form.requestSubmit();
  });
  btnVencNo.addEventListener("click", () => {
    tieneVencimiento = false;
    fechaVencimientoElegida = "";
    vencimientoDecidido = true;
    btnVencSi.textContent = "📅 Sí, tiene vencimiento";
    cerrarModalVencimiento();
    form.requestSubmit();
  });
  modalVencimiento.addEventListener("click", (e) => {
    if (e.target === modalVencimiento) cerrarModalVencimiento();
  });

  // ---------- Guardar ----------
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    mostrarMensaje("", "");

    const valorPrecio = parsearMonto(precio.value);
    const valorCantidad = Math.round(Number(cantidad.value) || 0);
    if (!nombre.value.trim()) return mostrarMensaje("Escribí el nombre del producto.", "error");
    if (isNaN(valorPrecio) || valorPrecio < 0)
      return mostrarMensaje("Poné un precio válido. 💰", "error");
    if (valorCantidad < 0) return mostrarMensaje("La cantidad no puede ser negativa.", "error");

    // Siempre preguntamos por el vencimiento antes de guardar.
    if (!vencimientoDecidido) {
      abrirModalVencimiento();
      return;
    }

    btn.disabled = true;
    btn.textContent = "Guardando...";
    try {
      await agregarProducto({
        nombre: nombre.value,
        marca: marca.value,
        detalle: detalle.value,
        precio: valorPrecio,
        cantidad: valorCantidad,
        codigo_barras: codigoBarras.value,
        rubro: rubro.value,
        tiene_vencimiento: tieneVencimiento,
        fecha_vencimiento: fechaVencimientoElegida,
        uid: user.uid,
      });
      mostrarMensaje(`✅ "${nombre.value.trim()}" guardado en ${rubro.value} (${valorCantidad} u.) a ${formatearMoneda(valorPrecio)}.`, "success");
      limpiarFormulario();
      codigoBarras.focus();
      await cargar();
    } catch (err) {
      mostrarMensaje("⚠️ No se pudo guardar. Probá de nuevo.", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "✅ Guardar producto";
    }
  });

  // ---------- Editar producto ----------
  function tieneVenc(p) {
    // Compatibilidad con productos viejos (perecedero / tipo_vencimiento).
    return p.tiene_vencimiento === true
      || (p.tiene_vencimiento === undefined
        && (!!p.fecha_vencimiento || p.perecedero === true));
  }
  function abrirEditar(p) {
    editandoId = p.id;
    editCodigo.value = p.codigo_barras || "";
    editNombre.value = p.nombre || "";
    editMarca.value = p.marca || "";
    editDetalle.value = p.detalle || "";
    editRubro.value = RUBROS.includes(p.rubro) ? p.rubro : "Otros";
    editPrecio.value = p.precio != null ? String(p.precio) : "";
    editCantidad.value = p.cantidad != null ? String(p.cantidad) : "0";
    editTieneVenc.checked = tieneVenc(p);
    editBloqueVenc.hidden = !editTieneVenc.checked;
    editFechaVenc.value = p.fecha_vencimiento || "";
    editMsg.textContent = "";
    editMsg.className = "message";
    modalEditar.classList.add("abierto");
  }
  function cerrarEditar() {
    modalEditar.classList.remove("abierto");
    editandoId = null;
  }
  editPrecio.addEventListener("focus", () => editMoneyBox.classList.add("focus"));
  editPrecio.addEventListener("blur", () => editMoneyBox.classList.remove("focus"));
  editTieneVenc.addEventListener("change", () => {
    editBloqueVenc.hidden = !editTieneVenc.checked;
    if (!editTieneVenc.checked) editFechaVenc.value = "";
  });
  document.getElementById("btnEditarCerrar").addEventListener("click", cerrarEditar);
  document.getElementById("btnEditarCancelar").addEventListener("click", cerrarEditar);
  modalEditar.addEventListener("click", (e) => {
    if (e.target === modalEditar) cerrarEditar();
  });
  btnEditarEscanear.addEventListener("click", async () => {
    const codigo = await escanearCodigo();
    if (codigo) editCodigo.value = codigo;
  });

  formEditar.addEventListener("submit", async (e) => {
    e.preventDefault();
    const valorPrecio = parsearMonto(editPrecio.value);
    const valorCantidad = Math.round(Number(editCantidad.value) || 0);
    if (!editNombre.value.trim()) {
      editMsg.textContent = "Escribí el nombre del producto.";
      editMsg.className = "message message-error";
      return;
    }
    if (isNaN(valorPrecio) || valorPrecio < 0) {
      editMsg.textContent = "Poné un precio válido. 💰";
      editMsg.className = "message message-error";
      return;
    }
    if (editTieneVenc.checked && !editFechaVenc.value) {
      editMsg.textContent = "📅 Marcaste que vence: poné la fecha de vencimiento.";
      editMsg.className = "message message-error";
      return;
    }
    btnEditarGuardar.disabled = true;
    btnEditarGuardar.textContent = "Guardando...";
    try {
      await actualizarProducto(editandoId, {
        nombre: editNombre.value.trim(),
        marca: editMarca.value.trim(),
        detalle: editDetalle.value.trim(),
        codigo_barras: editCodigo.value.trim(),
        rubro: editRubro.value,
        precio: valorPrecio,
        cantidad: Math.max(0, valorCantidad),
        tiene_vencimiento: editTieneVenc.checked,
        fecha_vencimiento: editTieneVenc.checked ? editFechaVenc.value : "",
      });
      cerrarEditar();
      mostrarMensaje("✅ Producto actualizado.", "success");
      await cargar();
    } catch (err) {
      editMsg.textContent = "⚠️ No se pudo guardar. Probá de nuevo.";
      editMsg.className = "message message-error";
    } finally {
      btnEditarGuardar.disabled = false;
      btnEditarGuardar.textContent = "💾 Guardar cambios";
    }
  });

  // ---------- Lista + buscador ----------
  function render(items) {
    contador.textContent = productos.length;
    lista.innerHTML = "";
    listaVacia.hidden = items.length > 0;

    items.forEach((p) => {
      const div = document.createElement("div");
      div.className = "producto-item";
      let vencHtml = "";
      if (p.fecha_vencimiento) {
        const e = estadoVencimiento(p.fecha_vencimiento);
        vencHtml = `<div class="venc-mini venc-${e.clave}">${e.emoji} ${textoDias(e.dias)}</div>`;
      } else if (tieneVenc(p)) {
        vencHtml = `<div class="venc-mini venc-sinfecha">⚪ sin fecha de vencimiento</div>`;
      }
      const cant = p.cantidad != null ? p.cantidad : 0;
      div.innerHTML = `
        <div class="producto-info">
          <div class="producto-nombre">${escaparHTML(p.nombre)}</div>
          <div class="producto-extra">${escaparHTML([p.marca, p.detalle].filter(Boolean).join(" · ") || "—")}</div>
          <div class="producto-tags">
            <span class="rubro-chip">🏷️ ${escaparHTML(p.rubro || "Otros")}</span>
            <span class="rubro-chip">📦 ${cant} u.</span>
            ${vencHtml}
          </div>
        </div>
        <div class="producto-precio">${formatearMoneda(p.precio)}</div>
        <button class="btn-icon" data-edit="${p.id}" title="Editar">✏️</button>
        ${admin ? `<button class="btn-icon" data-del="${p.id}" title="Eliminar">🗑️</button>` : ""}
      `;
      lista.appendChild(div);
    });

    lista.querySelectorAll("[data-edit]").forEach((b) => {
      b.addEventListener("click", () => {
        const p = productos.find((x) => x.id === b.dataset.edit);
        if (p) abrirEditar(p);
      });
    });
    if (admin) {
      lista.querySelectorAll("[data-del]").forEach((b) => {
        b.addEventListener("click", async () => {
          const p = productos.find((x) => x.id === b.dataset.del);
          if (!confirm(`¿Eliminar "${p?.nombre}"?`)) return;
          await eliminarProducto(b.dataset.del);
          await cargar();
        });
      });
    }
  }

  function aplicarFiltros() {
    return filtrarPorTexto(
      filtrarPorRubro(productos, filtroRubro.value),
      buscador.value
    );
  }
  buscador.addEventListener("input", () => render(aplicarFiltros()));
  filtroRubro.addEventListener("change", () => render(aplicarFiltros()));

  async function cargar() {
    productos = await listarProductos();
    render(aplicarFiltros());
  }

  await cargar();
  codigoBarras.focus();
})();
