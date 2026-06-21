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
  filtrarPorRubro,
} from "./services/productos.service.js";
import { identificarProductoPorFoto, clasificarProducto } from "./services/ia.service.js";
import { buscarPorCodigoBarras } from "./services/catalogo.service.js";
import { escanearCodigo } from "./components/scanner.js";
import { formatearMoneda, parsearMonto } from "./utils/format.js";
import { estadoVencimiento, textoDias } from "./utils/vencimientos.js";
import { RUBROS } from "./utils/rubros.js";
import { clasificarLocal } from "./utils/clasificador-local.js";
import {
  TIPOS_VENCIMIENTO,
  OPCIONES_VENCIMIENTO,
  normalizarClasificacion,
} from "./utils/clasificacion-producto.js";
import { escaparHTML } from "./utils/html.js";

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
          <input type="text" id="nombre" maxlength="100" placeholder="Ej: Gaseosa" required />
        </div>

        <div class="dos-columnas">
          <div class="field-block">
            <label for="marca">Marca</label>
            <input type="text" id="marca" maxlength="80" placeholder="Ej: Coca-Cola" />
          </div>
          <div class="field-block">
            <label for="detalle">Detalle</label>
            <input type="text" id="detalle" maxlength="100" placeholder="Ej: 1.5 L" />
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

        <!-- Se mantiene por compatibilidad con los datos existentes. -->
        <input type="checkbox" id="perecedero" hidden />

        <section class="clasificacion-box" id="clasificacionBox" hidden>
          <div class="clasificacion-titulo">✨ Revisá lo que detectamos</div>
          <p class="clasificacion-ayuda">Podés corregirlo antes de guardar.</p>
          <div class="dos-columnas">
            <div class="field-block">
              <label for="rubroDetectado">Rubro</label>
              <select id="rubroDetectado">
                ${RUBROS.map((r) => `<option value="${r}">${r}</option>`).join("")}
              </select>
            </div>
            <div class="field-block">
              <label for="tipoVencimiento">Vencimiento</label>
              <select id="tipoVencimiento">
                ${OPCIONES_VENCIMIENTO.map((o) => `<option value="${o.valor}">${o.etiqueta}</option>`).join("")}
              </select>
            </div>
          </div>
          <div class="clasificacion-resultado" id="clasificacionResultado"></div>
        </section>

        <div class="field-block" id="bloqueVencimiento" hidden>
          <label for="fechaVencimiento" id="labelFechaVencimiento">📅 Fecha de vencimiento</label>
          <input type="date" id="fechaVencimiento" />
          <div class="fecha-texto" id="ayudaFechaVencimiento"></div>
        </div>

        <div id="msg" class="message"></div>

        <button type="submit" class="btn btn-primary btn-grande" id="btnGuardar">
          ✅ Guardar producto
        </button>
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
          <div class="field-block">
            <label for="editRubro">🏷️ Rubro</label>
            <select id="editRubro">
              ${RUBROS.map((r) => `<option value="${r}">${r}</option>`).join("")}
            </select>
          </div>
          <div class="field-block">
            <label for="editTipoVenc">Control de vencimiento</label>
            <select id="editTipoVenc">
              ${OPCIONES_VENCIMIENTO.map((o) => `<option value="${o.valor}">${o.etiqueta}</option>`).join("")}
            </select>
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
  const perecedero = document.getElementById("perecedero");
  const clasificacionBox = document.getElementById("clasificacionBox");
  const rubroDetectado = document.getElementById("rubroDetectado");
  const tipoVencimiento = document.getElementById("tipoVencimiento");
  const clasificacionResultado = document.getElementById("clasificacionResultado");
  const bloqueVencimiento = document.getElementById("bloqueVencimiento");
  const fechaVencimiento = document.getElementById("fechaVencimiento");
  const labelFechaVencimiento = document.getElementById("labelFechaVencimiento");
  const ayudaFechaVencimiento = document.getElementById("ayudaFechaVencimiento");
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
  const editRubro = document.getElementById("editRubro");
  const editTipoVenc = document.getElementById("editTipoVenc");
  const editBloqueVenc = document.getElementById("editBloqueVenc");
  const editFechaVenc = document.getElementById("editFechaVenc");
  const editMsg = document.getElementById("editMsg");
  const formEditar = document.getElementById("formEditar");
  const btnEditarEscanear = document.getElementById("btnEditarEscanear");
  const btnEditarGuardar = document.getElementById("btnEditarGuardar");
  const msg = document.getElementById("msg");
  const btn = document.getElementById("btnGuardar");
  const buscador = document.getElementById("buscador");
  const filtroRubro = document.getElementById("filtroRubro");
  const lista = document.getElementById("listaProductos");
  const listaVacia = document.getElementById("listaVacia");
  const contador = document.getElementById("contadorProd");

  let productos = [];
  let clasificacionActual = null;
  let omitirCodigo = false; // recordar si el usuario eligió guardar sin código
  let editandoId = null; // id del producto que se está editando
  let perecederoDeterminado = false; // si la IA (o la foto) ya decidió si vence
  let rubroActual = "Otros"; // rubro asignado por la IA al producto en carga

  // ---------- Helpers de UI ----------
  function mostrarMensaje(texto, tipo) {
    msg.textContent = texto;
    msg.className = `message message-${tipo}`;
  }
  function mostrarEstado(texto) {
    estado.innerHTML = texto ? `<span class="spinner"></span> ${texto}` : "";
    estado.style.display = texto ? "flex" : "none";
  }
  function actualizarCampoVencimiento() {
    const tipo = tipoVencimiento.value;
    perecedero.checked = tipo === TIPOS_VENCIMIENTO.PERECEDERO;
    bloqueVencimiento.hidden = tipo === TIPOS_VENCIMIENTO.SIN_CONTROL;
    fechaVencimiento.required = tipo === TIPOS_VENCIMIENTO.PERECEDERO;
    labelFechaVencimiento.textContent = tipo === TIPOS_VENCIMIENTO.PERECEDERO
      ? "📅 Fecha de vencimiento (obligatoria)"
      : "📅 Fecha de vencimiento (opcional)";
    ayudaFechaVencimiento.textContent = tipo === TIPOS_VENCIMIENTO.LARGA_DURACION
      ? "Podés anotarla si querés recibir avisos más adelante."
      : tipo === TIPOS_VENCIMIENTO.PERECEDERO
        ? "No se puede guardar este producto sin la fecha."
        : "";
    if (tipo === TIPOS_VENCIMIENTO.SIN_CONTROL) fechaVencimiento.value = "";
  }
  function aplicarClasificacion(resultado) {
    clasificacionActual = normalizarClasificacion(resultado);
    rubroActual = RUBROS.includes(clasificacionActual.rubro)
      ? clasificacionActual.rubro
      : "Otros";
    rubroDetectado.value = rubroActual;
    tipoVencimiento.value = clasificacionActual.tipo_vencimiento;
    clasificacionBox.hidden = false;
    const confianza = clasificacionActual.confianza
      ? `Confianza: ${clasificacionActual.confianza}%. `
      : "";
    clasificacionResultado.textContent =
      confianza + (clasificacionActual.razon || "Revisá estas opciones.");
    actualizarCampoVencimiento();
  }
  async function clasificarDatosDelFormulario() {
    const texto = [nombre.value, marca.value, detalle.value].filter(Boolean).join(" ");
    const local = clasificarLocal(texto);
    if (local) return aplicarClasificacion(local);

    mostrarEstado("🤖 Analizando rubro y vencimiento...");
    try {
      aplicarClasificacion(await clasificarProducto(texto));
    } catch (_) {
      aplicarClasificacion({
        rubro: "Otros",
        tipo_vencimiento: "larga_duracion",
        confianza: 0,
        razon: "No pudimos clasificarlo automáticamente. Revisá estas opciones.",
        origen: "correccion_usuario",
      });
    } finally {
      mostrarEstado("");
    }
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
    bloqueVencimiento.hidden = true;
    clasificacionBox.hidden = true;
    cerrarModalCodigo();
    omitirCodigo = false;
    perecederoDeterminado = false;
    rubroActual = "Otros";
    clasificacionActual = null;
  }
  precio.addEventListener("focus", () => moneyBox.classList.add("focus"));
  precio.addEventListener("blur", () => moneyBox.classList.remove("focus"));

  // En la EDICIÓN sí hay un toggle manual (para corregir a la IA).
  rubroDetectado.addEventListener("change", () => {
    rubroActual = rubroDetectado.value;
    clasificacionActual = {
      ...clasificacionActual,
      rubro: rubroActual,
      origen: "correccion_usuario",
    };
  });
  tipoVencimiento.addEventListener("change", () => {
    clasificacionActual = {
      ...clasificacionActual,
      tipo_vencimiento: tipoVencimiento.value,
      origen: "correccion_usuario",
      confianza: 100,
      razon: "Clasificación confirmada por el usuario.",
    };
    actualizarCampoVencimiento();
  });

  editTipoVenc.addEventListener("change", () => {
    editBloqueVenc.hidden = editTipoVenc.value === TIPOS_VENCIMIENTO.SIN_CONTROL;
  });

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
        // La IA ya decidió si vence y el rubro (no re-analizar al guardar).
        perecederoDeterminado = true;
        aplicarClasificacion(r);
        if (r.tipo_vencimiento === TIPOS_VENCIMIENTO.PERECEDERO) {
          mostrarMensaje(`✅ Reconocido (${rubroActual}). ⚠️ Es perecedero: poné la fecha y el precio.`, "success");
        } else {
          mostrarMensaje(`✅ Reconocido (${rubroActual}). Revisá los datos y poné el precio.`, "success");
        }
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
    if (!perecederoDeterminado && nombre.value.trim()) {
      await clasificarDatosDelFormulario();
      perecederoDeterminado = true;
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
    editRubro.value = RUBROS.includes(p.rubro) ? p.rubro : "Otros";
    editTipoVenc.value = p.tipo_vencimiento
      || (p.perecedero ? TIPOS_VENCIMIENTO.PERECEDERO : TIPOS_VENCIMIENTO.LARGA_DURACION);
    editBloqueVenc.hidden = editTipoVenc.value === TIPOS_VENCIMIENTO.SIN_CONTROL;
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
    if (editTipoVenc.value === TIPOS_VENCIMIENTO.PERECEDERO && !editFechaVenc.value) {
      editBloqueVenc.hidden = false;
      editMsg.textContent = "📅 Poné la fecha de vencimiento.";
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
        rubro: editRubro.value,
        perecedero: editTipoVenc.value === TIPOS_VENCIMIENTO.PERECEDERO,
        tipo_vencimiento: editTipoVenc.value,
        fecha_vencimiento: editTipoVenc.value === TIPOS_VENCIMIENTO.SIN_CONTROL
          ? ""
          : editFechaVenc.value,
        clasificacion_origen: "correccion_usuario",
        clasificacion_confianza: 100,
        clasificacion_razon: "Clasificación confirmada al editar.",
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

    // La IA se encarga de decidir si es perecedero (si todavía no se sabe,
    // por ejemplo en cargas manuales o por código de barras).
    if (!perecederoDeterminado) {
      await clasificarDatosDelFormulario();
      perecederoDeterminado = true;
      mostrarMensaje("Revisá el rubro y el vencimiento. Después tocá Guardar otra vez.", "success");
      clasificacionBox.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    // Si la IA dijo que es perecedero, la fecha de vencimiento es OBLIGATORIA.
    if (tipoVencimiento.value === TIPOS_VENCIMIENTO.PERECEDERO && !fechaVencimiento.value) {
      bloqueVencimiento.hidden = false;
      fechaVencimiento.focus();
      return mostrarMensaje("📅 La IA detectó que es perecedero. Poné la fecha de vencimiento.", "error");
    }

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
        perecedero: tipoVencimiento.value === TIPOS_VENCIMIENTO.PERECEDERO,
        tipo_vencimiento: tipoVencimiento.value,
        fecha_vencimiento: tipoVencimiento.value === TIPOS_VENCIMIENTO.SIN_CONTROL
          ? ""
          : fechaVencimiento.value,
        rubro: rubroActual,
        clasificacion_origen: clasificacionActual?.origen || "manual",
        clasificacion_confianza: clasificacionActual?.confianza || 0,
        clasificacion_razon: clasificacionActual?.razon || "",
        uid: user.uid,
      });
      mostrarMensaje(`✅ "${nombre.value.trim()}" guardado en ${rubroActual} a ${formatearMoneda(valorPrecio)}.`, "success");
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
      let vencHtml = "";
      if (p.fecha_vencimiento && p.tipo_vencimiento !== TIPOS_VENCIMIENTO.SIN_CONTROL) {
        const e = estadoVencimiento(p.fecha_vencimiento);
        vencHtml = `<div class="venc-mini venc-${e.clave}">${e.emoji} ${textoDias(e.dias)}</div>`;
      } else if (p.perecedero) {
        vencHtml = `<div class="venc-mini venc-sinfecha">⚪ sin fecha de vencimiento</div>`;
      }
      div.innerHTML = `
        <div class="producto-info">
          <div class="producto-nombre">${escaparHTML(p.nombre)}</div>
          <div class="producto-extra">${escaparHTML([p.marca, p.detalle].filter(Boolean).join(" · ") || "—")}</div>
          <div class="producto-tags">
            <span class="rubro-chip">🏷️ ${escaparHTML(p.rubro || "Otros")}</span>
            ${vencHtml}
          </div>
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
