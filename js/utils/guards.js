// =============================================================
//  GUARDAS DE SESIÓN (PROTECCIÓN DE PÁGINAS)
// -------------------------------------------------------------
//  Centraliza la verificación "¿hay un usuario logueado?".
//  Toda página privada (inicio, ganancias, estadísticas) llama
//  a `protegerPagina()` al cargar. Si no hay sesión, redirige
//  al login. Si hay sesión, entrega el usuario + su perfil.
// =============================================================

import { observeAuth } from "../services/auth.service.js";
import { obtenerPerfil } from "../services/usuarios.service.js";

/**
 * Protege una página privada.
 * @returns {Promise<{user: object, perfil: object}>}
 *          Se resuelve solo cuando hay sesión válida.
 *          Si no hay sesión, redirige a la pantalla de login.
 *
 * @param {string} rutaLogin Ruta relativa hacia el login.
 */
export function protegerPagina(rutaLogin = "../index.html") {
  return new Promise((resolve) => {
    observeAuth(async (user) => {
      if (!user) {
        window.location.replace(rutaLogin);
        return;
      }
      // Cargamos el perfil (rol, nombre) desde Firestore.
      const perfil = await obtenerPerfil(user.uid);
      resolve({ user, perfil });
    });
  });
}
