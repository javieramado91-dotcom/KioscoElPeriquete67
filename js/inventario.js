// =============================================================
//  CONTROLADOR DEL MÓDULO INVENTARIO  (alta tipo asistente)
// -------------------------------------------------------------
//  El alta de producto es un ASISTENTE paso a paso (wizard):
//   1. 📊 Código de barras o QR (escanear / escribir, opcional).
//   2. ✏️ Nombre del producto.
//   3. 🏷️ Marca (opcional).
//   4. 📦 Detalle (opcional).
//   5. 🗂️ Rubro (lista de botones para tocar).
//   6. 💰 Precio.
//   7. 🔢 Cantidad en stock.
//   8. 📅 ¿Tiene vencimiento? → fecha → Guardar.
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

// Pasos del asistente (en orden).
const PASOS = [
  { key: "codigo", tipo: "codigo", titulo: "📊 Código de barras o QR", sub: "Escaneá o escribí el código. Si el producto no tiene, tocá Siguiente." },
  { key: "nombre", tipo: "texto", titulo: "✏️ ¿Qué producto es?", sub: "Escribí el nombre del producto.", placeholder: "Ej: Gaseosa Coca-Cola" },
  { key: "marca", tipo: "texto", titulo: "🏷️ Marca", sub: "Opcional. Si no sabés, tocá Siguiente.", placeholder: "Ej: Coca-Cola" },
  { key: "detalle", tipo: "texto", titulo: "📦 Detalle", sub: "Opcional: tamaño, peso o variedad.", placeholder: "Ej: 1.5 L" },
  { key: "rubro", tipo: "rubro", titulo: "🗂️ Elegí el rubro", sub: "Tocá la categoría que corresponde." },
  { key: "precio", tipo: "precio", titulo: "💰 Precio", sub: "¿A cuánto lo vendés?", placeholder: "0" },
  { key: "cantidad", tipo: "cantidad", titulo: "🔢 Cantidad en stock", sub: "¿Cuántas unidades tenés?", placeholder: "0" },
  { key: "vencimiento", tipo: "vencimiento", titulo: "📅 ¿Tiene fecha de vencimiento?", sub: "Si la tiene, la cargamos para avisarte antes de que se venza." },
];
const TOTAL = PASOS.length;

