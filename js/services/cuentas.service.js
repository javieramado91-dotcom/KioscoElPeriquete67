// =============================================================
//  SERVICIO DE CUENTAS CORRIENTES (fiado)
// -------------------------------------------------------------
//  Dos colecciones:
//   - `clientes`: la persona que tiene cuenta (nombre, teléfono…).
//   - `movimientos`: cada deuda (cargo) o pago de un cliente.
//
//  El SALDO de un cliente = suma de cargos - suma de pagos.
//  Si el saldo es positivo, el cliente DEBE esa plata.
//
//  Como una despensa maneja pocos clientes, traemos todo y
//  calculamos los saldos en el navegador (simple y sin índices).
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
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebase-config.js";

const COL_CLIENTES = "clientes";
const COL_MOV = "movimientos";

// ---------------- Clientes ----------------
export async function listarClientes() {
  const q = query(collection(db, COL_CLIENTES), orderBy("nombre"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function agregarCliente({ nombre, telefono, notas, uid }) {
  return addDoc(collection(db, COL_CLIENTES), {
    nombre: (nombre || "").trim(),
    telefono: (telefono || "").trim(),
    notas: (notas || "").trim(),
    creado_por: uid,
    fecha_creacion: serverTimestamp(),
  });
}

export function actualizarCliente(id, cambios) {
  return updateDoc(doc(db, COL_CLIENTES, id), cambios);
}

export function eliminarCliente(id) {
  return deleteDoc(doc(db, COL_CLIENTES, id));
}

// ---------------- Movimientos ----------------
export async function listarMovimientos() {
  const snap = await getDocs(collection(db, COL_MOV));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listarMovimientosDeCliente(clienteId) {
  const q = query(collection(db, COL_MOV), where("cliente_id", "==", clienteId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1)); // más reciente primero
}

export function agregarMovimiento({ cliente_id, tipo, monto, detalle, fecha, uid }) {
  return addDoc(collection(db, COL_MOV), {
    cliente_id,
    tipo: tipo === "pago" ? "pago" : "cargo",
    monto: Math.max(0, Number(monto) || 0),
    detalle: (detalle || "").trim(),
    fecha: (fecha || "").trim(),
    creado_por: uid,
    fecha_creacion: serverTimestamp(),
  });
}

export function eliminarMovimiento(id) {
  return deleteDoc(doc(db, COL_MOV, id));
}

// ---------------- Cálculo de saldos ----------------
/**
 * Devuelve un mapa { cliente_id: saldo } a partir de los movimientos.
 * saldo > 0 => el cliente debe esa plata.
 */
export function calcularSaldos(movimientos) {
  const saldos = {};
  movimientos.forEach((m) => {
    const signo = m.tipo === "pago" ? -1 : 1;
    saldos[m.cliente_id] = (saldos[m.cliente_id] || 0) + signo * (Number(m.monto) || 0);
  });
  return saldos;
}
