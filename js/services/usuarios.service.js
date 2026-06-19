// =============================================================
//  SERVICIO DE USUARIOS
// -------------------------------------------------------------
//  Maneja el perfil del usuario almacenado en Firestore
//  (colección `usuarios`), que es DISTINTO de la cuenta de
//  Firebase Authentication.
//
//  - Authentication  -> credenciales (email + password).
//  - Firestore/usuarios -> perfil de negocio (nombre, rol).
//
//  El documento usa como ID el mismo `uid` de Authentication,
//  para poder vincular ambos mundos de forma directa.
// =============================================================

import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase/firebase-config.js";

const COLECCION = "usuarios";

/**
 * Obtiene el perfil (nombre, email, rol) del usuario por su uid.
 * @returns {Promise<object|null>}
 */
export async function obtenerPerfil(uid) {
  const ref = doc(db, COLECCION, uid);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Crea o actualiza el perfil de un usuario.
 * Útil para dar de alta usuarios desde un futuro panel de admin.
 */
export function guardarPerfil(uid, { nombre, email, rol = "usuario" }) {
  const ref = doc(db, COLECCION, uid);
  return setDoc(ref, { nombre, email, rol }, { merge: true });
}

/**
 * Devuelve true si el perfil corresponde a un administrador.
 */
export function esAdmin(perfil) {
  return perfil?.rol === "admin";
}
