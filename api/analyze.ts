import type { VercelRequest, VercelResponse } from "@vercel/node";
import pdf from "pdf-parse";
import sharp from "sharp";
import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const PDF_PROCESSING_TOKEN = process.env.PDF_PROCESSING_TOKEN || ""; // optional auth

const SYSTEM_PROMPT = `You are a strict extractor for Swiss salary documents (Lohnausweis, Lohnabrechnung).

Rules:
- Output ONLY valid JSON matching the schema below, no explanations.
- Extract only what is explicitly in this document; never guess.
- If missing/unclear → set null and add a short note in "issues".
- Withholding tax only if controls.include_withholding_tax = true.
- Evidence for each field (evidence.text) and page/bbox if available.
- Validate: AHV = 756.####.####.## or 13 digits; Postal code = 4 digits; amounts normalized to 12345.67.

Schema:
{
  "document_type": "lohnausweis | lohnabrechnung | other",
  "controls_used": { "include_withholding_tax": true | false },
  "employee": {
    "full_name": null,
    "address": { "street": null, "postal_code": null, "city": null, "country": "CH" },
    "ahv_number": null
  },
  "employer": {
    "name": null,
    "address": { "street": null, "postal_code": null, "city": null, "country": "CH" }
  },
  "income": {
    "gross_salary": null,
    "net_salary": null,
    "period_from": null,
    "period_to": null,
    "withholding_tax": null
  },
  "evidence": {
    "employee.full_name": { "text": null, "page": null, "bbox": null },
    "employee.address": { "text": null, "page": null, "bbox": null },
    "employee.ahv_number": { "text": null, "page": null, "bbox": null },
    "employer.name": { "text": null, "page": null, "bbox": null },
    "employer.address": { "text": null, "page": null, "bbox": null },
    "income.gross_salary": { "text": null, "page": null, "bbox": null },
    "income.net_salary": { "text": null, "page": null, "bbox": null },
    "income.period_from": { "text": null, "page": null, "bbox": null },
    "income.period_to": { "text": null, "page": null, "bbox": null },
    "income.withholding_tax": { "text": null, "page": null, "bbox": null }
  },
  "issues": []
}`;

const client = new OpenAI({ apiKey: OPENAI_API_KEY });

// Helper: download a file from Supabase or elsewhere
async function downloadBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

function isImageName(name: string) {
  return /\.(png|jpg|jpeg|webp)$/i.test(name);
}
function isPdfName(name: string) {
  return /\.pdf$/i.test(name);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Optional token check
    if (PDF_PROCESSING_TOKEN) {
      const auth = req.headers.authorization || "";
      if (auth !== `Bearer ${PDF_PROCESSING_TOKEN}`) {
        return res.status(401).json({ error: "unauthorized" });
      }
    }

    if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
    const { fileUrls = [], controls = { include_withholding_tax: false } } = req.body || {};
    if (!Array.isArray(fileUrls) || fileUrls.length === 0) {
      return res.status(400).json({ error: "fileUrls[] required" });
    }

    const userParts: any[] = [
      { type: "text", text: `# CONTROLS\n${JSON.stringify(controls)}\n# OUTPUT\nReturn ONLY the JSON.` }
    ];

    for (let i = 0; i < fileUrls.length; i++) {
      const url = fileUrls[i];
      const filename = url.split("?")[0].split("/").pop() || `file_${i+1}`;
      const buf = await downloadBuffer(url);

      if (isPdfName(filename)) {
        const parsed = await pdf(buf).catch(() => null);
        const text = parsed?.text?.trim() || "";

        if (text.length >= 50) {
          for (let j = 0; j < text.length; j += 6000) {
            userParts.push({ type: "text", text: `# DOCUMENT_TEXT (chunk)\n${text.slice(j, j+6000)}` });
          }
        } else {
          userParts.push({ type: "text", text: `# DOCUMENT_TEXT\n[PDF appears scanned or has no selectable text: ${filename}]` });
        }
      } else if (isImageName(filename)) {
        let img = sharp(buf);
        const meta = await img.metadata();
        const maxDim = Math.max(meta.width || 0, meta.height || 0);
        if (maxDim > 2000) img = img.resize({ width: 2000, height: 2000, fit: "inside" });
        const png = await img.png().toBuffer();
        const b64 = png.toString("base64");

        userParts.push({
          type: "image_url",
          image_url: { url: `data:image/png;base64,${b64}`, detail: "high" }
        });
      } else {
        userParts.push({ type: "text", text: `# DOCUMENT_TEXT\n[Unsupported file type: ${filename}]` });
      }
    }

    const resp = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userParts }
      ],
      temperature: 0.1,
      max_tokens: 2000
    });

    let out = resp.choices?.[0]?.message?.content || "";
    out = out.replace(/^```json\s*/i, "").replace(/\s*```$/i, "");

    try { JSON.parse(out); } catch {
      return res.status(500).json({ error: "AI returned invalid JSON", raw: out.slice(0, 1000) });
    }

    res.setHeader("Content-Type", "application/json");
    return res.status(200).send(out);
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: "analyze failed", detail: e.message || String(e) });
  }
}