(async function init() {
  const { user, perfil } = await protegerPagina();
  const admin = esAdmin(perfil);

  const contenido = document.createElement("div");
  contenido.innerHTML = `
    <header class="page-header">
      <h1>📦 Inventario</h1>
      <p class="muted">Sumá productos a tu stock. Es fácil, te vamos guiando. 👇</p>
    </header>

    <div class="alta-cta">
      <button type="button" class="btn btn-primary btn-grande btn-block btn-alta" id="btnAbrirAlta">
        ➕ Agregar producto
      </button>
      <div id="altaMsg" class="message"></div>
    </div>

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

    <!-- ASISTENTE de alta (wizard) -->
    <div class="modal-overlay" id="modalAlta">
      <div class="modal-card modal-card-form wizard">
        <div class="wizard-top">
          <div class="wizard-progress"><div class="wizard-bar" id="wizBar"></div></div>
          <button type="button" class="modal-cerrar" id="wizCerrar" aria-label="Cerrar">✕</button>
        </div>
        <div class="wizard-paso-info" id="wizPasoInfo"></div>
        <h2 class="wizard-titulo" id="wizTitulo"></h2>
        <p class="wizard-sub" id="wizSub"></p>
        <div class="wizard-body" id="wizBody"></div>
        <div id="wizMsg" class="message"></div>
        <div class="wizard-footer">
          <button type="button" class="btn btn-ghost" id="wizAtras">← Atrás</button>
          <button type="button" class="btn btn-primary btn-grande" id="wizSiguiente">Siguiente →</button>
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

  // --- Referencias generales ---
  const altaMsg = document.getElementById("altaMsg");
  const buscador = document.getElementById("buscador");
  const filtroRubro = document.getElementById("filtroRubro");
  const lista = document.getElementById("listaProductos");
  const listaVacia = document.getElementById("listaVacia");
  const contador = document.getElementById("contadorProd");

  // --- Referencias del asistente ---
  const modalAlta = document.getElementById("modalAlta");
  const btnAbrirAlta = document.getElementById("btnAbrirAlta");
  const wizBar = document.getElementById("wizBar");
  const wizPasoInfo = document.getElementById("wizPasoInfo");
  const wizTitulo = document.getElementById("wizTitulo");
  const wizSub = document.getElementById("wizSub");
  const wizBody = document.getElementById("wizBody");
  const wizMsg = document.getElementById("wizMsg");
  const wizAtras = document.getElementById("wizAtras");
  const wizSiguiente = document.getElementById("wizSiguiente");
  const wizCerrar = document.getElementById("wizCerrar");

  // --- Referencias de edición ---
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

  let productos = [];
  let editandoId = null;

  // =====================================================
  //  ASISTENTE DE ALTA (wizard)
  // =====================================================
  let paso = 0;
  let datos = nuevoBorrador();

  function nuevoBorrador() {
    return {
      codigo: "", nombre: "", marca: "", detalle: "",
      rubro: "", precio: "", cantidad: "",
      tieneVenc: false, fecha: "",
    };
  }

  function abrirWizard() {
    datos = nuevoBorrador();
    paso = 0;
    altaMsg.textContent = "";
    modalAlta.classList.add("abierto");
    pintarPaso();
  }
  function cerrarWizard() {
    modalAlta.classList.remove("abierto");
  }
  btnAbrirAlta.addEventListener("click", abrirWizard);
  wizCerrar.addEventListener("click", cerrarWizard);
  modalAlta.addEventListener("click", (e) => {
    if (e.target === modalAlta) cerrarWizard();
  });

  function mostrarWizMsg(texto) {
    wizMsg.textContent = texto || "";
    wizMsg.className = texto ? "message message-error" : "message";
  }

  function pintarPaso() {
    const p = PASOS[paso];
    mostrarWizMsg("");
    wizBar.style.width = `${((paso + 1) / TOTAL) * 100}%`;
    wizPasoInfo.textContent = `Paso ${paso + 1} de ${TOTAL}`;
    wizTitulo.textContent = p.titulo;
    wizSub.textContent = p.sub;
    wizAtras.style.visibility = paso === 0 ? "hidden" : "visible";
    wizSiguiente.textContent = paso === TOTAL - 1 ? "✅ Guardar producto" : "Siguiente →";

    if (p.tipo === "codigo") {
      wizBody.innerHTML = `
        <div class="codigo-row">
          <input type="text" id="wizInput" inputmode="numeric" placeholder="Escaneá o escribí el código" value="${escaparHTML(datos.codigo)}" />
          <button type="button" class="btn btn-primary" id="wizEscanear">📷 Escanear</button>
        </div>`;
      document.getElementById("wizEscanear").addEventListener("click", escanearEnWizard);
    } else if (p.tipo === "rubro") {
      wizBody.innerHTML = `
        <div class="rubro-grid">
          ${RUBROS.map((r) => `
            <button type="button" class="rubro-opcion ${r === datos.rubro ? "sel" : ""}" data-rubro="${escaparHTML(r)}">
              ${escaparHTML(r)}
            </button>`).join("")}
        </div>`;
      wizBody.querySelectorAll("[data-rubro]").forEach((b) => {
        b.addEventListener("click", () => {
          datos.rubro = b.dataset.rubro;
          // Selección + avance automático (más ágil).
          avanzar();
        });
      });
    } else if (p.tipo === "vencimiento") {
      wizBody.innerHTML = `
        <div class="venc-opciones">
          <button type="button" class="venc-opcion ${datos.tieneVenc ? "sel" : ""}" id="vencSi">📅 Sí, tiene</button>
          <button type="button" class="venc-opcion ${!datos.tieneVenc ? "sel" : ""}" id="vencNo">🚫 No tiene</button>
        </div>
        <div class="field-block" id="wizFechaBlock" ${datos.tieneVenc ? "" : "hidden"} style="margin-top:1rem">
          <label for="wizFecha">📅 Fecha de vencimiento</label>
          <input type="date" id="wizFecha" value="${escaparHTML(datos.fecha)}" />
        </div>`;
      const vencSi = document.getElementById("vencSi");
      const vencNo = document.getElementById("vencNo");
      const fechaBlock = document.getElementById("wizFechaBlock");
      vencSi.addEventListener("click", () => {
        datos.tieneVenc = true;
        vencSi.classList.add("sel"); vencNo.classList.remove("sel");
        fechaBlock.hidden = false;
        document.getElementById("wizFecha").focus();
      });
      vencNo.addEventListener("click", () => {
        datos.tieneVenc = false;
        datos.fecha = "";
        vencNo.classList.add("sel"); vencSi.classList.remove("sel");
        fechaBlock.hidden = true;
      });
    } else {
      // texto / precio / cantidad
      const tipoInput = p.tipo === "precio" ? "text" : p.tipo === "cantidad" ? "number" : "text";
      const inputmode = p.tipo === "precio" ? "decimal" : p.tipo === "cantidad" ? "numeric" : "text";
      const min = p.tipo === "cantidad" ? `min="0" step="1"` : "";
      const valor = escaparHTML(datos[p.key] || "");
      if (p.tipo === "precio") {
        wizBody.innerHTML = `
          <div class="money-input focus">
            <span class="money-symbol">$</span>
            <input type="text" id="wizInput" inputmode="decimal" placeholder="${p.placeholder || ""}" autocomplete="off" value="${valor}" />
          </div>`;
      } else {
        wizBody.innerHTML = `
          <input class="wiz-input-grande" type="${tipoInput}" id="wizInput" inputmode="${inputmode}" ${min}
            maxlength="100" placeholder="${p.placeholder || ""}" value="${valor}" />`;
      }
      const inp = document.getElementById("wizInput");
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); avanzar(); }
      });
    }

    // Enfocar el primer campo (si hay).
    const primerInput = document.getElementById("wizInput") || document.getElementById("wizFecha");
    if (primerInput) setTimeout(() => primerInput.focus(), 50);
  }

  function leerPasoActual() {
    const p = PASOS[paso];
    const inp = document.getElementById("wizInput");
    if (inp) datos[p.key] = inp.value;
    if (p.tipo === "vencimiento") {
      const f = document.getElementById("wizFecha");
      if (f) datos.fecha = f.value;
    }
  }

  function validarPasoActual() {
    const p = PASOS[paso];
    if (p.key === "nombre" && !datos.nombre.trim()) return "Escribí el nombre del producto.";
    if (p.key === "rubro" && !datos.rubro) return "Tocá un rubro para continuar.";
    if (p.key === "precio") {
      const n = parsearMonto(datos.precio);
      if (datos.precio === "" || isNaN(n) || n < 0) return "Poné un precio válido. 💰";
    }
    if (p.key === "cantidad") {
      const n = Number(datos.cantidad);
      if (datos.cantidad !== "" && (isNaN(n) || n < 0)) return "Poné una cantidad válida.";
    }
    if (p.key === "vencimiento" && datos.tieneVenc && !datos.fecha) {
      return "📅 Marcaste que vence: poné la fecha.";
    }
    return null;
  }

  async function avanzar() {
    leerPasoActual();
    const error = validarPasoActual();
    if (error) return mostrarWizMsg(error);
    if (paso === TOTAL - 1) return guardarDesdeWizard();
    paso++;
    pintarPaso();
  }
  function retroceder() {
    leerPasoActual();
    if (paso > 0) { paso--; pintarPaso(); }
  }
  wizSiguiente.addEventListener("click", avanzar);
  wizAtras.addEventListener("click", retroceder);

  async function escanearEnWizard() {
    const codigo = await escanearCodigo();
    if (!codigo) return;
    datos.codigo = codigo;
    const inp = document.getElementById("wizInput");
    if (inp) inp.value = codigo;
    // Si todavía no hay nombre, intentamos completar desde el catálogo gratuito.
    if (!datos.nombre.trim()) {
      mostrarWizMsg("");
      wizMsg.className = "message message-success";
      wizMsg.textContent = "Buscando en el catálogo...";
      try {
        const r = await buscarPorCodigoBarras(codigo);
        if (r && (r.nombre || r.marca)) {
          datos.nombre = r.nombre || "";
          datos.marca = r.marca || "";
          datos.detalle = r.detalle || "";
          wizMsg.textContent = "✅ ¡Encontrado! Ya completé nombre y marca. Tocá Siguiente para revisarlos.";
        } else {
          wizMsg.textContent = "Código guardado. Completá los datos a mano. 🙂";
        }
      } catch (_) {
        wizMsg.textContent = "Código guardado. Completá los datos a mano. 🙂";
      }
    }
  }

  async function guardarDesdeWizard() {
    const valorPrecio = parsearMonto(datos.precio);
    const valorCantidad = Math.max(0, Math.round(Number(datos.cantidad) || 0));
    wizSiguiente.disabled = true;
    wizSiguiente.textContent = "Guardando...";
    try {
      await agregarProducto({
        nombre: datos.nombre,
        marca: datos.marca,
        detalle: datos.detalle,
        precio: valorPrecio,
        cantidad: valorCantidad,
        codigo_barras: datos.codigo,
        rubro: datos.rubro,
        tiene_vencimiento: datos.tieneVenc,
        fecha_vencimiento: datos.fecha,
        uid: user.uid,
      });
      cerrarWizard();
      altaMsg.className = "message message-success";
      altaMsg.textContent = `✅ "${datos.nombre.trim()}" guardado en ${datos.rubro} (${valorCantidad} u.) a ${formatearMoneda(valorPrecio)}.`;
      await cargar();
    } catch (err) {
      mostrarWizMsg("⚠️ Error: " + (err?.code || err?.message || "desconocido"));
      console.error("Error guardando producto:", err);
    } finally {
      wizSiguiente.disabled = false;
      wizSiguiente.textContent = "✅ Guardar producto";
    }
  }

  // =====================================================
  //  EDITAR PRODUCTO
  // =====================================================
  function tieneVenc(p) {
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
      altaMsg.className = "message message-success";
      altaMsg.textContent = "✅ Producto actualizado.";
      await cargar();
    } catch (err) {
      editMsg.textContent = "⚠️ No se pudo guardar. Probá de nuevo.";
      editMsg.className = "message message-error";
    } finally {
      btnEditarGuardar.disabled = false;
      btnEditarGuardar.textContent = "💾 Guardar cambios";
    }
  });

  // =====================================================
  //  LISTA + BUSCADOR
  // =====================================================
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
})();
