export const TIPOS_VENCIMIENTO = Object.freeze({
  PERECEDERO: "perecedero",
  LARGA_DURACION: "larga_duracion",
  SIN_CONTROL: "sin_control",
});

export const OPCIONES_VENCIMIENTO = Object.freeze([
  {
    valor: TIPOS_VENCIMIENTO.PERECEDERO,
    etiqueta: "Perecedero - fecha obligatoria",
  },
  {
    valor: TIPOS_VENCIMIENTO.LARGA_DURACION,
    etiqueta: "Envasado - fecha recomendada",
  },
  {
    valor: TIPOS_VENCIMIENTO.SIN_CONTROL,
    etiqueta: "Sin control de vencimiento",
  },
]);

export function tipoValido(tipo) {
  return OPCIONES_VENCIMIENTO.some((opcion) => opcion.valor === tipo);
}

export function normalizarClasificacion(resultado = {}) {
  const tipo = tipoValido(resultado.tipo_vencimiento)
    ? resultado.tipo_vencimiento
    : resultado.perecedero
      ? TIPOS_VENCIMIENTO.PERECEDERO
      : TIPOS_VENCIMIENTO.LARGA_DURACION;

  return {
    rubro: resultado.rubro || "Otros",
    tipo_vencimiento: tipo,
    requiere_fecha: tipo === TIPOS_VENCIMIENTO.PERECEDERO,
    confianza: Math.max(0, Math.min(100, Number(resultado.confianza) || 0)),
    razon: String(resultado.razon || "").trim(),
    origen: resultado.origen || "manual",
  };
}

export function textoTipoVencimiento(tipo) {
  return OPCIONES_VENCIMIENTO.find((opcion) => opcion.valor === tipo)?.etiqueta
    || "Sin clasificar";
}
