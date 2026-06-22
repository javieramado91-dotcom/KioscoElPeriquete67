// =============================================================
//  CONTROLADOR DE CUENTAS CORRIENTES (fiado) — versión completa
// -------------------------------------------------------------
//  - Lista de clientes con avatar, saldo y última actividad.
//  - Resumen, buscador, filtros (todos / deben / al día) y orden.
//  - Detalle del cliente: saldo grande, totales, acciones rápidas
//    (fiar, cobrar, saldar cuenta, recordatorio por WhatsApp),
//    e historial con saldo corriente.
// =============================================================

import { protegerPagina } from "./utils/guards.js";
import { montarLayout } from "./components/navbar.js";
import { esAdmin } from "./services/usuarios.service.js";
import {
  listarClientes,
  agregarCliente,
  actualizarCliente,
  eliminarCliente,
  listarMovimientos,
  agregarMovimiento,
  eliminarMovimiento,
  listarNotas,
  agregarNota,
  actualizarNota,
  eliminarNota,
} from "./services/cuentas.service.js";
import { formatearMoneda, parsearMonto, hoyISO, fechaLegible } from "./utils/format.js";
import { escaparHTML } from "./utils/html.js";

const PALETA = ["#e02d2d", "#d97706", "#0891b2", "#7c3aed", "#15803d", "#be185d", "#2563eb", "#b45309"];

