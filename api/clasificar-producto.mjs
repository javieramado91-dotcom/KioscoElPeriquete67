// =============================================================
//  FUNCIÓN SERVERLESS (Vercel)  ·  /api/clasificar-producto
// -------------------------------------------------------------
//  Recibe el NOMBRE de un producto (texto) y le pregunta a la IA
//  DOS cosas: si es perecedero y a qué rubro pertenece.
//  Se usa en cargas manuales o por código de barras (sin foto),
//  para que la IA igual catalogue y decida la fecha de vto.
//
//  La clave de Gemini vive en Vercel como GEMINI_API_KEY.
// =============================================================

const MODELO = "gemini-2.5-flash-lite";

const RUBROS = [
  "Lácteos", "Fiambres y quesos", "Carnes", "Frutas y verduras", "Panadería",
  "Almacén", "Bebidas", "Bebidas alcohólicas", "Golosinas y snacks", "Galletitas",
  "Congelados", "Limpieza", "Perfumería e higiene", "Kiosco", "Otros",
];

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
Respondé SOLO un JSON con dos claves:
- "perecedero": true si se vence pronto y necesita fecha de vencimiento (lácteos, yogur,
  fiambres, carnes, pollo, pescado, pan, frutas, verduras, huevos, comidas frescas);
  false si dura mucho (gaseosas, aguas, enlatados, fideos secos, arroz, golosinas,
  galletitas envasadas, limpieza, snacks).
- "rubro": elegí EXACTAMENTE uno de esta lista: ${RUBROS.join(", ")}. Si no encaja, "Otros".`;

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
      return res.status(502).json({ error: "No se pudo clasificar el producto.", _debug: { status: r.status, data } });
    }

    const t = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    let parsed = {};
    try { parsed = JSON.parse(t); } catch (_) {}

    return res.status(200).json({
      perecedero: parsed.perecedero === true,
      rubro: RUBROS.includes(parsed.rubro) ? parsed.rubro : "Otros",
    });
  } catch (e) {
    return res.status(500).json({ error: "Error interno al clasificar." });
  }
}
