// /api/process-pdf.js
export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, route: "/api/process-pdf", now: Date.now() });
  }
  return res.status(200).json({ ok: true, method: req.method, note: "no-op test handler" });
}
