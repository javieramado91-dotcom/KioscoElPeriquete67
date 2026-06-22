// =============================================================
//  CONTROLADOR DE CUENTAS CORRIENTES (fiado)
// -------------------------------------------------------------
//  - Lista de clientes con su saldo (lo que deben).
//  - Resumen: total a cobrar y cuántos deben.
//  - Detalle de cada cliente: historial de deudas (cargos) y
//    pagos, con la posibilidad de cargar nuevos movimientos.
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
  calcularSaldos,
} from "./services/cuentas.service.js";
import { formatearMoneda, parsearMonto, hoyISO, fechaLegible } from "./utils/format.js";
import { escaparHTML } from "./utils/html.js";

(async function init() {
  const { user, perfil } = await protegerPagina();
  const admin = esAdmin(perfil);

  const contenido = document.createElement("div");
  contenido.innerHTML = `
    <header class="page-header">
      <h1>🧾 Cuentas corrientes</h1>
      <p class="muted">Controlá lo que te deben tus clientes (fiado).</p>
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

    <div class="buscador buscador-grande">
      <input type="search" id="buscador" placeholder="🔎 Buscar cliente..." />
    </div>

    <section class="lista-productos" id="listaClientes"></section>
    <div id="listaVacia" class="empty-state" hidden>
      Todavía no cargaste clientes. Tocá "➕ Nuevo cliente" para empezar.
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
            <label for="clTelefono">📞 Teléfono <span class="opcional">(opcional)</span></label>
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

    <!-- MODAL: detalle de cuenta del cliente -->
    <div class="modal-overlay" id="modalDetalle">
      <div class="modal-card modal-card-form">
        <div class="modal-header">
          <h2 class="modal-titulo" id="detNombre">Cuenta</h2>
          <button type="button" class="modal-cerrar" id="btnDetCerrar" aria-label="Cerrar">✕</button>
        </div>

        <div class="cuenta-saldo-box" id="detSaldoBox">
          <div class="cuenta-saldo-label">Saldo actual</div>
          <div class="cuenta-saldo-monto" id="detSaldo">$0</div>
        </div>
        <div class="cuenta-contacto muted" id="detContacto"></div>

        <!-- Cargar un movimiento -->
        <div class="mov-form">
          <div class="tipo-toggle">
            <button type="button" class="tipo-btn tipo-cargo sel" id="tipoCargo">🛒 Fiar (deuda)</button>
            <button type="button" class="tipo-btn tipo-pago" id="tipoPago">💵 Pago</button>
          </div>
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
          <button type="button" class="btn btn-primary btn-grande btn-block" id="btnMovGuardar">Registrar</button>
        </div>

        <h3 class="section-title">Movimientos</h3>
        <div id="listaMovimientos"></div>
        <div id="movVacio" class="empty-state" hidden>Sin movimientos todavía.</div>

        ${""}
        <div class="modal-acciones" style="margin-top:16px">
          <button type="button" class="btn btn-outline btn-block" id="btnEditarCliente">✏️ Editar datos del cliente</button>
          ${admin ? `<button type="button" class="btn btn-ghost btn-block" id="btnEliminarCliente">🗑️ Eliminar cliente</button>` : ""}
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
  const detNombre = document.getElementById("detNombre");
  const detSaldoBox = document.getElementById("detSaldoBox");
  const detSaldo = document.getElementById("detSaldo");
  const detContacto = document.getElementById("detContacto");
  const tipoCargo = document.getElementById("tipoCargo");
  const tipoPago = document.getElementById("tipoPago");
  const movMonto = document.getElementById("movMonto");
  const movMoneyBox = document.getElementById("movMoneyBox");
  const movFecha = document.getElementById("movFecha");
  const movDetalle = document.getElementById("movDetalle");
  const movMsg = document.getElementById("movMsg");
  const btnMovGuardar = document.getElementById("btnMovGuardar");
  const listaMovimientos = document.getElementById("listaMovimientos");
  const movVacio = document.getElementById("movVacio");
  const btnEditarCliente = document.getElementById("btnEditarCliente");
  const btnEliminarCliente = document.getElementById("btnEliminarCliente");

  let clientes = [];
  let movimientos = [];
  let saldos = {};
  let clienteActualId = null;
  let editandoClienteId = null;
  let tipoMov = "cargo";

  function mostrarAlta(texto, tipo) {
    altaMsg.textContent = texto || "";
    altaMsg.className = texto ? `message message-${tipo}` : "message";
  }

  // ================= LISTA DE CLIENTES =================
  function render(items) {
    cClientes.textContent = clientes.length;
    let total = 0, deudores = 0;
    clientes.forEach((c) => {
      const s = saldos[c.id] || 0;
      if (s > 0.001) { total += s; deudores++; }
    });
    cTotal.textContent = formatearMoneda(total);
    cDeudores.textContent = deudores;

    listaClientes.innerHTML = "";
    listaVacia.hidden = items.length > 0;

    items.forEach((c) => {
      const s = saldos[c.id] || 0;
      const debe = s > 0.001;
      const div = document.createElement("div");
      div.className = "producto-item cuenta-item";
      div.innerHTML = `
        <div class="producto-info">
          <div class="producto-nombre">${escaparHTML(c.nombre)}</div>
          <div class="producto-extra">${escaparHTML(c.telefono || "—")}</div>
        </div>
        <div class="cuenta-saldo ${debe ? "saldo-debe" : "saldo-ok"}">
          ${debe ? "Debe " + formatearMoneda(s) : "Al día ✅"}
        </div>
      `;
      div.addEventListener("click", () => abrirDetalle(c.id));
      listaClientes.appendChild(div);
    });
  }

  function aplicarBusqueda() {
    const t = buscador.value.trim().toLowerCase();
    const items = !t
      ? clientes
      : clientes.filter((c) =>
          [c.nombre, c.telefono].filter(Boolean).join(" ").toLowerCase().includes(t)
        );
    render(items);
  }
  buscador.addEventListener("input", aplicarBusqueda);

  // ================= NUEVO / EDITAR CLIENTE =================
  function abrirNuevoCliente() {
    editandoClienteId = null;
    modalClienteTitulo.textContent = "👤 Nuevo cliente";
    formCliente.reset();
    clMsg.textContent = "";
    clMsg.className = "message";
    modalCliente.classList.add("abierto");
    setTimeout(() => clNombre.focus(), 50);
  }
  function abrirEditarCliente(c) {
    editandoClienteId = c.id;
    modalClienteTitulo.textContent = "✏️ Editar cliente";
    clNombre.value = c.nombre || "";
    clTelefono.value = c.telefono || "";
    clNotas.value = c.notas || "";
    clMsg.textContent = "";
    clMsg.className = "message";
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
          nombre: clNombre.value.trim(),
          telefono: clTelefono.value.trim(),
          notas: clNotas.value.trim(),
        });
      } else {
        await agregarCliente({
          nombre: clNombre.value,
          telefono: clTelefono.value,
          notas: clNotas.value,
          uid: user.uid,
        });
      }
      cerrarCliente();
      mostrarAlta(editandoClienteId ? "✅ Cliente actualizado." : "✅ Cliente agregado.", "success");
      const reabrir = editandoClienteId;
      await cargar();
      if (reabrir) abrirDetalle(reabrir); // si estábamos editando desde el detalle, lo reabrimos
    } catch (err) {
      clMsg.textContent = "⚠️ Error: " + (err?.code || err?.message || "desconocido");
      clMsg.className = "message message-error";
      console.error("Error guardando cliente:", err);
    } finally {
      btnClienteGuardar.disabled = false;
      btnClienteGuardar.textContent = "💾 Guardar";
    }
  });

  // ================= DETALLE DE CUENTA =================
  function seleccionarTipo(tipo) {
    tipoMov = tipo;
    tipoCargo.classList.toggle("sel", tipo === "cargo");
    tipoPago.classList.toggle("sel", tipo === "pago");
    btnMovGuardar.textContent = tipo === "pago" ? "💵 Registrar pago" : "🛒 Registrar deuda";
  }
  tipoCargo.addEventListener("click", () => seleccionarTipo("cargo"));
  tipoPago.addEventListener("click", () => seleccionarTipo("pago"));
  movMonto.addEventListener("focus", () => movMoneyBox.classList.add("focus"));
  movMonto.addEventListener("blur", () => movMoneyBox.classList.remove("focus"));

  function abrirDetalle(clienteId) {
    clienteActualId = clienteId;
    const c = clientes.find((x) => x.id === clienteId);
    if (!c) return;
    detNombre.textContent = c.nombre;
    detContacto.textContent = [c.telefono, c.notas].filter(Boolean).join(" · ");
    seleccionarTipo("cargo");
    movMonto.value = "";
    movDetalle.value = "";
    movFecha.value = hoyISO();
    movMsg.textContent = "";
    movMsg.className = "message";
    renderDetalle();
    modalDetalle.classList.add("abierto");
  }
  function cerrarDetalle() { modalDetalle.classList.remove("abierto"); clienteActualId = null; }
  document.getElementById("btnDetCerrar").addEventListener("click", cerrarDetalle);
  modalDetalle.addEventListener("click", (e) => { if (e.target === modalDetalle) cerrarDetalle(); });

  function renderDetalle() {
    const movs = movimientos
      .filter((m) => m.cliente_id === clienteActualId)
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    const saldo = saldos[clienteActualId] || 0;
    const debe = saldo > 0.001;
    detSaldo.textContent = debe ? formatearMoneda(saldo) : "Al día ✅";
    detSaldoBox.className = `cuenta-saldo-box ${debe ? "box-debe" : "box-ok"}`;

    listaMovimientos.innerHTML = "";
    movVacio.hidden = movs.length > 0;
    movs.forEach((m) => {
      const esPago = m.tipo === "pago";
      const div = document.createElement("div");
      div.className = `mov-item ${esPago ? "mov-pago" : "mov-cargo"}`;
      div.innerHTML = `
        <div class="mov-info">
          <div class="mov-tipo">${esPago ? "💵 Pago" : "🛒 Deuda"}${m.detalle ? " · " + escaparHTML(m.detalle) : ""}</div>
          <div class="mov-fecha muted">${m.fecha ? fechaLegible(m.fecha) : "—"}</div>
        </div>
        <div class="mov-monto">${esPago ? "-" : "+"} ${formatearMoneda(Number(m.monto) || 0)}</div>
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

  btnMovGuardar.addEventListener("click", async () => {
    const monto = parsearMonto(movMonto.value);
    if (isNaN(monto) || monto <= 0) {
      movMsg.textContent = "Poné un monto mayor a 0. 💰";
      movMsg.className = "message message-error";
      return;
    }
    btnMovGuardar.disabled = true;
    const txt = btnMovGuardar.textContent;
    btnMovGuardar.textContent = "Guardando...";
    try {
      await agregarMovimiento({
        cliente_id: clienteActualId,
        tipo: tipoMov,
        monto,
        detalle: movDetalle.value,
        fecha: movFecha.value || hoyISO(),
        uid: user.uid,
      });
      movMonto.value = "";
      movDetalle.value = "";
      movMsg.textContent = tipoMov === "pago" ? "✅ Pago registrado." : "✅ Deuda registrada.";
      movMsg.className = "message message-success";
      await cargar();
      renderDetalle();
    } catch (err) {
      movMsg.textContent = "⚠️ Error: " + (err?.code || err?.message || "desconocido");
      movMsg.className = "message message-error";
      console.error("Error guardando movimiento:", err);
    } finally {
      btnMovGuardar.disabled = false;
      btnMovGuardar.textContent = txt;
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
  async function cargar() {
    [clientes, movimientos] = await Promise.all([listarClientes(), listarMovimientos()]);
    saldos = calcularSaldos(movimientos);
    aplicarBusqueda();
  }

  await cargar();
})();
