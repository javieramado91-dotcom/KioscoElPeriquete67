// =============================================================
//  FERIADOS NACIONALES DE ARGENTINA (aproximado)
// -------------------------------------------------------------
//  Sirve para pintar en las estadísticas qué días son feriado,
//  fin de semana o día de semana común.
//
//  Incluye:
//   - Feriados inamovibles (fecha fija todos los años).
//   - Feriados que dependen de Pascua (Carnaval y Semana Santa),
//     calculados con la fórmula de Pascua (computus).
//
//  NO incluye (cambian por decreto cada año, imposible calcularlos):
//   - Los "feriados con fines turísticos" (los puentes).
//   - El traslado de algunos feriados trasladables a otro día.
//  Igual alcanza de sobra para ver el comportamiento del mes.
// =============================================================

// Feriados de fecha fija: "MM-DD" -> nombre corto.
const FIJOS = {
  "01-01": "Año Nuevo",
  "03-24": "Memoria por la Verdad y la Justicia",
  "04-02": "Malvinas",
  "05-01": "Día del Trabajador",
  "05-25": "Revolución de Mayo",
  "06-20": "Paso a la Inmortalidad de Belgrano",
  "07-09": "Día de la Independencia",
  "08-17": "Paso a la Inmortalidad de San Martín",
  "10-12": "Diversidad Cultural",
  "11-20": "Soberanía Nacional",
  "12-08": "Inmaculada Concepción",
  "12-25": "Navidad",
};

// Domingo de Pascua para un año dado (algoritmo de Meeus/Gauss, gregoriano).
function domingoDePascua(anio) {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31); // 3 = marzo, 4 = abril
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(anio, mes - 1, dia);
}

// "YYYY-MM-DD" a partir de un objeto Date (horario local).
function iso(fecha) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Devuelve un Map con los feriados de un año: fecha "YYYY-MM-DD" -> nombre.
 */
export function feriadosDelAnio(anio) {
  const mapa = new Map();

  // Fijos.
  for (const [md, nombre] of Object.entries(FIJOS)) {
    mapa.set(`${anio}-${md}`, nombre);
  }

  // Dependientes de Pascua.
  const pascua = domingoDePascua(anio);
  const relativo = (offsetDias, nombre) => {
    const f = new Date(pascua);
    f.setDate(f.getDate() + offsetDias);
    mapa.set(iso(f), nombre);
  };
  relativo(-48, "Carnaval (lunes)");
  relativo(-47, "Carnaval (martes)");
  relativo(-3, "Jueves Santo");
  relativo(-2, "Viernes Santo");

  return mapa;
}

/**
 * Clasifica una fecha "YYYY-MM-DD":
 *   "feriado" | "finde" (sábado/domingo) | "semana" (día común).
 * `feriados` es el Map que devuelve feriadosDelAnio().
 */
export function tipoDeDia(isoFecha, feriados) {
  if (feriados && feriados.has(isoFecha)) return "feriado";
  const [y, m, d] = isoFecha.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay(); // 0 = domingo ... 6 = sábado
  return dow === 0 || dow === 6 ? "finde" : "semana";
}
