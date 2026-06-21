// =============================================================
//  CONTROLADOR DEL MÓDULO INVENTARIO
// -------------------------------------------------------------
//  Permite agregar productos de 3 formas:
//   1. ✍️  Manual.
//   2. 📷  Foto -> la IA (Gemini) completa nombre/marca/detalle.
//   3. 📊  Código de barras -> catálogo gratis completa los datos.
//
//  El código de barras es IMPORTANTE (sirve para buscar precios),
//  así que siempre está visible y, al guardar, si falta, el
//  sistema lo pide (sin obligar).
//  Abajo: lista de productos con buscador.
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
} from "./services/productos.service.js";
import { identificarProductoPorFoto } from "./services/ia.service.js";
import { buscarPorCodigoBarras } from "./services/catalogo.service.js";
import { escanearCodigo } from "./components/scanner.js";
import { formatearMoneda, parsearMonto } from "./utils/format.js";

(async function init() {
  const { user, perfil } = await protegerPagina();
  const admin = esAdmin(perfil);

  const contenido = document.createElement("div");
  contenido.innerHTML = `
    <header class="page-header">
      <h1>📦 Inventario</h1>
      <p class="muted">Cargá tus productos. Elegí cómo querés hacerlo. 👇</p>
    </header>

    <section class="form-card form-amable">
      <!-- Botones de método -->
      <div class="metodo-botones">
        <button type="button" class="metodo-btn" data-metodo="manual">
          <span class="metodo-icono">✍️</span><span>Manual</span>
        </button>
        <button type="button" class="metodo-btn" data-metodo="foto">
          <span class="metodo-icono">📷</span><span>Sacar foto</span>
        </button>
        <button type="button" class="metodo-btn" data-metodo="codigo">
          <span class="metodo-icono">📊</span><span>Código</span>
        </button>
      </div>

      <!-- Input de cámara oculto (se dispara desde "Sacar foto") -->
      <input type="file" id="inputFoto" accept="image/*" capture="environment" hidden />

      <div id="estadoCarga" class="estado-carga"></div>

      <!-- Formulario del producto -->
      <form id="formProducto" novalidate>
        <div class="field-block">
          <label for="nombre">Nombre del producto</label>
          <input type="text" id="nombre" placeholder="Ej: Gaseosa" required />
        </div>

        <div class="dos-columnas">
          <div class="field-block">
            <label for="marca">Marca</label>
            <input type="text" id="marca" placeholder="Ej: Coca-Cola" />
          </div>
          <div class="field-block">
            <label for="detalle">Detalle</label>
            <input type="text" id="detalle" placeholder="Ej: 1.5 L" />
          </div>
        </div>

        <!-- Código de barras: SIEMPRE visible -->
        <div class="field-block">
          <label for="codigoBarras">📊 Código de barras <span class="opcional">(importante)</span></label>
          <div class="codigo-row">
            <input type="text" id="codigoBarras" readonly placeholder="Sin escanear" />
            <button type="button" class="btn btn-outline" id="btnEscanear">📷 Escanear</button>
          </div>
        </div>

        <div class="field-block">
          <label for="precio">💰 Precio</label>
          <div class="money-input" id="moneyBox">
            <span class="money-symbol">$</span>
            <input type="text" id="precio" inputmode="decimal" placeholder="0" autocomplete="off" />
          </div>
        </div>

        <div id="msg" class="message"></div>

        <button type="submit" class="btn btn-primary btn-grande" id="btnGuardar">
          ✅ Guardar producto
        </button>
      </form>
    </section>

    <h3 class="section-title">Mis productos (<span id="contadorProd">0</span>)</h3>
    <div class="buscador">
      <input type="search" id="buscador" placeholder="🔎 Buscar producto..." />
    </div>
    <section class="lista-productos" id="listaProductos"></section>
    <div id="listaVacia" class="empty-state" hidden>Todavía no cargaste productos.</div>

    <!-- MODAL: pide escanear el código de barras al guardar -->
    <div class="modal-overlay" id="modalCodigo">
      <div class="modal-card">
        <div class="modal-icono">📷</div>
        <h2 class="modal-titulo">¿Escaneás el código de barras?</h2>
        <p class="modal-texto">Antes de guardar, conviene sumarle el código a este producto.</p>
        <div class="modal-consejo">
          <span class="modal-consejo-icono">💡</span>
          <span><strong>Es mucho más rápido:</strong> con el código cargado, después
          encontrás el precio al instante — solo apuntás la cámara y aparece solo.</span>
        </div>
        <div class="modal-acciones">
          <button type="button" class="btn btn-primary btn-grande" id="btnModalEscanear">📷 Escanear ahora</button>
          <button type="button" class="btn btn-ghost" id="btnModalOmitir">Guardar sin código</button>
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
            <label for="editNombre">Nombre del producto</label>
            <input type="text" id="editNombre" />
          </div>
          <div class="dos-columnas">
            <div class="field-block">
              <label for="editMarca">Marca</label>
              <input type="text" id="editMarca" />
            </div>
            <div class="field-block">
              <label for="editDetalle">Detalle</label>
              <input type="text" id="editDetalle" />
            </div>
          </div>
          <div class="field-block">
            <label for="editCodigo">📊 Código de barras</label>
            <div class="codigo-row">
              <input type="text" id="editCodigo" readonly placeholder="Sin escanear" />
              <button type="button" class="btn btn-outline" id="btnEditarEscanear">📷 Escanear</button>
            </div>
          </div>
          <div class="field-block">
            <label for="editPrecio">💰 Precio</label>
            <div class="money-input" id="editMoneyBox">
              <span class="money-symbol">$</span>
              <input type="text" id="editPrecio" inputmode="decimal" autocomplete="off" />
            </div>
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
  const inputFoto = document.getElementById("inputFoto");
  const estado = document.getElementById("estadoCarga");
  const form = document.getElementById("formProducto");
  const nombre = document.getElementById("nombre");
  const marca = document.getElementById("marca");
  const detalle = document.getElementById("detalle");
  const codigoBarras = document.getElementById("codigoBarras");
  const btnEscanear = document.getElementById("btnEscanear");
  const precio = document.getElementById("precio");
  const moneyBox = document.getElementById("moneyBox");
  const modalCodigo = document.getElementById("modalCodigo");
  const btnModalEscanear = document.getElementById("btnModalEscanear");
  const btnModalOmitir = document.getElementById("btnModalOmitir");
  const modalEditar = document.getElementById("modalEditar");
  const editNombre = document.getElementById("editNombre");
  const editMarca = document.getElementById("editMarca");
  const editDetalle = document.getElementById("editDetalle");
  const editCodigo = document.getElementById("editCodigo");
  const editPrecio = document.getElementById("editPrecio");
  const editMoneyBox = document.getElementById("editMoneyBox");
  const editMsg = document.getElementById("editMsg");
  const formEditar = document.getElementById("formEditar");
  const btnEditarEscanear = document.getElementById("btnEditarEscanear");
  const btnEditarGuardar = document.getElementById("btnEditarGuardar");
  const msg = document.getElementById("msg");
  const btn = document.getElementById("btnGuardar");
  const buscador = document.getElementById("buscador");
  const lista = document.getElementById("listaProductos");
  const listaVacia = document.getElementById("listaVacia");
  const contador = document.getElementById("contadorProd");

  let productos = [];
  let omitirCodigo = false; // recordar si el usuario eligió guardar sin código
  let editandoId = null; // id del producto que se está editando

  // ---------- Helpers de UI ----------
  function mostrarMensaje(texto, tipo) {
    msg.textContent = texto;
    msg.className = `message message-${tipo}`;
  }
  function mostrarEstado(texto) {
    estado.innerHTML = texto ? `<span class="spinner"></span> ${texto}` : "";
    estado.style.display = texto ? "flex" : "none";
  }
  function abrirModalCodigo() {
    modalCodigo.classList.add("abierto");
  }
  function cerrarModalCodigo() {
    modalCodigo.classList.remove("abierto");
  }
  function limpiarFormulario() {
    form.reset();
    codigoBarras.value = "";
    cerrarModalCodigo();
    omitirCodigo = false;
  }
  precio.addEventListener("focus", () => moneyBox.classList.add("focus"));
  precio.addEventListener("blur", () => moneyBox.classList.remove("focus"));

  // ---------- Botones de método ----------
  document.querySelectorAll(".metodo-btn").forEach((b) => {
    b.addEventListener("click", () => elegirMetodo(b.dataset.metodo));
  });

  function elegirMetodo(metodo) {
    mostrarMensaje("", "");
    cerrarModalCodigo();
    if (metodo === "manual") {
      limpiarFormulario();
      nombre.focus();
    } else if (metodo === "foto") {
      inputFoto.click();
    } else if (metodo === "codigo") {
      limpiarFormulario();
      escanearYcompletar();
    }
  }

  // ---------- Foto + IA ----------
  inputFoto.addEventListener("change", async () => {
    const file = inputFoto.files?.[0];
    inputFoto.value = ""; // permitir volver a elegir la misma foto
    if (!file) return;

    mostrarEstado("Identificando el producto con IA...");
    try {
      const r = await identificarProductoPorFoto(file);
      if (!r.nombre && !r.marca) {
        mostrarMensaje("No pude reconocer el producto. Cargalo a mano. 🙂", "error");
      } else {
        nombre.value = r.nombre;
        marca.value = r.marca;
        detalle.value = r.detalle;
        mostrarMensaje("✅ Producto reconocido. Revisá los datos y poné el precio.", "success");
      }
    } catch (err) {
      mostrarMensaje("⚠️ " + err.message, "error");
    } finally {
      mostrarEstado("");
      precio.focus();
    }
  });

  // ---------- Código de barras ----------
  btnEscanear.addEventListener("click", () => escanearYcompletar());

  async function escanearYcompletar() {
    const codigo = await escanearCodigo();
    if (!codigo) return;

    codigoBarras.value = codigo;
    cerrarModalCodigo(); // ya tiene código, no hace falta pedirlo

    // Solo buscamos en el catálogo si el producto todavía no tiene nombre
    // (para no pisar lo que ya completó la foto o el usuario).
    if (!nombre.value.trim()) {
      mostrarEstado("Buscando el producto en el catálogo...");
      try {
        const r = await buscarPorCodigoBarras(codigo);
        if (r && (r.nombre || r.marca)) {
          nombre.value = r.nombre;
          marca.value = r.marca;
          detalle.value = r.detalle;
          mostrarMensaje("✅ Producto encontrado. Revisá y poné el precio.", "success");
        } else {
          mostrarMensaje("Código guardado. No estaba en el catálogo: cargá el nombre a mano. 🙂", "error");
        }
      } finally {
        mostrarEstado("");
      }
    } else {
      mostrarMensaje("✅ Código de barras agregado.", "success");
    }
    (nombre.value ? precio : nombre).focus();
  }

  // ---------- Pedido de escaneo al guardar ----------
  btnModalEscanear.addEventListener("click", () => {
    cerrarModalCodigo();
    escanearYcompletar();
  });
  btnModalOmitir.addEventListener("click", () => {
    omitirCodigo = true;
    cerrarModalCodigo();
    form.requestSubmit(); // reintenta guardar, ahora sí sin código
  });
  // Tocar el fondo oscuro cierra el modal (sin guardar)
  modalCodigo.addEventListener("click", (e) => {
    if (e.target === modalCodigo) cerrarModalCodigo();
  });

  // ---------- Editar producto ----------
  function abrirEditar(p) {
    editandoId = p.id;
    editNombre.value = p.nombre || "";
    editMarca.value = p.marca || "";
    editDetalle.value = p.detalle || "";
    editCodigo.value = p.codigo_barras || "";
    editPrecio.value = p.precio != null ? String(p.precio) : "";
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
    btnEditarGuardar.disabled = true;
    btnEditarGuardar.textContent = "Guardando...";
    try {
      await actualizarProducto(editandoId, {
        nombre: editNombre.value.trim(),
        marca: editMarca.value.trim(),
        detalle: editDetalle.value.trim(),
        precio: valorPrecio,
        codigo_barras: editCodigo.value.trim(),
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

  // ---------- Guardar ----------
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    mostrarMensaje("", "");

    const valorPrecio = parsearMonto(precio.value);
    if (!nombre.value.trim()) return mostrarMensaje("Escribí el nombre del producto.", "error");
    if (isNaN(valorPrecio) || valorPrecio < 0)
      return mostrarMensaje("Poné un precio válido. 💰", "error");

    // Si falta el código de barras, lo pedimos con el modal (una vez).
    if (!codigoBarras.value.trim() && !omitirCodigo) {
      abrirModalCodigo();
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
        codigo_barras: codigoBarras.value,
        uid: user.uid,
      });
      mostrarMensaje(`✅ "${nombre.value.trim()}" guardado a ${formatearMoneda(valorPrecio)}.`, "success");
      limpiarFormulario();
      await cargar();
    } catch (err) {
      mostrarMensaje("⚠️ No se pudo guardar. Probá de nuevo.", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "✅ Guardar producto";
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
      div.innerHTML = `
        <div class="producto-info">
          <div class="producto-nombre">${p.nombre}</div>
          <div class="producto-extra">${[p.marca, p.detalle].filter(Boolean).join(" · ") || "—"}</div>
        </div>
        <div class="producto-precio">${formatearMoneda(p.precio)}</div>
        <button class="btn-icon" data-edit="${p.id}" title="Editar">✏️</button>
        ${admin ? `<button class="btn-icon" data-del="${p.id}" title="Eliminar">🗑️</button>` : ""}
      `;
      lista.appendChild(div);
    });

    // Editar (disponible para cualquier usuario).
    lista.querySelectorAll("[data-edit]").forEach((b) => {
      b.addEventListener("click", () => {
        const p = productos.find((x) => x.id === b.dataset.edit);
        if (p) abrirEditar(p);
      });
    });

    // Eliminar (solo admin).
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

  buscador.addEventListener("input", () => {
    render(filtrarPorTexto(productos, buscador.value));
  });

  async function cargar() {
    productos = await listarProductos();
    render(filtrarPorTexto(productos, buscador.value));
  }

  await cargar();
})();
