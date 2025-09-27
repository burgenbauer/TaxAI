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

    // optional shared-secret
    const need = process.env.PDF_PROCESSING_TOKEN || "";
    const got = req.headers.authorization || "";
    if (need && got !== `Bearer ${need}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // body can be string or object
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const fileUrls = Array.isArray(body.fileUrls) ? body.fileUrls : [];
    const controls = body.controls || {};
    if (fileUrls.length === 0) {
      return res.status(400).json({ error: "fileUrls[] required" });
    }

    // download first URL
    const url = fileUrls[0];
    const r = await fetch(url);
    if (!r.ok) {
      return res.status(400).json({ error: "Download failed", status: r.status, statusText: r.statusText, url
