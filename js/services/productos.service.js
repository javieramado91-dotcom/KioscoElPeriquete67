// =============================================================
//  SERVICIO DE PRODUCTOS
// -------------------------------------------------------------
//  CRUD de la colección `productos`.
//
//  Como una despensa maneja una cantidad acotada de productos,
//  para buscar traemos toda la lista una vez y filtramos en el
//  navegador (rápido y simple, sin índices complejos).
// =============================================================

import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  deleteField,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebase-config.js";

const COL = "productos";

/**
 * Trae todos los productos ordenados por nombre.
 */
export async function listarProductos() {
  const q = query(collection(db, COL), orderBy("nombre"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Agrega un producto nuevo (carga 100% manual, basada en el código de barras
 * cuando el producto lo tiene). Guarda toda la info para el control de stock.
 */
export function agregarProducto({
  nombre,
  marca,
  detalle,
  precio,
  cantidad,
  codigo_barras,
  rubro,
  tiene_vencimiento,
  fecha_vencimiento,
  uid,
}) {
  return addDoc(collection(db, COL), {
    nombre: (nombre || "").trim(),
    marca: (marca || "").trim(),
    detalle: (detalle || "").trim(),
    precio: Number(precio) || 0,
    cantidad: Math.max(0, Math.round(Number(cantidad) || 0)),
    codigo_barras: (codigo_barras || "").trim(),
    rubro: (rubro || "Otros").trim(),
    tiene_vencimiento: !!tiene_vencimiento,
    fecha_vencimiento: tiene_vencimiento ? (fecha_vencimiento || "").trim() : "",
    creado_por: uid,
    fecha_creacion: serverTimestamp(),
  });
}

/**
 * Actualiza campos de un producto. De paso limpia los campos del modelo
 * viejo (perecedero, tipo_vencimiento, clasificacion_*) si el producto los
 * tuviera, para que quede consistente con el modelo actual.
 */
export function actualizarProducto(id, cambios) {
  return updateDoc(doc(db, COL, id), {
    ...cambios,
    perecedero: deleteField(),
    tipo_vencimiento: deleteField(),
    clasificacion_origen: deleteField(),
    clasificacion_confianza: deleteField(),
    clasificacion_razon: deleteField(),
  });
}

/**
 * Elimina un producto (solo admin, según las reglas).
 */
export function eliminarProducto(id) {
  return deleteDoc(doc(db, COL, id));
}

export function filtrarPorTexto(productos, texto) {
  const t = (texto || "").trim().toLowerCase();
  if (!t) return productos;
  const palabras = t.split(/\s+/);
  return productos.filter((p) => {
    const textoProducto = [p.nombre, p.marca, p.detalle]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return palabras.every((palabra) => textoProducto.includes(palabra));
  });
}

/**
 * Filtra una lista de productos por rubro ("todos" = sin filtro).
 */
export function filtrarPorRubro(productos, rubro) {
  if (!rubro || rubro === "todos") return productos;
  return productos.filter((p) => (p.rubro || "Otros") === rubro);
}

/**
 * Busca un producto por código de barras dentro de una lista.
 */
export function buscarEnListaPorCodigo(productos, codigo) {
  const c = (codigo || "").trim();
  return productos.filter((p) => p.codigo_barras && p.codigo_barras === c);
}
