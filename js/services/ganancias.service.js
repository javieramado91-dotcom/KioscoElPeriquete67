// =============================================================
//  SERVICIO DE GANANCIAS
// -------------------------------------------------------------
//  CRUD de la colección `ganancias`.
//
//  DECISIÓN DE DISEÑO IMPORTANTE:
//  El ID de cada documento es la propia fecha ("YYYY-MM-DD").
//  Esto hace que sea IMPOSIBLE cargar dos ganancias para el
//  mismo día (la unicidad la garantiza la base de datos, no
//  solo el código), cumpliendo el requisito de "no duplicar".
// =============================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebase-config.js";

const COLECCION = "ganancias";

/**
 * Indica si ya existe una ganancia cargada para esa fecha.
 */
export async function existeGanancia(fecha) {
  const snap = await getDoc(doc(db, COLECCION, fecha));
  return snap.exists();
}

/**
 * Registra una nueva ganancia diaria.
 * Lanza un Error si ya existe un registro para esa fecha.
 *
 * @param {object} datos
 * @param {string} datos.fecha        "YYYY-MM-DD"
 * @param {number} datos.monto        Monto total del día
 * @param {string} datos.observacion  Texto opcional
 * @param {string} datos.uid          uid del usuario que carga
 */
export async function registrarGanancia({ fecha, monto, observacion, uid }) {
  if (await existeGanancia(fecha)) {
    throw new Error(`Ya existe una ganancia registrada para el ${fecha}.`);
  }

  const ref = doc(db, COLECCION, fecha);
  await setDoc(ref, {
    fecha,
    monto: Number(monto),
    observacion: observacion?.trim() || "",
    creado_por: uid,
    fecha_creacion: serverTimestamp(),
  });
}

/**
 * Devuelve todas las ganancias ordenadas por fecha descendente.
 * @returns {Promise<Array>}
 */
export async function listarGanancias() {
  const q = query(collection(db, COLECCION), orderBy("fecha", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Elimina una ganancia por su fecha (solo admin, según las reglas).
 */
export function eliminarGanancia(fecha) {
  return deleteDoc(doc(db, COLECCION, fecha));
}
