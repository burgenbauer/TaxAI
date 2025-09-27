import type { VercelRequest, VercelResponse } from '@vercel/node';
import pdfParse from 'pdf-parse';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  // Token check
  if (req.headers.authorization !== `Bearer ${process.env.PDF_PROCESSING_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { fileUrls } = req.body;
    if (!fileUrls || fileUrls.length === 0) {
      return res.status(400).json({ error: 'fileUrls required' });
    }

    // Download the PDF
    const response = await fetch(fileUrls[0]);
    const buffer = Buffer.from(await response.arrayBuffer());

    // Extract text
    const data = await pdfParse(buffer);

    return res.status(200).json({ text: data.text });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Unknown error' });
  }
}
