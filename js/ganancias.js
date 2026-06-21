// =============================================================
//  CONTROLADOR DEL MÓDULO "INGRESAR GANANCIAS"
// -------------------------------------------------------------
//  Pensado para una persona poco tecnológica:
//   - Lenguaje claro y preguntas simples ("¿Cuánto entró hoy?").
//   - Número grande y teclado numérico automático en el celular.
//   - Vista previa del monto formateado (para que vea bien la plata).
//   - Al guardar, una confirmación grande y clara.
// =============================================================

import { protegerPagina } from "./utils/guards.js";
import { montarLayout } from "./components/navbar.js";
import { registrarGanancia } from "./services/ganancias.service.js";
import { hoyISO, formatearMoneda, fechaFriendly, parsearMonto } from "./utils/format.js";

(async function init() {
  const { user, perfil } = await protegerPagina();

  const contenido = document.createElement("div");
  contenido.innerHTML = `
    <header class="page-header">
      <h1>💵 Cargar la ganancia del día</h1>
      <p class="muted">Anotá cuánta plata entró. Es muy fácil. 👇</p>
    </header>

    <section class="form-card form-amable">
      <form id="formGanancia" novalidate>

        <!-- FECHA -->
        <div class="field-block">
          <label for="fecha">📅 ¿De qué día?</label>
          <input type="date" id="fecha" required />
          <div class="fecha-texto" id="fechaTexto"></div>
        </div>

        <!-- MONTO -->
        <div class="field-block">
          <label for="monto">💰 ¿Cuánto entró?</label>
          <div class="money-input" id="moneyBox">
            <span class="money-symbol">$</span>
            <input type="text" id="monto" inputmode="decimal"
                   placeholder="0" autocomplete="off" />
          </div>
          <div class="money-preview" id="montoPreview"></div>
        </div>

        <!-- OBSERVACIÓN -->
        <div class="field-block">
          <label for="observacion">📝 ¿Querés anotar algo? <span class="opcional">(opcional)</span></label>
          <textarea id="observacion" rows="2" maxlength="500"
                    placeholder="Ej: día tranquilo, mucha venta..."></textarea>
        </div>

        <div id="msg" class="message"></div>

        <button type="submit" class="btn btn-primary btn-grande" id="btnGuardar">
          ✅ Guardar
        </button>
      </form>

      <!-- Panel de éxito (oculto hasta guardar) -->
      <div class="success-panel" id="successPanel" hidden>
        <div class="success-check">🎉</div>
        <h2>¡Guardado!</h2>
        <p class="success-detalle" id="successDetalle"></p>
        <button class="btn btn-primary btn-grande" id="btnOtro">Cargar otro día</button>
      </div>
    </section>
  `;

  montarLayout({ activo: "ganancias", perfil, contenido });

  // --- Referencias ---
  const form = document.getElementById("formGanancia");
  const fecha = document.getElementById("fecha");
  const fechaTexto = document.getElementById("fechaTexto");
  const monto = document.getElementById("monto");
  const moneyBox = document.getElementById("moneyBox");
  const observacion = document.getElementById("observacion");
  const msg = document.getElementById("msg");
  const preview = document.getElementById("montoPreview");
  const btn = document.getElementById("btnGuardar");
  const successPanel = document.getElementById("successPanel");
  const successDetalle = document.getElementById("successDetalle");
  const btnOtro = document.getElementById("btnOtro");

  // Fecha de hoy por defecto y no permitir fechas futuras.
  fecha.value = hoyISO();
  fecha.max = hoyISO();

  function actualizarFechaTexto() {
    fechaTexto.textContent = fechaFriendly(fecha.value);
  }
  actualizarFechaTexto();
  fecha.addEventListener("change", actualizarFechaTexto);

  // Vista previa grande del monto mientras escribe.
  monto.addEventListener("input", () => {
    const n = parsearMonto(monto.value);
    preview.textContent =
      monto.value && !isNaN(n) ? "Vas a guardar: " + formatearMoneda(n) : "";
  });
  // Resaltar el recuadro del monto al enfocarlo.
  monto.addEventListener("focus", () => moneyBox.classList.add("focus"));
  monto.addEventListener("blur", () => moneyBox.classList.remove("focus"));

  function mostrarMensaje(texto, tipo) {
    msg.textContent = texto;
    msg.className = `message message-${tipo}`;
  }

  // --- Guardar ---
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    mostrarMensaje("", "");

    const valor = parsearMonto(monto.value);
    if (!fecha.value) return mostrarMensaje("Primero elegí el día. 📅", "error");
    if (isNaN(valor) || valor <= 0)
      return mostrarMensaje("Escribí cuánta plata entró (un número mayor a 0). 💰", "error");

    btn.disabled = true;
    btn.textContent = "Guardando...";

    try {
      await registrarGanancia({
        fecha: fecha.value,
        monto: valor,
        observacion: observacion.value,
        uid: user.uid,
      });

      // Mostramos la pantalla de éxito grande y clara.
      successDetalle.innerHTML =
        `Anotaste <strong>${formatearMoneda(valor)}</strong><br>del ${fechaFriendly(fecha.value)}.`;
      form.hidden = true;
      successPanel.hidden = false;
    } catch (err) {
      // Caso típico: ya existe una ganancia para ese día.
      mostrarMensaje("⚠️ " + err.message, "error");
      btn.disabled = false;
      btn.textContent = "✅ Guardar";
    }
  });

  // --- "Cargar otro día": volver al formulario limpio ---
  btnOtro.addEventListener("click", () => {
    form.reset();
    fecha.value = hoyISO();
    fecha.max = hoyISO();
    actualizarFechaTexto();
    preview.textContent = "";
    mostrarMensaje("", "");
    btn.disabled = false;
    btn.textContent = "✅ Guardar";
    successPanel.hidden = true;
    form.hidden = false;
    monto.focus();
  });
})();
