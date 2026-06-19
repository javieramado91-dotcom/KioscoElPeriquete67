// =============================================================
//  UTILIDADES DE FORMATO
// -------------------------------------------------------------
//  Funciones puras y reutilizables (sin dependencias de Firebase)
//  para formatear fechas y dinero de forma consistente en todo
//  el sistema.
// =============================================================

/**
 * Devuelve la fecha de hoy en formato "YYYY-MM-DD" (horario local).
 */
export function hoyISO() {
  const d = new Date();
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d - offset).toISOString().slice(0, 10);
}

/**
 * Formatea un número como moneda argentina ($ 12.345,67).
 */
export function formatearMoneda(valor) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(Number(valor) || 0);
}

/**
 * Convierte "YYYY-MM-DD" a un texto legible (19/06/2026).
 */
export function fechaLegible(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Devuelve el nombre del mes (0 = Enero).
 */
export function nombreMes(indice) {
  const meses = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  return meses[indice] ?? "";
}
