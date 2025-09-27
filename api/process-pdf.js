// /api/process-pdf.js
import { createRequire } from "module";
const require = createRequire(import.meta.url);
let pdf;
try {
  // pdf-parse is CommonJS; require() avoids ESM interop crashes
  pdf = require("pdf-parse");
} catch (e) {
  // If loading fails, we’ll report a clear error later
  pdf = null;
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return res.status(200).json({ ok: true, route: "/api/process-pdf" });
    }
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Only POST allowed" });
    }

    const need = process.env.PDF_PROCESSING_TOKEN || "";
    if (need && (req.headers.authorization || "") !== `Bearer ${need}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const fileUrls = Array.isArray(body.fileUrls) ? body.fileUrls : [];
    const controls = body.controls || {};
    if (fileUrls.length === 0) {
      return res.status(400).json({ error: "fileUrls[] required" });
    }

    const url = fileUrls[0];
    const r = await fetch(url);
    if (!r.ok) {
      return res.status(400).json({ error: "Download failed", status: r.status, statusText: r.statusText, url });
    }
    const buf = Buffer.from(await r.arrayBuffer());

    if (!pdf) {
      // If pdf-parse failed to load, at least prove download works
      return res.status(500).json({ error: "PDF_PARSE_LOAD_FAILED", downloaded_bytes: buf.length });
    }

    const data = await pdf(buf); // { text, numpages, info, metadata ... }
    const text = (data?.text || "").trim();

    return res.status(200).json({
      success: true,
      pages: data?.numpages ?? null,
      controls_used: controls,
      text
    });
  } catch (err) {
    console.error("process-pdf error:", err);
    return res.status(500).json({ error: "PROCESS_PDF_FAILED", detail: err?.message || String(err) });
  }
}
