// =============================================================
//  FUNCIÓN SERVERLESS (Vercel)  ·  /api/clasificar-perecedero
// -------------------------------------------------------------
//  Recibe el NOMBRE de un producto (texto) y le pregunta a la IA
//  si es perecedero o no. Se usa cuando el producto se carga a
//  mano o por código de barras (sin foto), para que igual la IA
//  se encargue de decidir si hay que pedir fecha de vencimiento.
//
//  La clave de Gemini vive en Vercel como GEMINI_API_KEY.
// =============================================================

const MODELO = "gemini-2.5-flash-lite";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Falta configurar GEMINI_API_KEY en Vercel." });
  }

  try {
    const { texto } = req.body || {};
    if (!texto || !String(texto).trim()) {
      return res.status(400).json({ error: "Falta el nombre del producto." });
    }

    const prompt = `Producto de una despensa/almacén en Argentina: "${texto}".
¿Es un producto PERECEDERO (se vence pronto y necesita fecha de vencimiento:
lácteos, yogur, fiambres, carnes, pollo, pescado, pan, frutas, verduras, huevos,
comidas frescas, postres) o NO perecedero (gaseosas, aguas, enlatados, fideos secos,
arroz, golosinas, galletitas envasadas, limpieza, snacks de larga duración)?
Respondé SOLO un JSON: {"perecedero": true} o {"perecedero": false}.`;

    const cuerpo = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0 },
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
      return res.status(502).json({ error: "No se pudo clasificar el producto." });
    }

    const t = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    let parsed = {};
    try { parsed = JSON.parse(t); } catch (_) {}

    return res.status(200).json({ perecedero: parsed.perecedero === true });
  } catch (e) {
    return res.status(500).json({ error: "Error interno al clasificar." });
  }
}
