import type { ExtractionResult, ExtractedFieldDraft } from "./extraction";

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderCropSvg(
  field: ExtractedFieldDraft,
  context: { homeTeamName: string; awayTeamName: string },
) {
  const raw = field.rawValue?.trim() ? field.rawValue : "—";
  const confidence =
    field.confidence == null ? "—" : `${field.confidence}%`;
  const isFlags = field.validationFlags.length > 0;
  const accent = isFlags ? "#a34b1f" : "#176b46";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="116" viewBox="0 0 360 116" role="img" aria-label="${escapeXml(field.label)}">
  <rect width="360" height="116" rx="10" fill="#fbfaf4"/>
  <rect x="1" y="1" width="358" height="114" rx="9" fill="none" stroke="#d8d8cc"/>
  <text x="14" y="23" font-family="Manrope, Arial, sans-serif" font-size="9" font-weight="700" fill="#68706b">REGIÃO DE ORIGEM / SOURCE REGION</text>
  <text x="14" y="41" font-family="Manrope, Arial, sans-serif" font-size="11" font-weight="700" fill="#161917">${escapeXml(field.label)}</text>
  <text x="14" y="57" font-family="Manrope, Arial, sans-serif" font-size="9" fill="#68706b">${escapeXml(context.homeTeamName)} × ${escapeXml(context.awayTeamName)}</text>
  <rect x="14" y="68" width="205" height="32" rx="5" fill="#ffffff" stroke="${accent}" stroke-width="1.5" stroke-dasharray="4 3"/>
  <text x="26" y="90" font-family="Courier New, monospace" font-size="18" font-weight="700" fill="#161917">${escapeXml(raw ?? "—")}</text>
  <text x="234" y="79" font-family="Manrope, Arial, sans-serif" font-size="8" font-weight="700" fill="#68706b">CONFIANÇA</text>
  <text x="234" y="96" font-family="Courier New, monospace" font-size="16" font-weight="700" fill="${accent}">${confidence}</text>
  <text x="14" y="111" font-family="Manrope, Arial, sans-serif" font-size="8" fill="#68706b">box ${Math.round(field.cropBox.x)},${Math.round(field.cropBox.y)} · ${escapeXml(field.source ?? "manual")}</text>
</svg>`;
}

export function renderPreviewSvg(
  result: ExtractionResult,
  context: {
    eventName: string;
    competitionName: string;
    homeTeamName: string;
    awayTeamName: string;
    matchNumber: number;
  },
) {
  const rows = result.fields
    .slice(0, 7)
    .map((field, index) => {
      const y = 156 + index * 34;
      const raw = field.rawValue?.trim() ? field.rawValue : "—";
      const flagText = field.validationFlags.length
        ? field.validationFlags[0]!.replaceAll("_", " ")
        : "ok";
      return `<text x="42" y="${y}" font-family="Manrope, Arial, sans-serif" font-size="10" font-weight="700" fill="#161917">${escapeXml(field.label)}</text>
      <rect x="320" y="${y - 14}" width="86" height="20" rx="4" fill="#ffffff" stroke="${field.needsReview ? "#a34b1f" : "#176b46"}"/>
      <text x="328" y="${y}" font-family="Courier New, monospace" font-size="12" font-weight="700" fill="#161917">${escapeXml(raw ?? "—")}</text>
      <text x="420" y="${y}" font-family="Manrope, Arial, sans-serif" font-size="8" fill="${field.needsReview ? "#a34b1f" : "#68706b"}">${escapeXml(flagText)}</text>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="595" height="440" viewBox="0 0 595 440" role="img" aria-label="Prévia extraída / Extracted preview">
  <rect width="595" height="440" fill="#fbfaf4"/>
  <rect x="0" y="0" width="595" height="88" fill="#176b46"/>
  <text x="32" y="32" font-family="Manrope, Arial, sans-serif" font-size="9" font-weight="700" fill="#d1e891">PRÉVIA DA FOLHA / SHEET PREVIEW · ${escapeXml(result.source)}</text>
  <text x="32" y="57" font-family="Fraunces, Georgia, serif" font-size="24" font-weight="700" fill="#ffffff">${escapeXml(context.competitionName)}</text>
  <text x="32" y="76" font-family="Manrope, Arial, sans-serif" font-size="9" fill="#d7e5d8">${escapeXml(context.eventName)} · Jogo #${context.matchNumber}</text>
  <text x="32" y="116" font-family="Manrope, Arial, sans-serif" font-size="13" font-weight="700" fill="#161917">${escapeXml(context.homeTeamName)} × ${escapeXml(context.awayTeamName)}</text>
  <line x1="32" y1="130" x2="563" y2="130" stroke="#d8d8cc"/>
  ${rows}
  <line x1="32" y1="404" x2="563" y2="404" stroke="#d8d8cc"/>
  <text x="32" y="424" font-family="Manrope, Arial, sans-serif" font-size="8" fill="#68706b">${escapeXml(result.note ?? "Extração concluída. Revise os campos destacados. / Extraction complete. Review highlighted fields.")}</text>
</svg>`;
}
