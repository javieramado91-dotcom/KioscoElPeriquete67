// =============================================================
//  UTILIDADES DE VENCIMIENTOS
// -------------------------------------------------------------
//  Funciones para calcular cuántos días faltan para que un
//  producto venza y en qué "estado" está (vencido, pronto, etc).
//  Lo usan la pantalla de Vencimientos y los avisos del inicio.
// =============================================================

import { hoyISO } from "./format.js";

/**
 * Días que faltan para la fecha (negativo = ya venció, 0 = hoy).
 */
export function diasHastaVencer(fechaISO) {
  if (!fechaISO) return null;
  const hoy = new Date(hoyISO() + "T00:00:00");
  const f = new Date(fechaISO + "T00:00:00");
  return Math.round((f - hoy) / 86400000);
}

/**
 * Devuelve el estado de vencimiento de un producto.
 * @returns {{dias:number|null, clave:string, label:string, emoji:string}}
 *   clave: "sinfecha" | "vencido" | "pronto" | "proximo" | "ok"
 */
export function estadoVencimiento(fechaISO) {
  const dias = diasHastaVencer(fechaISO);

  if (dias === null) return { dias, clave: "sinfecha", label: "Sin fecha", emoji: "⚪" };
  if (dias < 0) return { dias, clave: "vencido", label: "Vencido", emoji: "🔴" };
  if (dias <= 7) return { dias, clave: "pronto", label: "Vence pronto", emoji: "🟠" };
  if (dias <= 30) return { dias, clave: "proximo", label: "Próximo", emoji: "🟡" };
  return { dias, clave: "ok", label: "En fecha", emoji: "🟢" };
}

/**
 * Texto amigable de cuántos días faltan o hace cuánto venció.
 */
export function textoDias(dias) {
  if (dias === null) return "sin fecha";
  if (dias < 0) return `venció hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? "" : "s"}`;
  if (dias === 0) return "vence hoy";
  if (dias === 1) return "vence mañana";
  return `vence en ${dias} días`;
}

/**
 * Filtra los productos perecederos que están vencidos o por vencer
 * dentro de `limiteDias` (default 7). Ordenados por urgencia.
 */
export function productosPorVencer(productos, limiteDias = 7) {
  return productos
    .filter((p) => p.fecha_vencimiento && p.tipo_vencimiento !== "sin_control")
    .map((p) => ({ ...p, _dias: diasHastaVencer(p.fecha_vencimiento) }))
    .filter((p) => p._dias !== null && p._dias <= limiteDias)
    .sort((a, b) => a._dias - b._dias);
}
