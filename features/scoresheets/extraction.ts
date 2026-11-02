import { PDFDocument } from "pdf-lib";

import {
  FOOTBALL_FIELD_KEYS,
  FOOTBALL_TEMPLATE_VERSION,
  TENNIS_FIELD_KEYS,
  TENNIS_TEMPLATE_VERSION,
  scoresheetFieldKeys,
  scoresheetIdentityForMatch,
  scoresheetTemplateVersion,
  type ScoresheetSport,
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
  sport: ScoresheetSport;
};

type FieldKind =
  | "football_score"
  | "tennis_games"
  | "tennis_tiebreak"
  | "tennis_stat"
  | "walkover"
  | "walkover_winner"
  | "notes";

type FieldMeta = {
  label: string;
  kind: FieldKind;
  crop: { x: number; y: number };
};

const FOOTBALL_FIELD_META: Record<string, FieldMeta> = {
  result_home_goals: {
    label: "Gols da casa / Home goals",
    kind: "football_score",
    crop: { x: 88, y: 300 },
  },
  result_away_goals: {
    label: "Gols do visitante / Away goals",
    kind: "football_score",
    crop: { x: 322, y: 300 },
  },
  result_home_penalty: {
    label: "Pênaltis da casa / Home penalties",
    kind: "football_score",
    crop: { x: 88, y: 226 },
  },
  result_away_penalty: {
    label: "Pênaltis do visitante / Away penalties",
    kind: "football_score",
    crop: { x: 322, y: 226 },
  },
  result_walkover: {
    label: "W.O. / Walkover",
    kind: "walkover",
    crop: { x: 32, y: 184 },
  },
  result_walkover_winner: {
    label: "Vencedor do W.O. / Walkover winner",
    kind: "walkover_winner",
    crop: { x: 182, y: 180 },
  },
  result_notes: {
    label: "Observações / Notes",
    kind: "notes",
    crop: { x: 32, y: 36 },
  },
};

const TENNIS_FIELD_META: Record<string, FieldMeta> = {
  result_set1_home: {
    label: "Set 1 · games casa / home games",
    kind: "tennis_games",
    crop: { x: 144, y: 566 },
  },
  result_set1_away: {
    label: "Set 1 · games fora / away games",
    kind: "tennis_games",
    crop: { x: 244, y: 566 },
  },
  result_set1_tiebreak_home: {
    label: "Set 1 · tie-break casa / home",
    kind: "tennis_tiebreak",
    crop: { x: 344, y: 566 },
  },
  result_set1_tiebreak_away: {
    label: "Set 1 · tie-break fora / away",
    kind: "tennis_tiebreak",
    crop: { x: 444, y: 566 },
  },
  result_set2_home: {
    label: "Set 2 · games casa / home games",
    kind: "tennis_games",
    crop: { x: 144, y: 520 },
  },
  result_set2_away: {
    label: "Set 2 · games fora / away games",
    kind: "tennis_games",
    crop: { x: 244, y: 520 },
  },
  result_set2_tiebreak_home: {
    label: "Set 2 · tie-break casa / home",
    kind: "tennis_tiebreak",
    crop: { x: 344, y: 520 },
  },
  result_set2_tiebreak_away: {
    label: "Set 2 · tie-break fora / away",
    kind: "tennis_tiebreak",
    crop: { x: 444, y: 520 },
  },
  result_set3_home: {
    label: "Set 3 · games casa / home games",
    kind: "tennis_games",
    crop: { x: 144, y: 474 },
  },
  result_set3_away: {
    label: "Set 3 · games fora / away games",
    kind: "tennis_games",
    crop: { x: 244, y: 474 },
  },
  result_set3_tiebreak_home: {
    label: "Set 3 · tie-break casa / home",
    kind: "tennis_tiebreak",
    crop: { x: 344, y: 474 },
  },
  result_set3_tiebreak_away: {
    label: "Set 3 · tie-break fora / away",
    kind: "tennis_tiebreak",
    crop: { x: 444, y: 474 },
  },
  result_walkover: {
    label: "W.O. / Walkover",
    kind: "walkover",
    crop: { x: 32, y: 392 },
  },
  result_walkover_winner: {
    label: "Vencedor do W.O. / Walkover winner",
    kind: "walkover_winner",
    crop: { x: 352, y: 388 },
  },
  result_home_aces: {
    label: "Aces da casa / Home aces",
    kind: "tennis_stat",
    crop: { x: 144, y: 342 },
  },
  result_away_aces: {
    label: "Aces do visitante / Away aces",
    kind: "tennis_stat",
    crop: { x: 324, y: 342 },
  },
  result_home_double_faults: {
    label: "Duplas faltas da casa / Home double faults",
    kind: "tennis_stat",
    crop: { x: 144, y: 296 },
  },
  result_away_double_faults: {
    label: "Duplas faltas do visitante / Away double faults",
    kind: "tennis_stat",
    crop: { x: 324, y: 296 },
  },
  result_notes: {
    label: "Observações / Notes",
    kind: "notes",
    crop: { x: 32, y: 164 },
  },
};

function fieldMeta(fieldKey: string): FieldMeta {
  return (
    TENNIS_FIELD_META[fieldKey] ??
    FOOTBALL_FIELD_META[fieldKey] ?? {
      label: fieldKey,
      kind: "notes",
      crop: { x: 40, y: 40 },
    }
  );
}

