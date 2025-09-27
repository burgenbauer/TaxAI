// api/process-pdf.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === "GET") {
      // Health check so the browser doesn’t 500
      return res.status(200).json({ ok: true, route: "/api/process-pdf" });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Only POST allowed" });
    }

    // Optional auth (only on POST)
    const token = process.env.PDF_PROCESSING_TOKEN || "";
    if (token && req.headers.authorization !== `Bearer ${token}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Body may be string or object
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const fileUrls: string[] = body.fileUrls || [];
    if (!Array.isArray(fileUrls) || fileUrls.length === 0) {
      return res.status(400).json({ error: "fileUrls[] required" });
    }

    // Download first URL just to verify access
    const url = fileUrls[0];
    const resp = await fetch(url);
    if (!resp.ok) {
      return res.status(400).json({ error: `download failed ${resp.status}: ${resp.statusText}` });
    }
    const buf = Buffer.from(await resp.arrayBuffer());

    // Success smoke test
    return res.status(200).json({
      success: true,
      downloaded_bytes: buf.length
    });
  } catch (err: any) {
    console.error("process-pdf error:", err);
    return res.status(500).json({ error: "PROCESS_PDF_FAILED", detail: err?.message || String(err) });
  }
}

