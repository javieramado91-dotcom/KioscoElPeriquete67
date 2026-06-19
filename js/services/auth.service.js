// =============================================================
//  SERVICIO DE AUTENTICACIÓN
// -------------------------------------------------------------
//  Encapsula TODA la lógica de Firebase Authentication.
//  Las pantallas nunca llaman a Firebase Auth directamente:
//  siempre pasan por estas funciones. Así, si mañana cambia
//  el proveedor de auth, solo se toca este archivo.
// =============================================================

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "../firebase/firebase-config.js";

/**
 * Inicia sesión con email y contraseña.
 * @returns {Promise<import("firebase/auth").UserCredential>}
 */
export function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

/**
 * Cierra la sesión actual.
 */
export function logout() {
  return signOut(auth);
}

/**
 * Observa el estado de autenticación.
 * Ejecuta `callback(user)` cada vez que el usuario entra o sale.
 * `user` es `null` cuando no hay sesión.
 */
export function observeAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Devuelve el usuario actualmente autenticado (o null).
 */
export function getCurrentUser() {
  return auth.currentUser;
}

/**
 * Traduce los códigos de error de Firebase a mensajes en español.
 */
export function traducirErrorAuth(code) {
  const mensajes = {
    "auth/invalid-email": "El correo no tiene un formato válido.",
    "auth/user-disabled": "Este usuario fue deshabilitado.",
    "auth/user-not-found": "No existe una cuenta con ese correo.",
    "auth/wrong-password": "La contraseña es incorrecta.",
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/too-many-requests": "Demasiados intentos. Probá más tarde.",
  };
  return mensajes[code] || "Ocurrió un error al iniciar sesión.";
}
