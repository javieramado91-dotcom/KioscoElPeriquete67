// =============================================================
//  COMPONENTE ESCÁNER DE CÓDIGO DE BARRAS
// -------------------------------------------------------------
//  Abre una ventana con la cámara para leer códigos de barras.
//  Usa la librería html5-qrcode (cargada por CDN en la página,
//  variable global `Html5Qrcode`).
//
//  Uso:
//    const codigo = await escanearCodigo();  // string o null
// =============================================================

/**
 * Abre el escáner. Resuelve con el código leído, o null si se
 * cancela o falla la cámara.
 * @returns {Promise<string|null>}
 */
export function escanearCodigo() {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "scanner-overlay";
    overlay.innerHTML = `
      <div class="scanner-box">
        <div class="scanner-header">
          <span>📷 Apuntá al código de barras</span>
          <button class="scanner-close" id="scannerClose" aria-label="Cerrar">✕</button>
        </div>
        <div id="scannerView" class="scanner-view"></div>
        <div class="scanner-hint">Acercá el código hasta que se reconozca solo.</div>
      </div>`;
    document.body.appendChild(overlay);

    // Formatos de código de barras más comunes en productos.
    const F = window.Html5QrcodeSupportedFormats || {};
    const formatos = [
      F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.CODE_39,
    ].filter((x) => x !== undefined);

    const lector = new Html5Qrcode("scannerView", { formatsToSupport: formatos });
    let cerrado = false;

    const cerrar = async (codigo) => {
      if (cerrado) return;
      cerrado = true;
      try { await lector.stop(); } catch (_) {}
      overlay.remove();
      resolve(codigo);
    };

    document.getElementById("scannerClose").addEventListener("click", () => cerrar(null));

    lector
      .start(
        { facingMode: "environment" }, // cámara trasera
        { fps: 10, qrbox: { width: 260, height: 160 } },
        (texto) => cerrar(texto),
        () => {} // ignoramos los "no encontrado" de cada cuadro
      )
      .catch(() => {
        overlay.remove();
        alert("No se pudo abrir la cámara. Revisá que le hayas dado permiso.");
        resolve(null);
      });
  });
}
