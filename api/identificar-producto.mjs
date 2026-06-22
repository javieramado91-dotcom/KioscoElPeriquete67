import { cuerpoDemasiadoGrande, exigirUsuarioAutorizado } from "../api-auth.mjs";

const MODELOS = [
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash-lite",
];
const TIPOS = ["perecedero", "larga_duracion", "sin_control"];
const RUBROS = [
  "Lácteos", "Fiambres y quesos", "Carnes", "Frutas y verduras", "Panadería",
  "Almacén", "Bebidas", "Bebidas alcohólicas", "Golosinas y snacks", "Galletitas",
  "Congelados", "Limpieza", "Perfumería e higiene", "Kiosco", "Otros",
];

const PROMPT = `Sos un asistente de una despensa en Argentina.
Mirá la foto e identificá el producto. Respondé SOLO JSON con estas claves:
- "nombre": nombre genérico verificable del producto.
- "marca": marca visible o cadena vacía.
- "detalle": tamaño, peso o variedad visible o cadena vacía.
- "tipo_vencimiento": exactamente "perecedero" para alimentos frescos o refrigerados
  con vencimiento cercano; "larga_duracion" para productos envasados que vencen pero
  suelen durar meses; "sin_control" para artículos no alimenticios cuya fecha no se controla.
- "rubro": exactamente uno de: ${RUBROS.join(", ")}.
- "confianza": entero de 0 a 100.
- "razon": explicación breve y simple del tipo de vencimiento.
No inventes datos que no sean visibles. Si no podés identificarlo, devolvé campos vacíos,
rubro "Otros", tipo_vencimiento "larga_duracion" y confianza 0.`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido." });
  }
  const usuario = await exigirUsuarioAutorizado(req, res);
  if (!usuario) return;
  if (cuerpoDemasiadoGrande(req, 6_000_000)) {
    return res.status(413).json({ error: "La foto es demasiado grande." });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "La IA no está configurada." });

  try {
    const { imagenBase64, mimeType } = req.body || {};
    if (!imagenBase64 || typeof imagenBase64 !== "string") {
      return res.status(400).json({ error: "No llegó la imagen." });
    }
    if (imagenBase64.length > 5_500_000) {
      return res.status(413).json({ error: "La foto es demasiado grande." });
    }
    const mimePermitidos = ["image/jpeg", "image/png", "image/webp"];
    if (mimeType && !mimePermitidos.includes(mimeType)) {
      return res.status(400).json({ error: "El formato de la foto no es válido." });
    }

    const cuerpo = {
      contents: [{ parts: [
        { text: PROMPT },
        { inline_data: { mime_type: mimeType || "image/jpeg", data: imagenBase64 } },
      ] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
    };
    let data;
    let ok = false;
    for (const modelo of MODELOS) {
      try {
        const url =
          `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;
        const respuesta = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cuerpo),
        });
        const d = await respuesta.json();
        if (respuesta.ok) { data = d; ok = true; break; }
      } catch (_) { /* modelo falló, probar el siguiente */ }
    }
    if (!ok) {
      return res.status(502).json({
        error: "La IA no pudo procesar la foto. Probá otra vez o cargá a mano.",
      });
    }

    const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    let parsed = {};
    try { parsed = JSON.parse(texto); } catch (_) {}
    const tipo = TIPOS.includes(parsed.tipo_vencimiento)
      ? parsed.tipo_vencimiento
      : "larga_duracion";
    return res.status(200).json({
      nombre: String(parsed.nombre || "").slice(0, 100),
      marca: String(parsed.marca || "").slice(0, 80),
      detalle: String(parsed.detalle || "").slice(0, 100),
      tipo_vencimiento: tipo,
      requiere_fecha: tipo === "perecedero",
      rubro: RUBROS.includes(parsed.rubro) ? parsed.rubro : "Otros",
      confianza: Math.max(0, Math.min(100, Math.round(Number(parsed.confianza) || 0))),
      razon: String(parsed.razon || "").slice(0, 180),
    });
  } catch (_) {
    return res.status(500).json({ error: "Error interno al identificar el producto." });
  }
}
