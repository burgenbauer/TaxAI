// /api/process-pdf.js
import pdf from "pdf-parse";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return res.status(200).json({ ok: true, route: "/api/process-pdf" });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Only POST allowed" });
    }

    // optional shared-secret check
    const token = process.env.PDF_PROCESSING_TOKEN || "";
    if (token && req.headers.authorization !== `Bearer ${token}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // body might be a string (Vercel) or object
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const fileUrls = Array.isArray(body.fileUrls) ? body.fileUrls : [];
    const controls = body.controls || {};

    if (fileUrls.length === 0) {
      return res.status(400).json({ error: "fileUrls[] required" });
    }

    // download first URL
    const url = fileUrls[0];
    const resp = await fetch(url);
    if (!resp.ok) {
      return res.status(400).json({ error: `download failed ${resp.status}: ${resp.statusText}` });
    }
    const buf = Buffer.from(await resp.arrayBuffer());

    // extract text
    const data = await pdf(buf);
    const text = (data?.t
