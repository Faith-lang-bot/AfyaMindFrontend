function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapText(value: string, maxLength: number) {
  const words = value.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function buildPdf(content: string) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

export function downloadCertificatePdf(data: {
  recipientName: string;
  status: string;
  summary: string;
  sessionDate: string;
}) {
  const name = data.recipientName.trim() || "AfyaMind Member";
  const status = data.status.trim() || "Completed";
  const summaryLines = wrapText(data.summary || "Wellness support session completed.", 56);
  const issuedOn = new Date(data.sessionDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const commands = [
    "0.98 0.96 0.91 rg 0 0 612 792 re f",
    "0.83 0.58 0.33 rg 36 640 540 110 re f",
    "0.74 0.82 0.66 rg 60 92 492 24 re f",
    "0.71 0.40 0.22 RG 10 w 42 42 528 708 re S",
    "0.87 0.69 0.46 RG 3 w 58 58 496 676 re S",
    "BT /F2 30 Tf 126 686 Td (AfyaMind Wellness Certificate) Tj ET",
    "BT /F1 15 Tf 166 650 Td (Recognizing completion of a guided mental wellness session) Tj ET",
    "BT /F1 18 Tf 234 570 Td (Presented to) Tj ET",
    `BT /F2 28 Tf 120 524 Td (${escapePdfText(name)}) Tj ET`,
    `BT /F1 17 Tf 126 470 Td (Current status: ${escapePdfText(status)}) Tj ET`,
  ];

  let currentY = 434;
  summaryLines.forEach((line) => {
    commands.push(`BT /F1 15 Tf 88 ${currentY} Td (${escapePdfText(line)}) Tj ET`);
    currentY -= 22;
  });

  commands.push(
    "BT /F2 17 Tf 88 174 Td (Care Team Signature) Tj ET",
    "0.35 0.35 0.35 RG 2 w 88 196 m 250 196 l S",
    "BT /F2 17 Tf 370 174 Td (Issued) Tj ET",
    "0.35 0.35 0.35 RG 2 w 370 196 m 522 196 l S",
    `BT /F1 14 Tf 392 146 Td (${escapePdfText(issuedOn)}) Tj ET`,
    "BT /F1 12 Tf 120 106 Td (Continue with steady check-ins, guided support, and compassionate follow-up.) Tj ET",
  );

  const blob = buildPdf(commands.join("\n"));
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "afyamind"}-certificate.pdf`;
  link.click();
  URL.revokeObjectURL(link.href);
}
