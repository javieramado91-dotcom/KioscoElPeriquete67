// DIAGNÓSTICO TEMPORAL - se elimina después de verificar.
// Prueba la clave de Gemini directamente y reporta qué modelos funcionan.
export default async function handler(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(200).json({ hayClave: false, error: "No hay GEMINI_API_KEY" });

  const out = { hayClave: true, claveEmpieza: apiKey.slice(0, 4), modelos: {} };

  // 1) Listar modelos disponibles
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const d = await r.json();
    out.listModelsStatus = r.status;
    out.modelosDisponibles = (d.models || [])
      .map((m) => m.name?.replace("models/", ""))
      .filter((n) => n && n.includes("flash"));
    if (!r.ok) out.listModelsError = d?.error?.message || JSON.stringify(d).slice(0, 300);
  } catch (e) {
    out.listModelsException = String(e);
  }

  // 2) Probar generateContent con cada candidato
  const candidatos = [
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-flash-latest",
  ];
  for (const modelo of candidatos) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Respondé solo: {"ok":true}' }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0 },
          }),
        }
      );
      const d = await r.json();
      out.modelos[modelo] = {
        status: r.status,
        ok: r.ok,
        texto: r.ok ? d?.candidates?.[0]?.content?.parts?.[0]?.text : undefined,
        error: r.ok ? undefined : (d?.error?.message || "").slice(0, 200),
      };
    } catch (e) {
      out.modelos[modelo] = { exception: String(e).slice(0, 200) };
    }
  }

  return res.status(200).json(out);
}
