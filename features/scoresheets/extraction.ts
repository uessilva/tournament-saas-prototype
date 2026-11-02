import { PDFDocument } from "pdf-lib";

import {
  FOOTBALL_FIELD_KEYS,
  FOOTBALL_TEMPLATE_VERSION,
  scoresheetIdentityForMatch,
} from "./template";

export type ExtractionSource = "acroform" | "qr_ocr" | "seeded_fallback";

export type ExtractedFieldDraft = {
  fieldKey: string;
  label: string;
  page: number;
  rawValue: string | null;
  normalizedValue: string | null;
  confidence: number;
  validationFlags: string[];
  needsReview: boolean;
  source: string;
  cropBox: { x: number; y: number; width: number; height: number };
};

export type ExtractionResult = {
  source: ExtractionSource;
  sheetId: string | null;
  templateVersion: string | null;
  pageCount: number;
  note: string | null;
  fields: ExtractedFieldDraft[];
};

export type ExtractionInput = {
  pdfBytes: Uint8Array;
  matchId: string;
  matchNumber: number;
  originalFilename: string;
};

const SCORE_FIELDS = new Set([
  "result_home_goals",
  "result_away_goals",
  "result_home_penalty",
  "result_away_penalty",
]);

const FIELD_LABELS: Record<string, string> = {
  result_home_goals: "Gols da casa / Home goals",
  result_away_goals: "Gols do visitante / Away goals",
  result_home_penalty: "Pênaltis da casa / Home penalties",
  result_away_penalty: "Pênaltis do visitante / Away penalties",
  result_walkover: "W.O. / Walkover",
  result_walkover_winner: "Vencedor do W.O. / Walkover winner",
  result_notes: "Observações / Notes",
};

const CROP_POSITIONS: Record<string, { x: number; y: number }> = {
  result_home_goals: { x: 88, y: 300 },
  result_away_goals: { x: 322, y: 300 },
  result_home_penalty: { x: 88, y: 226 },
  result_away_penalty: { x: 322, y: 226 },
  result_walkover: { x: 32, y: 184 },
  result_walkover_winner: { x: 182, y: 180 },
  result_notes: { x: 32, y: 36 },
};

function fieldLabel(fieldKey: string) {
  return FIELD_LABELS[fieldKey] ?? fieldKey;
}

function cropBox(fieldKey: string) {
  const position = CROP_POSITIONS[fieldKey] ?? { x: 40, y: 40 };
  return {
    x: position.x,
    y: position.y,
    width: fieldKey === "result_notes" ? 515 : 180,
    height: fieldKey === "result_notes" ? 90 : 34,
  };
}

function normalizeInteger(raw: string | null) {
  const value = raw?.trim() ?? "";
  if (!value) {
    return { normalized: null, flags: ["missing"] };
  }
  if (!/^\d{1,3}$/.test(value)) {
    return { normalized: null, flags: ["invalid_integer"] };
  }
  const number = Number(value);
  if (number > 30) {
    return { normalized: String(number), flags: ["out_of_range"] };
  }
  return { normalized: String(number), flags: [] as string[] };
}

function fieldFromRaw(
  fieldKey: string,
  rawValue: string | null,
  confidence: number,
  source: string,
): ExtractedFieldDraft {
  let normalizedValue = rawValue;
  let flags: string[] = [];

  if (SCORE_FIELDS.has(fieldKey)) {
    const normalized = normalizeInteger(rawValue);
    normalizedValue = normalized.normalized;
    flags = normalized.flags;
  } else if (fieldKey === "result_walkover") {
    normalizedValue = rawValue === "true" ? "true" : "false";
    flags = [];
  } else if (fieldKey === "result_walkover_winner") {
    const value = rawValue?.trim().toLowerCase() ?? "";
    normalizedValue = value === "home" || value === "away" ? value : "";
    if (value && !normalizedValue) {
      flags = ["invalid_option"];
    }
  } else {
    normalizedValue = rawValue?.trim() ? rawValue.trim() : null;
  }

  return {
    fieldKey,
    label: fieldLabel(fieldKey),
    page: 1,
    rawValue,
    normalizedValue,
    confidence: flags.length ? Math.min(confidence, 72) : confidence,
    validationFlags: flags,
    needsReview: flags.length > 0,
    source,
    cropBox: cropBox(fieldKey),
  };
}

function readAcroformFields(pdf: PDFDocument) {
  const form = pdf.getForm();
  const names = form.getFields().map((field) => field.getName());
  if (!names.some((name) => name.startsWith("result_"))) {
    return null;
  }

  const textValue = (name: string) => {
    try {
      return form.getTextField(name).getText() ?? null;
    } catch {
      return null;
    }
  };

  let walkover = false;
  try {
    walkover = form.getCheckBox("result_walkover").isChecked();
  } catch {
    walkover = false;
  }

  let walkoverWinner = "";
  try {
    walkoverWinner = form.getDropdown("result_walkover_winner").getSelected()[0] ?? "";
  } catch {
    walkoverWinner = "";
  }

  const raw: Record<string, string | null> = {
    result_home_goals: textValue("result_home_goals"),
    result_away_goals: textValue("result_away_goals"),
    result_home_penalty: textValue("result_home_penalty"),
    result_away_penalty: textValue("result_away_penalty"),
    result_walkover: walkover ? "true" : "false",
    result_walkover_winner: walkoverWinner,
    result_notes: textValue("result_notes"),
  };

  return {
    raw,
    sheetId: textValue("identity_sheet_id"),
    templateVersion: textValue("identity_template_version"),
  };
}

