// /api/process-pdf.js
export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return res.status(200).json({ ok: true, route: "/api/process-pdf" });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Only POST allowed" });
    }

    // --- auth (optional) ---
    const wantToken = process.env.PDF_PROCESSING_TOKEN || "";
    const gotAuth = req.headers.authorization || "";
    if (wantToken && gotAuth !== `Bearer ${wantToken}`) {
      return res.status(401).json({ error: "Unauthorized", want: "Bearer <token>", got: gotAuth || null });
    }

    // --- show what we actually received ---
    const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
    let body;
    try { body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {}); }
    catch (e) { return res.status(400).json({ error: "Invalid JSON body", sample: raw.slice(0, 200) }); }

    if (!Array.isArray(body.fileUrls) || body.fileUrls.length === 0) {
      return res.status(400).json({ error: "fileUrls[] required", received_body: body });
    }

    // --- try to download the first URL only (no pdf-parse yet) ---
    const testUrl = body.fileUrls[0];
    const r = await fetch(testUrl);
    if (!r.ok) {
      return res.status(400).json({ error: "Download failed", status: r.status, statusText: r.statusText, url: testUrl });
    }
    const buf = Buffer.from(await r.arrayBuffer());

    return res.status(200).json({
      success: true,
      downloaded_bytes: buf.length,
      note: "Download OK. Next step is adding pdf-parse once this 200 is confirmed."
    });
  } catch (err) {
    console.error("process-pdf fatal:", err);
    return res.status(500).json({ error: "PROCESS_PDF_FAILED", detail: err?.message || String(err) });
  }
}