function inicial(nombre) { return (nombre || "?").trim().charAt(0).toUpperCase() || "?"; }
function colorAvatar(nombre) {
  let h = 0;
  for (const ch of (nombre || "")) h = (h + ch.charCodeAt(0)) % PALETA.length;
  return PALETA[h];
}
function msAt(m) {
  const t = m.fecha_creacion;
  if (t && typeof t.toMillis === "function") return t.toMillis();
  if (t && t.seconds) return t.seconds * 1000;
  return 0;
}
// Link de WhatsApp (Argentina): deja el mensaje listo, el usuario lo envía.
function waLink(telefono, texto) {
  let d = (telefono || "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("0")) d = d.slice(1);
  if (d.startsWith("15")) d = d.slice(2); // saca el 15 local
  if (!d.startsWith("54")) d = "549" + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(texto)}`;
}

(async function init() {
  const { user, perfil } = await protegerPagina();
  const admin = esAdmin(perfil);

  const contenido = document.createElement("div");
  contenido.innerHTML = `
    <header class="page-header">
      <h1>🧾 Cuentas corrientes</h1>
      <p class="muted">Controlá el fiado de tus clientes: quién te debe y cuánto.</p>
    </header>

    <section class="grid-stats">
      <div class="stat-card stat-vencido">
        <div class="stat-label">Total a cobrar</div>
        <div class="stat-value" id="cTotal">$0</div>
      </div>
      <div class="stat-card stat-pronto">
        <div class="stat-label">Clientes con deuda</div>
        <div class="stat-value" id="cDeudores">0</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Clientes</div>
        <div class="stat-value" id="cClientes">0</div>
      </div>
    </section>

    <div class="alta-cta">
      <button type="button" class="btn btn-primary btn-grande btn-block btn-alta" id="btnNuevoCliente">
        ➕ Nuevo cliente
      </button>
      <div id="altaMsg" class="message"></div>
    </div>

    <div class="cuentas-toolbar">
      <input type="search" id="buscador" class="cuentas-search" placeholder="🔎 Buscar cliente..." />
      <div class="filtro-chips" id="filtroChips">
        <button type="button" class="chip sel" data-filtro="todos">Todos</button>
        <button type="button" class="chip" data-filtro="deben">Deben</button>
        <button type="button" class="chip" data-filtro="aldia">Al día</button>
      </div>
      <select id="orden" class="cuentas-orden">
        <option value="deuda">Ordenar: más deuda</option>
        <option value="nombre">Ordenar: nombre A-Z</option>
        <option value="reciente">Ordenar: actividad reciente</option>
      </select>
    </div>

    <section class="lista-clientes" id="listaClientes"></section>
    <div id="listaVacia" class="empty-state" hidden>
      No hay clientes para mostrar. Tocá "➕ Nuevo cliente" para empezar.
    </div>

    <!-- MODAL: nuevo / editar cliente -->
    <div class="modal-overlay" id="modalCliente">
      <div class="modal-card modal-card-form">
        <div class="modal-header">
          <h2 class="modal-titulo" id="modalClienteTitulo">👤 Nuevo cliente</h2>
          <button type="button" class="modal-cerrar" id="btnClienteCerrar" aria-label="Cerrar">✕</button>
        </div>
        <form id="formCliente" novalidate>
          <div class="field-block">
            <label for="clNombre">Nombre y apellido</label>
            <input type="text" id="clNombre" maxlength="80" placeholder="Ej: María González" />
          </div>
          <div class="field-block">
            <label for="clTelefono">📞 Teléfono <span class="opcional">(para WhatsApp)</span></label>
            <input type="text" id="clTelefono" maxlength="40" inputmode="tel" placeholder="Ej: 11 5555-5555" />
          </div>
          <div class="field-block">
            <label for="clNotas">📝 Notas <span class="opcional">(opcional)</span></label>
            <textarea id="clNotas" rows="2" maxlength="300" placeholder="Ej: vecina, paga los viernes"></textarea>
          </div>
          <div id="clMsg" class="message"></div>
          <div class="modal-acciones">
            <button type="submit" class="btn btn-primary btn-grande" id="btnClienteGuardar">💾 Guardar</button>
            <button type="button" class="btn btn-ghost" id="btnClienteCancelar">Cancelar</button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL: detalle de cuenta -->
    <div class="modal-overlay" id="modalDetalle">
      <div class="modal-card modal-card-form modal-detalle">
        <div class="modal-header detalle-head">
          <div class="detalle-head-cliente">
            <div class="cliente-avatar" id="detAvatar">?</div>
            <div>
              <h2 class="modal-titulo" id="detNombre">Cuenta</h2>
              <div class="muted" id="detContacto"></div>
            </div>
          </div>
          <button type="button" class="modal-cerrar" id="btnDetCerrar" aria-label="Cerrar">✕</button>
        </div>

        <div class="cuenta-saldo-box" id="detSaldoBox">
          <div class="cuenta-saldo-label">Saldo actual</div>
          <div class="cuenta-saldo-monto" id="detSaldo">$0</div>
          <div class="cuenta-saldo-mini" id="detMini"></div>
        </div>

        <div class="detalle-acciones">
          <button type="button" class="btn-accion accion-fiar" id="actFiar"><span class="acc-ico">🛒</span><span>Fiar</span></button>
          <button type="button" class="btn-accion accion-pago" id="actPago"><span class="acc-ico">💵</span><span>Cobrar</span></button>
          <button type="button" class="btn-accion accion-saldar" id="actSaldar"><span class="acc-ico">✅</span><span>Saldar</span></button>
          <button type="button" class="btn-accion accion-wa" id="actWa"><span class="acc-ico">💬</span><span>WhatsApp</span></button>
        </div>

        <!-- Form de movimiento (se muestra al tocar Fiar / Cobrar) -->
        <div class="mov-form" id="movForm" hidden>
          <div class="mov-form-titulo" id="movFormTitulo"></div>
          <div class="dos-columnas">
            <div class="field-block">
              <label for="movMonto">💰 Monto</label>
              <div class="money-input" id="movMoneyBox">
                <span class="money-symbol">$</span>
                <input type="text" id="movMonto" inputmode="decimal" placeholder="0" autocomplete="off" />
              </div>
            </div>
            <div class="field-block">
              <label for="movFecha">📅 Fecha</label>
              <input type="date" id="movFecha" />
            </div>
          </div>
          <div class="field-block">
            <label for="movDetalle">📝 Detalle <span class="opcional">(opcional)</span></label>
            <input type="text" id="movDetalle" maxlength="120" placeholder="Ej: mercadería, pan, gaseosas..." />
          </div>
          <div id="movMsg" class="message"></div>
          <div class="modal-acciones">
            <button type="button" class="btn btn-primary btn-grande" id="btnMovGuardar">Registrar</button>
            <button type="button" class="btn btn-ghost" id="btnMovCancelar">Cancelar</button>
          </div>
        </div>

        <h3 class="section-title">📌 Pizarra · novedades</h3>
        <p class="pizarra-ayuda muted">Anotá cosas no monetarias: botellas/envases que debe, encargues, recordatorios...</p>
        <div class="pizarra-add">
          <input type="text" id="notaTexto" maxlength="140" placeholder="Ej: debe 3 botellas de litro" />
          <button type="button" class="btn btn-primary" id="btnNota">📌 Anotar</button>
        </div>
        <div id="listaNotas" class="pizarra-lista"></div>
        <div id="notasVacio" class="empty-state" hidden>Sin novedades anotadas.</div>

        <h3 class="section-title">Historial de cuenta</h3>
        <div id="listaMovimientos"></div>
        <div id="movVacio" class="empty-state" hidden>Sin movimientos todavía.</div>

        <div class="detalle-footer">
          <button type="button" class="btn btn-outline" id="btnEditarCliente">✏️ Editar datos</button>
          ${admin ? `<button type="button" class="btn btn-ghost" id="btnEliminarCliente">🗑️ Eliminar cliente</button>` : ""}
        </div>
      </div>
    </div>
  `;

  montarLayout({ activo: "cuentas", perfil, contenido });

  // --- Referencias ---
  const cTotal = document.getElementById("cTotal");
  const cDeudores = document.getElementById("cDeudores");
  const cClientes = document.getElementById("cClientes");
  const altaMsg = document.getElementById("altaMsg");
  const buscador = document.getElementById("buscador");
  const filtroChips = document.getElementById("filtroChips");
  const ordenSel = document.getElementById("orden");
  const listaClientes = document.getElementById("listaClientes");
  const listaVacia = document.getElementById("listaVacia");

  const modalCliente = document.getElementById("modalCliente");
  const modalClienteTitulo = document.getElementById("modalClienteTitulo");
  const formCliente = document.getElementById("formCliente");
  const clNombre = document.getElementById("clNombre");
  const clTelefono = document.getElementById("clTelefono");
  const clNotas = document.getElementById("clNotas");
  const clMsg = document.getElementById("clMsg");
  const btnClienteGuardar = document.getElementById("btnClienteGuardar");

  const modalDetalle = document.getElementById("modalDetalle");
  const detAvatar = document.getElementById("detAvatar");
  const detNombre = document.getElementById("detNombre");
  const detContacto = document.getElementById("detContacto");
  const detSaldoBox = document.getElementById("detSaldoBox");
  const detSaldo = document.getElementById("detSaldo");
  const detMini = document.getElementById("detMini");
  const actFiar = document.getElementById("actFiar");
  const actPago = document.getElementById("actPago");
  const actSaldar = document.getElementById("actSaldar");
  const actWa = document.getElementById("actWa");
  const movForm = document.getElementById("movForm");
  const movFormTitulo = document.getElementById("movFormTitulo");
  const movMonto = document.getElementById("movMonto");
  const movMoneyBox = document.getElementById("movMoneyBox");
  const movFecha = document.getElementById("movFecha");
  const movDetalle = document.getElementById("movDetalle");
  const movMsg = document.getElementById("movMsg");
  const btnMovGuardar = document.getElementById("btnMovGuardar");
  const btnMovCancelar = document.getElementById("btnMovCancelar");
  const listaMovimientos = document.getElementById("listaMovimientos");
  const movVacio = document.getElementById("movVacio");
  const notaTexto = document.getElementById("notaTexto");
  const btnNota = document.getElementById("btnNota");
  const listaNotas = document.getElementById("listaNotas");
  const notasVacio = document.getElementById("notasVacio");
  const btnEditarCliente = document.getElementById("btnEditarCliente");
  const btnEliminarCliente = document.getElementById("btnEliminarCliente");

  let clientes = [];
  let movimientos = [];
  let notas = [];
  let stats = {};            // id -> { saldo, totalCargo, totalPago, ultima, cant }
  let clienteActualId = null;
  let editandoClienteId = null;
  let filtro = "todos";
  let tipoMov = "cargo";

  function mostrarAlta(texto, tipo) {
    altaMsg.textContent = texto || "";
    altaMsg.className = texto ? `message message-${tipo}` : "message";
  }

  function calcularStats() {
    stats = {};
    clientes.forEach((c) => { stats[c.id] = { saldo: 0, totalCargo: 0, totalPago: 0, ultima: 0, cant: 0 }; });
    movimientos.forEach((m) => {
      const s = stats[m.cliente_id] || (stats[m.cliente_id] = { saldo: 0, totalCargo: 0, totalPago: 0, ultima: 0, cant: 0 });
      const monto = Number(m.monto) || 0;
      if (m.tipo === "pago") { s.saldo -= monto; s.totalPago += monto; }
      else { s.saldo += monto; s.totalCargo += monto; }
      s.cant++;
      const ms = msAt(m);
      if (ms > s.ultima) s.ultima = ms;
    });
  }

  // ================= LISTA DE CLIENTES =================
  function render() {
    cClientes.textContent = clientes.length;
    let total = 0, deudores = 0;
    clientes.forEach((c) => {
      const s = (stats[c.id] || {}).saldo || 0;
      if (s > 0.001) { total += s; deudores++; }
    });
    cTotal.textContent = formatearMoneda(total);
    cDeudores.textContent = deudores;

    const t = buscador.value.trim().toLowerCase();
    let items = clientes.filter((c) => {
      const s = (stats[c.id] || {}).saldo || 0;
      if (filtro === "deben" && !(s > 0.001)) return false;
      if (filtro === "aldia" && s > 0.001) return false;
      if (t && !([c.nombre, c.telefono].filter(Boolean).join(" ").toLowerCase().includes(t))) return false;
      return true;
    });

    const orden = ordenSel.value;
    items.sort((a, b) => {
      const sa = (stats[a.id] || {}), sb = (stats[b.id] || {});
      if (orden === "nombre") return (a.nombre || "").localeCompare(b.nombre || "");
      if (orden === "reciente") return (sb.ultima || 0) - (sa.ultima || 0);
      return (sb.saldo || 0) - (sa.saldo || 0); // más deuda primero
    });

    listaClientes.innerHTML = "";
    listaVacia.hidden = items.length > 0;

    items.forEach((c) => {
      const s = stats[c.id] || { saldo: 0, ultima: 0 };
      const debe = s.saldo > 0.001;
      const div = document.createElement("div");
      div.className = "cliente-card";
      const ultimaTxt = s.ultima ? "últ. mov. " + fechaLegible(new Date(s.ultima).toISOString().slice(0, 10)) : "sin movimientos";
      const pend = notasPendientesDe(c.id);
      const pizarraBadge = pend ? `<span class="pizarra-badge" title="Novedades pendientes">📌 ${pend}</span>` : "";
      div.innerHTML = `
        <div class="cliente-avatar" style="background:${colorAvatar(c.nombre)}">${escaparHTML(inicial(c.nombre))}</div>
        <div class="cliente-main">
          <div class="cliente-nombre">${escaparHTML(c.nombre)} ${pizarraBadge}</div>
          <div class="cliente-sub">${c.telefono ? "📞 " + escaparHTML(c.telefono) + " · " : ""}${escaparHTML(ultimaTxt)}</div>
        </div>
        <div class="cliente-saldo ${debe ? "saldo-debe" : "saldo-ok"}">
          ${debe ? formatearMoneda(s.saldo) : "Al día ✅"}
        </div>
      `;
      div.addEventListener("click", () => abrirDetalle(c.id));
      listaClientes.appendChild(div);
    });
  }

  buscador.addEventListener("input", render);
  ordenSel.addEventListener("change", render);
  filtroChips.querySelectorAll("[data-filtro]").forEach((b) => {
    b.addEventListener("click", () => {
      filtro = b.dataset.filtro;
      filtroChips.querySelectorAll(".chip").forEach((x) => x.classList.toggle("sel", x === b));
      render();
    });
  });

  // ================= NUEVO / EDITAR CLIENTE =================
  function abrirNuevoCliente() {
    editandoClienteId = null;
    modalClienteTitulo.textContent = "👤 Nuevo cliente";
    formCliente.reset();
    clMsg.textContent = ""; clMsg.className = "message";
    modalCliente.classList.add("abierto");
    setTimeout(() => clNombre.focus(), 50);
  }
  function abrirEditarCliente(c) {
    editandoClienteId = c.id;
    modalClienteTitulo.textContent = "✏️ Editar cliente";
    clNombre.value = c.nombre || "";
    clTelefono.value = c.telefono || "";
    clNotas.value = c.notas || "";
    clMsg.textContent = ""; clMsg.className = "message";
    modalCliente.classList.add("abierto");
  }
  function cerrarCliente() { modalCliente.classList.remove("abierto"); }

  document.getElementById("btnNuevoCliente").addEventListener("click", abrirNuevoCliente);
  document.getElementById("btnClienteCerrar").addEventListener("click", cerrarCliente);
  document.getElementById("btnClienteCancelar").addEventListener("click", cerrarCliente);
  modalCliente.addEventListener("click", (e) => { if (e.target === modalCliente) cerrarCliente(); });

  formCliente.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!clNombre.value.trim()) {
      clMsg.textContent = "Escribí el nombre del cliente.";
      clMsg.className = "message message-error";
      return;
    }
    btnClienteGuardar.disabled = true;
    btnClienteGuardar.textContent = "Guardando...";
    try {
      if (editandoClienteId) {
        await actualizarCliente(editandoClienteId, {
          nombre: clNombre.value.trim(), telefono: clTelefono.value.trim(), notas: clNotas.value.trim(),
        });
      } else {
        await agregarCliente({ nombre: clNombre.value, telefono: clTelefono.value, notas: clNotas.value, uid: user.uid });
      }
      const reabrir = editandoClienteId;
      cerrarCliente();
      mostrarAlta(editandoClienteId ? "✅ Cliente actualizado." : "✅ Cliente agregado.", "success");
      await cargar();
      if (reabrir) abrirDetalle(reabrir);
    } catch (err) {
      clMsg.textContent = "⚠️ Error: " + (err?.code || err?.message || "desconocido");
      clMsg.className = "message message-error";
    } finally {
      btnClienteGuardar.disabled = false;
      btnClienteGuardar.textContent = "💾 Guardar";
    }
  });

  // ================= DETALLE =================
  function abrirDetalle(clienteId) {
    clienteActualId = clienteId;
    const c = clientes.find((x) => x.id === clienteId);
    if (!c) return;
    detAvatar.textContent = inicial(c.nombre);
    detAvatar.style.background = colorAvatar(c.nombre);
    detNombre.textContent = c.nombre;
    detContacto.textContent = [c.telefono, c.notas].filter(Boolean).join(" · ") || "Sin teléfono";
    ocultarMovForm();
    renderDetalle();
    renderPizarra();
    modalDetalle.classList.add("abierto");
  }
  function cerrarDetalle() { modalDetalle.classList.remove("abierto"); clienteActualId = null; }
  document.getElementById("btnDetCerrar").addEventListener("click", cerrarDetalle);
  modalDetalle.addEventListener("click", (e) => { if (e.target === modalDetalle) cerrarDetalle(); });

  function renderDetalle() {
    const s = stats[clienteActualId] || { saldo: 0, totalCargo: 0, totalPago: 0 };
    const debe = s.saldo > 0.001;
    detSaldo.textContent = debe ? formatearMoneda(s.saldo) : "Al día ✅";
    detSaldoBox.className = `cuenta-saldo-box ${debe ? "box-debe" : "box-ok"}`;
    detMini.textContent = `Fiado total: ${formatearMoneda(s.totalCargo)}  ·  Pagado: ${formatearMoneda(s.totalPago)}`;

    // Acciones: Saldar y WhatsApp según corresponda.
    const c = clientes.find((x) => x.id === clienteActualId) || {};
    actSaldar.style.display = debe ? "" : "none";
    actWa.style.display = c.telefono ? "" : "none";

    // Historial con saldo corriente.
    const movsAsc = movimientos
      .filter((m) => m.cliente_id === clienteActualId)
      .sort((a, b) => (a.fecha === b.fecha ? msAt(a) - msAt(b) : (a.fecha < b.fecha ? -1 : 1)));
    let bal = 0;
    const conBal = movsAsc.map((m) => {
      bal += (m.tipo === "pago" ? -1 : 1) * (Number(m.monto) || 0);
      return { m, bal };
    });
    conBal.reverse();

    listaMovimientos.innerHTML = "";
    movVacio.hidden = conBal.length > 0;
    conBal.forEach(({ m, bal }) => {
      const esPago = m.tipo === "pago";
      const div = document.createElement("div");
      div.className = `mov-item ${esPago ? "mov-pago" : "mov-cargo"}`;
      div.innerHTML = `
        <div class="mov-info">
          <div class="mov-tipo">${esPago ? "💵 Pago" : "🛒 Deuda"}${m.detalle ? " · " + escaparHTML(m.detalle) : ""}</div>
          <div class="mov-fecha muted">${m.fecha ? fechaLegible(m.fecha) : "—"} · saldo: ${formatearMoneda(bal)}</div>
        </div>
        <div class="mov-monto">${esPago ? "−" : "+"} ${formatearMoneda(Number(m.monto) || 0)}</div>
        ${admin ? `<button class="btn-icon" data-delmov="${m.id}" title="Borrar">🗑️</button>` : ""}
      `;
      listaMovimientos.appendChild(div);
    });
    if (admin) {
      listaMovimientos.querySelectorAll("[data-delmov]").forEach((b) => {
        b.addEventListener("click", async () => {
          if (!confirm("¿Borrar este movimiento?")) return;
          await eliminarMovimiento(b.dataset.delmov);
          await cargar();
          renderDetalle();
        });
      });
    }
  }

  // --- Pizarra de novedades ---
  function renderPizarra() {
    const items = notas
      .filter((n) => n.cliente_id === clienteActualId)
      .sort((a, b) => (a.hecho === b.hecho ? msAt(b) - msAt(a) : (a.hecho ? 1 : -1)));
    listaNotas.innerHTML = "";
    notasVacio.hidden = items.length > 0;
    items.forEach((n) => {
      const div = document.createElement("div");
      div.className = `nota-item ${n.hecho ? "hecha" : ""}`;
      div.innerHTML = `
        <button class="nota-check" data-toggle="${n.id}" title="${n.hecho ? "Marcar como pendiente" : "Marcar como resuelto"}">${n.hecho ? "✅" : "⬜"}</button>
        <div class="nota-texto">${escaparHTML(n.texto)}</div>
        <button class="btn-icon" data-delnota="${n.id}" title="Borrar">🗑️</button>
      `;
      listaNotas.appendChild(div);
    });
    listaNotas.querySelectorAll("[data-toggle]").forEach((b) => {
      b.addEventListener("click", async () => {
        const n = notas.find((x) => x.id === b.dataset.toggle);
        if (!n) return;
        await actualizarNota(n.id, { hecho: !n.hecho });
        await cargar();
        renderPizarra();
      });
    });
    listaNotas.querySelectorAll("[data-delnota]").forEach((b) => {
      b.addEventListener("click", async () => {
        await eliminarNota(b.dataset.delnota);
        await cargar();
        renderPizarra();
      });
    });
  }

  async function guardarNota() {
    const texto = notaTexto.value.trim();
    if (!texto) { notaTexto.focus(); return; }
    btnNota.disabled = true;
    try {
      await agregarNota({ cliente_id: clienteActualId, texto, uid: user.uid });
      notaTexto.value = "";
      await cargar();
      renderPizarra();
      notaTexto.focus();
    } catch (err) {
      alert("No se pudo anotar: " + (err?.code || err?.message || "error"));
    } finally {
      btnNota.disabled = false;
    }
  }
  btnNota.addEventListener("click", guardarNota);
  notaTexto.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); guardarNota(); }
  });

  // --- Acciones rápidas ---
  function mostrarMovForm(tipo) {
    tipoMov = tipo;
    movForm.hidden = false;
    movFormTitulo.textContent = tipo === "pago" ? "💵 Registrar un pago" : "🛒 Registrar una deuda (fiado)";
    movFormTitulo.className = "mov-form-titulo " + (tipo === "pago" ? "titulo-pago" : "titulo-cargo");
    btnMovGuardar.textContent = tipo === "pago" ? "💵 Registrar pago" : "🛒 Registrar deuda";
    btnMovGuardar.className = "btn btn-grande " + (tipo === "pago" ? "btn-pago" : "btn-primary");
    movMonto.value = ""; movDetalle.value = ""; movFecha.value = hoyISO();
    movMsg.textContent = ""; movMsg.className = "message";
    movForm.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => movMonto.focus(), 60);
  }
  function ocultarMovForm() { movForm.hidden = true; }
  actFiar.addEventListener("click", () => mostrarMovForm("cargo"));
  actPago.addEventListener("click", () => mostrarMovForm("pago"));
  btnMovCancelar.addEventListener("click", ocultarMovForm);
  movMonto.addEventListener("focus", () => movMoneyBox.classList.add("focus"));
  movMonto.addEventListener("blur", () => movMoneyBox.classList.remove("focus"));

  actWa.addEventListener("click", () => {
    const c = clientes.find((x) => x.id === clienteActualId);
    if (!c) return;
    const s = stats[clienteActualId] || { saldo: 0 };
    const texto = s.saldo > 0.001
      ? `Hola ${c.nombre}, te recuerdo que tenés una cuenta pendiente de ${formatearMoneda(s.saldo)} en El Periquete. ¡Gracias! 🙂`
      : `Hola ${c.nombre}, ¡tu cuenta en El Periquete está al día! Gracias. 🙂`;
    const link = waLink(c.telefono, texto);
    if (link) window.open(link, "_blank");
  });

  actSaldar.addEventListener("click", async () => {
    const s = stats[clienteActualId] || { saldo: 0 };
    if (!(s.saldo > 0.001)) return;
    if (!confirm(`¿Registrar el pago total de ${formatearMoneda(s.saldo)} y dejar la cuenta en cero?`)) return;
    try {
      await agregarMovimiento({
        cliente_id: clienteActualId, tipo: "pago", monto: s.saldo,
        detalle: "Saldó la cuenta", fecha: hoyISO(), uid: user.uid,
      });
      await cargar();
      renderDetalle();
    } catch (err) {
      alert("No se pudo registrar el pago: " + (err?.code || err?.message || "error"));
    }
  });

  btnMovGuardar.addEventListener("click", async () => {
    const monto = parsearMonto(movMonto.value);
    if (isNaN(monto) || monto <= 0) {
      movMsg.textContent = "Poné un monto mayor a 0. 💰";
      movMsg.className = "message message-error";
      return;
    }
    btnMovGuardar.disabled = true;
    try {
      await agregarMovimiento({
        cliente_id: clienteActualId, tipo: tipoMov, monto,
        detalle: movDetalle.value, fecha: movFecha.value || hoyISO(), uid: user.uid,
      });
      ocultarMovForm();
      await cargar();
      renderDetalle();
    } catch (err) {
      movMsg.textContent = "⚠️ Error: " + (err?.code || err?.message || "desconocido");
      movMsg.className = "message message-error";
    } finally {
      btnMovGuardar.disabled = false;
    }
  });

  btnEditarCliente.addEventListener("click", () => {
    const c = clientes.find((x) => x.id === clienteActualId);
    if (!c) return;
    cerrarDetalle();
    abrirEditarCliente(c);
  });
  if (btnEliminarCliente) {
    btnEliminarCliente.addEventListener("click", async () => {
      const c = clientes.find((x) => x.id === clienteActualId);
      if (!c) return;
      const movs = movimientos.filter((m) => m.cliente_id === c.id);
      if (!confirm(`¿Eliminar a "${c.nombre}"${movs.length ? " y sus " + movs.length + " movimientos" : ""}?`)) return;
      for (const m of movs) await eliminarMovimiento(m.id);
      await eliminarCliente(c.id);
      cerrarDetalle();
      mostrarAlta("✅ Cliente eliminado.", "success");
      await cargar();
    });
  }

  // ================= CARGA =================
  function notasPendientesDe(clienteId) {
    return notas.filter((n) => n.cliente_id === clienteId && !n.hecho).length;
  }

  async function cargar() {
    [clientes, movimientos, notas] = await Promise.all([
      listarClientes(), listarMovimientos(), listarNotas(),
    ]);
    calcularStats();
    render();
  }

  await cargar();
})();
