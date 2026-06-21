// =============================================================
//  FUNCIÓN SERVERLESS (Vercel)  ·  /api/identificar-producto
// -------------------------------------------------------------
//  Recibe una foto (base64), se la manda a Gemini y devuelve
//  nombre, marca y detalle del producto.
//  La clave vive en Vercel como variable GEMINI_API_KEY.
//
//  NOTA: incluye un modo diagnóstico temporal:
//   - GET  -> lista los modelos disponibles para la clave.
//   - POST ?model=xxx -> permite probar otro modelo sin redeploy.
// =============================================================

const MODELO_DEFECTO = "gemini-2.0-flash";

const PROMPT = `Sos un asistente de una despensa/almacén en Argentina.
Mirá la foto e identificá el producto. Respondé SOLO un JSON con estas claves:
- "nombre": nombre genérico del producto (ej: "Gaseosa", "Yerba mate", "Fideos").
- "marca": la marca si se ve (ej: "Coca-Cola", "Playadito"). Si no se ve, cadena vacía.
- "detalle": tamaño, peso o variedad (ej: "1.5 L", "1 kg", "tirabuzón"). Si no se ve, cadena vacía.
Si no podés identificarlo, devolvé los tres campos como cadena vacía.
No agregues texto fuera del JSON.`;

export default async function handler(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "Falta configurar la clave de IA (GEMINI_API_KEY) en Vercel.",
    });
  }

  // ----- DIAGNÓSTICO: listar modelos disponibles para la clave -----
  if (req.method === "GET") {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=200`
      );
      const data = await r.json();
      const modelos = (data.models || [])
        .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
        .map((m) => m.name.replace("models/", ""));
      return res.status(200).json({ ok: r.ok, modelos, _raw: r.ok ? undefined : data });
    } catch (e) {
      return res.status(500).json({ error: String(e) });
    }
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido." });
  }

  const modelo = (req.query && req.query.model) || MODELO_DEFECTO;

  try {
    const { imagenBase64, mimeType } = req.body || {};
    if (!imagenBase64) {
      return res.status(400).json({ error: "No llegó la imagen." });
    }

    const cuerpo = {
      contents: [
        {
          parts: [
            { text: PROMPT },
            { inline_data: { mime_type: mimeType || "image/jpeg", data: imagenBase64 } },
          ],
        },
      ],
      generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
    };

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(502).json({
        error: "La IA no pudo procesar la foto. Probá de nuevo o cargá a mano.",
        _debug: { modelo, status: r.status, data },
      });
    }

    const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    let parsed = {};
    try { parsed = JSON.parse(texto); } catch (_) {}

    return res.status(200).json({
      nombre: parsed.nombre || "",
      marca: parsed.marca || "",
      detalle: parsed.detalle || "",
    });
  } catch (e) {
    return res.status(500).json({ error: "Error interno.", _debug: String(e) });
  }
}