function seededFallbackValues(matchNumber: number) {
  const homeScore = 1 + (matchNumber % 3);
  const awayScore = matchNumber % 4;
  return {
    result_home_goals: String(homeScore),
    result_away_goals: String(awayScore),
    result_home_penalty: "",
    result_away_penalty: "",
    result_walkover: "false",
    result_walkover_winner: "",
    result_notes:
      "Valores representativos da demonstração (OCR local não configurado). Representative demo values (local OCR unavailable).",
  };
}

function extractSheetIdFromFilename(filename: string) {
  const match = filename.match(/sheet-[0-9a-f-]{36}/i);
  return match?.[0] ?? null;
}

/**
 * Replaceable local scan adapter. A production adapter would decode the QR
 * image and run fixed-region Tesseract over each box. This prototype returns
 * deterministic representative values and labels the extraction as fallback so
 * the review UI never pretends OCR ran.
 */
export async function extractScoresheet(
  input: ExtractionInput,
): Promise<ExtractionResult> {
  const pdf = await PDFDocument.load(input.pdfBytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  });
  const expectedIdentity = scoresheetIdentityForMatch(input.matchId);
  const acroform = readAcroformFields(pdf);

  if (acroform) {
    const fields = FOOTBALL_FIELD_KEYS.map((fieldKey) =>
      fieldFromRaw(
        fieldKey,
        acroform.raw[fieldKey] ?? null,
        100,
        "acroform",
      ),
    );

    const identityMismatch =
      acroform.sheetId != null &&
      acroform.sheetId.length > 0 &&
      acroform.sheetId !== expectedIdentity.sheetId;

    return {
      source: "acroform",
      sheetId: acroform.sheetId || expectedIdentity.sheetId,
      templateVersion:
        acroform.templateVersion || FOOTBALL_TEMPLATE_VERSION,
      pageCount: pdf.getPageCount(),
      note: identityMismatch
        ? "A identidade QR do PDF não corresponde a este jogo. Confirme os dados antes de publicar. / The PDF identity does not match this match."
        : null,
      fields: identityMismatch
        ? fields.map((field) => ({
            ...field,
            validationFlags: [...field.validationFlags, "identity_mismatch"],
            needsReview: true,
            confidence: Math.min(field.confidence, 60),
          }))
        : fields,
    };
  }

  const decodedSheetId = extractSheetIdFromFilename(input.originalFilename);
  const sheetId = decodedSheetId ?? expectedIdentity.sheetId;
  const qrDecoded = decodedSheetId === expectedIdentity.sheetId;
  const seeded = seededFallbackValues(input.matchNumber);
  const fields = FOOTBALL_FIELD_KEYS.map((fieldKey, index) => {
    const confidence = [84, 61, 76, 68, 90, 80, 74][index] ?? 70;
    const field = fieldFromRaw(
      fieldKey,
      seeded[fieldKey as keyof typeof seeded] ?? null,
      confidence,
      "seeded_fallback",
    );
    const flags = new Set(field.validationFlags);
    flags.add("ocr_unavailable");
    if (!qrDecoded) {
      flags.add("qr_not_decoded");
    }
    if (SCORE_FIELDS.has(fieldKey)) {
      flags.add("scan_requires_review");
    }
    return {
      ...field,
      validationFlags: [...flags],
      needsReview: true,
    };
  });

  return {
    source: "seeded_fallback",
    sheetId,
    templateVersion: FOOTBALL_TEMPLATE_VERSION,
    pageCount: pdf.getPageCount(),
    note: qrDecoded
      ? "Leitura por QR + regiões fixas de demonstração. A extração local de OCR não está disponível; revise cada campo. / QR + fixed-region demo extraction. Local OCR is unavailable; review every field."
      : "QR não decodificado no arquivo. Identidade reconciliada com o jogo e valores representativos de demonstração. / QR could not be decoded; identity reconciled with the match and representative demo values were used.",
    fields,
  };
}

export type ReviewableField = {
  key: string;
  label: string;
  rawValue: string | null;
  normalizedValue: string | null;
  reviewedValue: string | null;
  confidence: number | null;
  flags: string[];
  needsReview: boolean;
  source: string | null;
  cropStorageKey: string | null;
  sourceLabel: string;
};

export function fieldFlagLabel(flag: string) {
  const labels: Record<string, string> = {
    missing: "Campo vazio / Missing",
    invalid_integer: "Número inválido / Invalid number",
    out_of_range: "Valor incomum / Unusual value",
    invalid_option: "Opção inválida / Invalid option",
    ocr_unavailable: "OCR indisponível / OCR unavailable",
    qr_not_decoded: "QR não lido / QR not decoded",
    scan_requires_review: "Digitalização exige revisão / Scan needs review",
    identity_mismatch: "Identidade divergente / Identity mismatch",
    review_required: "Revisão obrigatória / Review required",
  };
  return labels[flag] ?? flag;
}
