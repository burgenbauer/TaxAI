// api/process-pdf.ts
import { NextApiRequest, NextApiResponse } from "next";
import pdf from "pdf-parse";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  // token check (optional)
  if (req.headers.authorization !== `Bearer ${process.env.PDF_PROCESSING_TOKEN}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Expect raw PDF file in request body (base64 encoded or binary)
    const fileBuffer = Buffer.from(req.body, "base64");
    const data = await pdf(fileBuffer);

    res.status(200).json({ text: data.text });
  } catch (err: any) {
    console.error("PDF parsing failed", err);
    res.status(500).json({ error: "PDF parsing failed", details: err.message });
  }
}
