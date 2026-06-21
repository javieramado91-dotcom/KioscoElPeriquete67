// =============================================================
//  FUNCIÓN SERVERLESS (Vercel)  ·  /api/identificar-producto
// -------------------------------------------------------------
//  Recibe una foto (en base64) desde la app, se la manda a
//  Gemini (la IA de Google) y devuelve el nombre, la marca y
//  el detalle del producto.
//
//  >>> IMPORTANTE <<<
//  La clave de Gemini se configura en Vercel como variable de
//  entorno llamada GEMINI_API_KEY. NUNCA se escribe acá.
//  (Vercel → Settings → Environment Variables)
//
//  Modelo: gemini-2.5-flash-lite (rápido y con cupo gratuito).
//  Los modelos 2.0 NO tienen cupo gratis (dan error 429 limit:0).
// =============================================================

const MODELO = "gemini-2.5-flash-lite";

const PROMPT = `Sos un asistente de una despensa/almacén en Argentina.
Mirá la foto e identificá el producto. Respondé SOLO un JSON con estas claves:
- "nombre": nombre genérico del producto (ej: "Gaseosa", "Yerba mate", "Fideos").
- "marca": la marca si se ve (ej: "Coca-Cola", "Playadito"). Si no se ve, cadena vacía.
- "detalle": tamaño, peso o variedad (ej: "1.5 L", "1 kg", "tirabuzón"). Si no se ve, cadena vacía.
Si no podés identificarlo, devolvé los tres campos como cadena vacía.
No agregues texto fuera del JSON.`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "Falta configurar la clave de IA (GEMINI_API_KEY) en Vercel.",
    });
  }

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
      `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${apiKey}`;

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });

    const data = await r.json();
    if (!r.ok) {
      // 429 = se acabó el cupo gratis por un rato; el resto = otro problema.
      const sinCupo = r.status === 429;
      return res.status(502).json({
        error: sinCupo
          ? "La IA está descansando un minuto (límite gratis). Probá de nuevo en un rato o cargá a mano."
          : "La IA no pudo procesar la foto. Probá de nuevo o cargá a mano.",
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
    return res.status(500).json({ error: "Error interno al identificar el producto." });
  }
}
