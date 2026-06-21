// =============================================================
//  SERVICIO DE CATÁLOGO (código de barras → datos del producto)
// -------------------------------------------------------------
//  Usa Open Food Facts, una base de datos mundial GRATUITA de
//  productos. Con el código de barras de muchos productos
//  envasados, ya devuelve nombre y marca sin costo ni clave.
//  Si el producto no está, devuelve null y se carga a mano.
// =============================================================

const URL_BASE = "https://world.openfoodfacts.org/api/v0/product/";

/**
 * Busca un producto por su código de barras.
 * @returns {Promise<{nombre:string, marca:string, detalle:string}|null>}
 */
export async function buscarPorCodigoBarras(codigo) {
  try {
    const r = await fetch(`${URL_BASE}${encodeURIComponent(codigo)}.json`);
    const data = await r.json();
    if (data.status !== 1 || !data.product) return null;

    const p = data.product;
    return {
      nombre: p.product_name_es || p.product_name || "",
      marca: (p.brands || "").split(",")[0].trim(),
      detalle: p.quantity || "",
    };
  } catch {
    return null; // sin internet o producto no encontrado: se carga a mano
  }
}
