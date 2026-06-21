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
 * Agrega un producto nuevo.
 */
export function agregarProducto({ nombre, marca, detalle, precio, codigo_barras, uid }) {
  return addDoc(collection(db, COL), {
    nombre: (nombre || "").trim(),
    marca: (marca || "").trim(),
    detalle: (detalle || "").trim(),
    precio: Number(precio),
    codigo_barras: (codigo_barras || "").trim(),
    creado_por: uid,
    fecha_creacion: serverTimestamp(),
  });
}

/**
 * Actualiza campos de un producto (ej: el precio).
 */
export function actualizarProducto(id, cambios) {
  return updateDoc(doc(db, COL, id), cambios);
}

/**
 * Elimina un producto (solo admin, según las reglas).
 */
export function eliminarProducto(id) {
  return deleteDoc(doc(db, COL, id));
}

/**
 * Filtra una lista de productos por texto (nombre, marca o detalle).
 */
export function filtrarPorTexto(productos, texto) {
  const t = (texto || "").trim().toLowerCase();
  if (!t) return productos;
  return productos.filter((p) =>
    [p.nombre, p.marca, p.detalle]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(t)
  );
}

/**
 * Busca un producto por código de barras dentro de una lista.
 */
export function buscarEnListaPorCodigo(productos, codigo) {
  const c = (codigo || "").trim();
  return productos.filter((p) => p.codigo_barras && p.codigo_barras === c);
}
