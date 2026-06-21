// =============================================================
//  SERVICIO DE IA (identificar producto por foto)
// -------------------------------------------------------------
//  Manda la foto a NUESTRO mini-servidor en Vercel
//  (/api/identificar-producto), que es quien habla con Gemini.
//  La clave de Gemini vive en el servidor, nunca en el navegador.
// =============================================================

import { fileABase64Redimensionado } from "../utils/imagen.js";
import { obtenerTokenActual } from "./auth.service.js";

async function llamarApiPrivada(url, body) {
  const token = await obtenerTokenActual();
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401 || r.status === 403) {
      throw new Error("Tu sesion no esta autorizada para usar la IA.");
    }
    throw new Error(data?.error || "No se pudo analizar el producto.");
  }
  return data;
}

/**
 * Identifica un producto a partir de una foto.
 * @param {File} file  foto sacada con la cámara.
 * @returns {Promise<{nombre:string, marca:string, detalle:string}>}
 */
export async function identificarProductoPorFoto(file) {
  const { base64, mimeType } = await fileABase64Redimensionado(file);

  const data = await llamarApiPrivada("/api/identificar-producto", {
    imagenBase64: base64,
    mimeType,
  });
  return {
    nombre: data.nombre || "",
    marca: data.marca || "",
    detalle: data.detalle || "",
    tipo_vencimiento: data.tipo_vencimiento || "larga_duracion",
    requiere_fecha: data.requiere_fecha === true,
    rubro: data.rubro || "Otros",
    confianza: Number(data.confianza) || 0,
    razon: data.razon || "",
    origen: "ia_foto",
  };
}

/**
 * Pregunta a la IA si un producto (por su nombre) es perecedero y a qué
 * rubro pertenece. Se usa en cargas manuales o por código de barras.
 * @param {string} texto  nombre + marca + detalle del producto.
 * @returns {Promise<{perecedero:boolean, rubro:string}>}
 */
export async function clasificarProducto(texto) {
  const data = await llamarApiPrivada("/api/clasificar-producto", { texto });
  return {
    tipo_vencimiento: data.tipo_vencimiento || "larga_duracion",
    requiere_fecha: data.requiere_fecha === true,
    rubro: data.rubro || "Otros",
    confianza: Number(data.confianza) || 0,
    razon: data.razon || "",
    origen: "ia_texto",
  };
}
