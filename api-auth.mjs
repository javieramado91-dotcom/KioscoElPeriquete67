import { createPublicKey, verify } from "node:crypto";

const PROJECT_ID = "kioscoelperiquete67";
const ISSUER = `https://securetoken.google.com/${PROJECT_ID}`;
const CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

let certificadosCache = null;
let certificadosVencen = 0;

function decodificarJsonBase64Url(valor) {
  return JSON.parse(Buffer.from(valor, "base64url").toString("utf8"));
}

async function obtenerCertificados() {
  if (certificadosCache && Date.now() < certificadosVencen) return certificadosCache;
  const respuesta = await fetch(CERTS_URL);
  if (!respuesta.ok) throw new Error("No se pudieron validar las credenciales.");
  const cacheControl = respuesta.headers.get("cache-control") || "";
  const maxAge = Number(cacheControl.match(/max-age=(\d+)/)?.[1] || 300);
  certificadosCache = await respuesta.json();
  certificadosVencen = Date.now() + Math.max(60, maxAge - 30) * 1000;
  return certificadosCache;
}

async function verificarToken(token) {
  const partes = token.split(".");
  if (partes.length !== 3) throw new Error("Token invalido.");
  const [headerB64, payloadB64, firmaB64] = partes;
  const header = decodificarJsonBase64Url(headerB64);
  const payload = decodificarJsonBase64Url(payloadB64);
  if (header.alg !== "RS256" || !header.kid) throw new Error("Token invalido.");

  const certificado = (await obtenerCertificados())[header.kid];
  if (!certificado) throw new Error("Token desconocido.");
  const firmaValida = verify(
    "RSA-SHA256",
    Buffer.from(`${headerB64}.${payloadB64}`),
    createPublicKey(certificado),
    Buffer.from(firmaB64, "base64url")
  );
  if (!firmaValida) throw new Error("Firma invalida.");

  const ahora = Math.floor(Date.now() / 1000);
  if (payload.aud !== PROJECT_ID || payload.iss !== ISSUER) throw new Error("Token ajeno.");
  if (!payload.sub || payload.sub.length > 128) throw new Error("Usuario invalido.");
  if (!payload.exp || payload.exp <= ahora) throw new Error("Token vencido.");
  if (!payload.iat || payload.iat > ahora + 60) throw new Error("Token invalido.");
  if (payload.auth_time && payload.auth_time > ahora + 60) throw new Error("Token invalido.");
  return payload;
}

async function obtenerPerfilAutorizado(uid, token) {
  const url =
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}`
    + `/databases/(default)/documents/usuarios/${encodeURIComponent(uid)}`;
  const respuesta = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!respuesta.ok) throw new Error("Perfil no autorizado.");
  const documento = await respuesta.json();
  const rol = documento?.fields?.rol?.stringValue;
  if (rol !== "admin" && rol !== "usuario") throw new Error("Perfil no autorizado.");
  return { uid, rol };
}

export async function exigirUsuarioAutorizado(req, res) {
  try {
    const authorization = req.headers.authorization || "";
    const token = authorization.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : "";
    if (!token) throw new Error("Falta autenticacion.");
    const payload = await verificarToken(token);
    return await obtenerPerfilAutorizado(payload.sub, token);
  } catch (_) {
    res.status(401).json({ error: "Inicia sesion nuevamente para usar la IA." });
    return null;
  }
}

export function cuerpoDemasiadoGrande(req, maxBytes) {
  return Number(req.headers["content-length"] || 0) > maxBytes;
}
