// =============================================================
//  CONTROLADOR DE LOGIN
// -------------------------------------------------------------
//  Maneja el formulario de inicio de sesión de index.html.
//  Si el usuario YA tiene sesión activa, lo manda directo al
//  inicio sin pedirle credenciales de nuevo.
// =============================================================

import { login, observeAuth, traducirErrorAuth } from "./services/auth.service.js";

const form = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passInput = document.getElementById("password");
const errorBox = document.getElementById("loginError");
const btn = document.getElementById("btnLogin");

// Si ya hay sesión iniciada, saltamos directo al panel.
observeAuth((user) => {
  if (user) window.location.replace("pages/inicio.html");
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorBox.textContent = "";
  btn.disabled = true;
  btn.textContent = "Ingresando...";

  try {
    await login(emailInput.value.trim(), passInput.value);
    // El observeAuth de arriba se encarga de la redirección.
  } catch (err) {
    errorBox.textContent = traducirErrorAuth(err.code);
    btn.disabled = false;
    btn.textContent = "Ingresar";
  }
});
