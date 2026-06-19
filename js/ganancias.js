// =============================================================
//  CONTROLADOR DEL MÓDULO "INGRESAR GANANCIAS"
// -------------------------------------------------------------
//  Formulario para registrar el dinero ingresado en un día.
//  Valida, evita duplicados por fecha y muestra mensajes claros.
// =============================================================

import { protegerPagina } from "./utils/guards.js";
import { montarLayout } from "./components/navbar.js";
import { registrarGanancia } from "./services/ganancias.service.js";
import { hoyISO, formatearMoneda } from "./utils/format.js";

(async function init() {
  const { user, perfil } = await protegerPagina();

  const contenido = document.createElement("div");
  contenido.innerHTML = `
    <header class="page-header">
      <h1>Ingresar ganancia diaria</h1>
      <p class="muted">Registrá cuánto ingresó la despensa en el día.</p>
    </header>

    <section class="form-card">
      <form id="formGanancia" novalidate>
        <div class="form-row">
          <label for="fecha">Fecha</label>
          <input type="date" id="fecha" required />
        </div>

        <div class="form-row">
          <label for="monto">Monto total del día</label>
          <input type="number" id="monto" min="0" step="0.01"
                 placeholder="0.00" required />
          <small class="hint" id="montoPreview"></small>
        </div>

        <div class="form-row">
          <label for="observacion">Observación (opcional)</label>
          <textarea id="observacion" rows="3"
                    placeholder="Ej: día de lluvia, feriado, etc."></textarea>
        </div>

        <div id="msg" class="message"></div>

        <button type="submit" class="btn btn-primary btn-block" id="btnGuardar">
          Guardar ganancia
        </button>
      </form>
    </section>
  `;

  montarLayout({ activo: "ganancias", perfil, contenido });

  // --- Referencias ---
  const form = document.getElementById("formGanancia");
  const fecha = document.getElementById("fecha");
  const monto = document.getElementById("monto");
  const observacion = document.getElementById("observacion");
  const msg = document.getElementById("msg");
  const preview = document.getElementById("montoPreview");
  const btn = document.getElementById("btnGuardar");

  // Fecha de hoy por defecto.
  fecha.value = hoyISO();
  fecha.max = hoyISO(); // no permitir fechas futuras

  // Vista previa del monto formateado.
  monto.addEventListener("input", () => {
    preview.textContent = monto.value ? formatearMoneda(monto.value) : "";
  });

  function mostrarMensaje(texto, tipo) {
    msg.textContent = texto;
    msg.className = `message message-${tipo}`;
  }

  // --- Envío del formulario ---
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    mostrarMensaje("", "");

    const valor = Number(monto.value);
    if (!fecha.value) return mostrarMensaje("Elegí una fecha.", "error");
    if (!valor || valor <= 0)
      return mostrarMensaje("Ingresá un monto válido mayor a 0.", "error");

    btn.disabled = true;
    btn.textContent = "Guardando...";

    try {
      await registrarGanancia({
        fecha: fecha.value,
        monto: valor,
        observacion: observacion.value,
        uid: user.uid,
      });
      mostrarMensaje(
        `✅ Ganancia de ${formatearMoneda(valor)} guardada para el ${fecha.value}.`,
        "success"
      );
      form.reset();
      fecha.value = hoyISO();
      preview.textContent = "";
    } catch (err) {
      // Incluye el caso de fecha duplicada.
      mostrarMensaje("⚠️ " + err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Guardar ganancia";
    }
  });
})();
