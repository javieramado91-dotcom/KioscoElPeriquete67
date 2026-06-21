// =============================================================
//  SERVICIO DE IA (identificar producto por foto)
// -------------------------------------------------------------
//  Manda la foto a NUESTRO mini-servidor en Vercel
//  (/api/identificar-producto), que es quien habla con Gemini.
//  La clave de Gemini vive en el servidor, nunca en el navegador.
// =============================================================

import { fileABase64Redimensionado } from "../utils/imagen.js";

/**
 * Identifica un producto a partir de una foto.
 * @param {File} file  foto sacada con la cámara.
 * @returns {Promise<{nombre:string, marca:string, detalle:string}>}
 */
export async function identificarProductoPorFoto(file) {
  const { base64, mimeType } = await fileABase64Redimensionado(file);

  const r = await fetch("/api/identificar-producto", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imagenBase64: base64, mimeType }),
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(data?.error || "No se pudo identificar el producto.");
  }
  return {
    nombre: data.nombre || "",
    marca: data.marca || "",
    detalle: data.detalle || "",
    perecedero: data.perecedero === true,
    rubro: data.rubro || "Otros",
  };
}

/**
 * Pregunta a la IA si un producto (por su nombre) es perecedero y a qué
 * rubro pertenece. Se usa en cargas manuales o por código de barras.
 * @param {string} texto  nombre + marca + detalle del producto.
 * @returns {Promise<{perecedero:boolean, rubro:string}>}
 */
export async function clasificarProducto(texto) {
  const r = await fetch("/api/clasificar-producto", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texto }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || "No se pudo clasificar el producto.");
  return { perecedero: data.perecedero === true, rubro: data.rubro || "Otros" };
}