function cropBox(fieldKey: string) {
  const meta = fieldMeta(fieldKey);
  return {
    x: meta.crop.x,
    y: meta.crop.y,
    width: meta.kind === "notes" ? 515 : 172,
    height: meta.kind === "notes" ? 76 : 34,
  };
}

function normalizeInteger(raw: string | null, max: number) {
  const value = raw?.trim() ?? "";
  if (!value) {
    return { normalized: null, flags: ["missing"] };
  }
  if (!/^\d{1,3}$/.test(value)) {
    return { normalized: null, flags: ["invalid_integer"] };
  }
  const number = Number(value);
  if (number > max) {
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
  const meta = fieldMeta(fieldKey);
  let normalizedValue = rawValue;
  let flags: string[] = [];

  if (
    meta.kind === "football_score" ||
    meta.kind === "tennis_games" ||
    meta.kind === "tennis_tiebreak" ||
    meta.kind === "tennis_stat"
  ) {
    const max =
      meta.kind === "football_score"
        ? 30
        : meta.kind === "tennis_games"
          ? 7
          : meta.kind === "tennis_tiebreak"
            ? 30
            : 100;
    const normalized = normalizeInteger(rawValue, max);
    normalizedValue = normalized.normalized;
    flags = normalized.flags;
  } else if (meta.kind === "walkover") {
    normalizedValue = rawValue === "true" ? "true" : "false";
    flags = [];
  } else if (meta.kind === "walkover_winner") {
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
    label: meta.label,
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

function readAcroformFields(
  pdf: PDFDocument,
  sport: ScoresheetSport,
  fieldKeys: readonly string[],
) {
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
    walkoverWinner =
      form.getDropdown("result_walkover_winner").getSelected()[0] ?? "";
  } catch {
    walkoverWinner = "";
  }

  const raw: Record<string, string | null> = {};
  for (const key of fieldKeys) {
    if (key === "result_walkover") {
      raw[key] = walkover ? "true" : "false";
    } else if (key === "result_walkover_winner") {
      raw[key] = walkoverWinner;
    } else {
      raw[key] = textValue(key);
    }
  }

  return {
    raw,
    sheetId: textValue("identity_sheet_id"),
    templateVersion: textValue("identity_template_version"),
    sport,
  };
}

function footballSeededValues(matchNumber: number) {
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

function tennisSeededValues(matchNumber: number) {
  const patterns = [
    ["6", "4", "6", "3", "", ""],
    ["4", "6", "6", "3", "6", "2"],
    ["7", "6", "6", "4", "", ""],
    ["6", "2", "3", "6", "7", "5"],
  ] as const;
  const [s1h, s1a, s2h, s2a, s3h, s3a] =
    patterns[matchNumber % patterns.length]!;
  const tiebreak = s1h === "7" && s1a === "6";
  return {
    result_set1_home: s1h,
    result_set1_away: s1a,
    result_set1_tiebreak_home: tiebreak ? "7" : "",
    result_set1_tiebreak_away: tiebreak ? "5" : "",
    result_set2_home: s2h,
    result_set2_away: s2a,
    result_set2_tiebreak_home: "",
    result_set2_tiebreak_away: "",
    result_set3_home: s3h,
    result_set3_away: s3a,
    result_set3_tiebreak_home: "",
    result_set3_tiebreak_away: "",
    result_walkover: "false",
    result_walkover_winner: "",
    result_home_aces: String(4 + (matchNumber % 6)),
    result_away_aces: String(3 + (matchNumber % 5)),
    result_home_double_faults: String(1 + (matchNumber % 4)),
    result_away_double_faults: String(2 + (matchNumber % 3)),
    result_notes:
      "Valores representativos de tênis (OCR local não configurado). Representative tennis values (local OCR unavailable).",
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
  const sport = input.sport;
  const fieldKeys = scoresheetFieldKeys(sport);
  const templateVersion = scoresheetTemplateVersion(sport);
  const expectedIdentity = scoresheetIdentityForMatch(input.matchId, sport);
  const acroform = readAcroformFields(pdf, sport, fieldKeys);

  if (acroform) {
    const fields = fieldKeys.map((fieldKey) =>
      fieldFromRaw(fieldKey, acroform.raw[fieldKey] ?? null, 100, "acroform"),
    );

    const identityMismatch =
      acroform.sheetId != null &&
      acroform.sheetId.length > 0 &&
      acroform.sheetId !== expectedIdentity.sheetId;

    return {
      source: "acroform",
      sheetId: acroform.sheetId || expectedIdentity.sheetId,
      templateVersion: acroform.templateVersion || templateVersion,
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
  const seeded =
    sport === "tennis"
      ? tennisSeededValues(input.matchNumber)
      : footballSeededValues(input.matchNumber);
  const fields = fieldKeys.map((fieldKey, index) => {
    const confidence = [84, 61, 76, 68, 90, 80, 74, 72, 66, 78][index] ?? 70;
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
    if (
      fieldKey.startsWith("result_set") ||
      fieldKey.includes("goals") ||
      fieldKey.includes("penalty")
    ) {
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
    templateVersion,
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

export { FOOTBALL_FIELD_KEYS, FOOTBALL_TEMPLATE_VERSION, TENNIS_FIELD_KEYS, TENNIS_TEMPLATE_VERSION };
