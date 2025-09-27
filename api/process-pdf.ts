// /api/process-pdf.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

// cjs interop for pdf-parse
const pdfParse = (await import("pdf-parse")).default as any;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === "GET") {
      // simple health check so hitting in browser doesn't crash
      return res.status(200).json({ ok: true, route: "/api/process-pdf" });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Only POST allowed" });
    }

    // optional auth (only enforced on POST)
    const token = process.env.PDF_PROCESSING_TOKEN || "";
    if (token && req.headers.authorization !== `Bearer ${token}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // body may already be parsed by Vercel; normalize it
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const fileUrls: string[] = body.fileUrls || [];
    if (!Array.isArray(fileUrls) || fileUrls.length === 0) {
      return res.status(400).json({ error: "fileUrls[] required" });
    }

    // download first PDF
    const url = fileUrls[0];
    const resp = await fetch(url);
    if (!resp.ok) {
      return res.status(400).json({ error: `download failed ${resp.status}: ${resp.statusText}` });
    }
    const buf = Buffer.from(await resp.arrayBuffer());

    // extract text
    const data = await pdfParse(buf);
    const text: string = (data?.text || "").trim();

    return res.status(200).json({
      success: true,
      pages: data?.numpages ?? null,
      text,                          // send full text back (your Edge function will pass to the model)
    });
  } catch (err: any) {
    console.error("process-pdf error:", err);
    return res.status(500).json({ error: "PROCESS_PDF_FAILED", detail: err?.message || String(err) });
  }
}
