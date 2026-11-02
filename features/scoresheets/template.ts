import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

export const FOOTBALL_TEMPLATE_VERSION = "football-v1";
export const FOOTBALL_TEMPLATE_PAGE_COUNT = 1;

export const FOOTBALL_FIELD_KEYS = [
  "result_home_goals",
  "result_away_goals",
  "result_home_penalty",
  "result_away_penalty",
  "result_walkover",
  "result_walkover_winner",
  "result_notes",
] as const;

export type FootballFieldKey = (typeof FOOTBALL_FIELD_KEYS)[number];

export type ScoresheetIdentity = {
  sheetId: string;
  templateVersion: string;
  page: number;
};

export type FootballScoresheetInput = {
  matchId: string;
  matchNumber: number;
  eventName: string;
  competitionName: string;
  homeTeamName: string;
  awayTeamName: string;
  venueName: string | null;
  startsAt: Date | null;
  timezone: string;
};

export function scoresheetIdentityForMatch(
  matchId: string,
): ScoresheetIdentity {
  return {
    sheetId: `sheet-${matchId}`,
    templateVersion: FOOTBALL_TEMPLATE_VERSION,
    page: 1,
  };
}

function qrPayload(identity: ScoresheetIdentity) {
  return JSON.stringify({
    sheetId: identity.sheetId,
    templateVersion: identity.templateVersion,
    page: identity.page,
  });
}

function formatMatchDate(date: Date | null, timezone: string) {
  if (!date) {
    return "Data a definir / Date TBC";
  }
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function labelField(
  form: ReturnType<PDFDocument["getForm"]>,
  name: string,
  value: string,
  page: ReturnType<PDFDocument["addPage"]>,
) {
  const field = form.createTextField(name);
  field.addToPage(page, {
    x: -50,
    y: -50,
    width: 1,
    height: 1,
    borderWidth: 0,
  });
  field.setFontSize(7);
  field.setText(value);
  field.enableReadOnly();
  return field;
}

export async function buildFootballScoresheetPdf(
  input: FootballScoresheetInput,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const form = pdf.getForm();
  const identity = scoresheetIdentityForMatch(input.matchId);
  const qr = await QRCode.toBuffer(qrPayload(identity), {
    type: "png",
    margin: 1,
    width: 260,
    errorCorrectionLevel: "M",
  });
  const qrImage = await pdf.embedPng(qr);

  const green = rgb(0.09, 0.42, 0.27);
  const ink = rgb(0.09, 0.11, 0.1);
  const muted = rgb(0.38, 0.42, 0.4);
  const line = rgb(0.82, 0.83, 0.78);
  const lime = rgb(0.82, 0.91, 0.57);

  page.drawRectangle({
    x: 0,
    y: 756,
    width: 595.28,
    height: 85.89,
    color: green,
  });
  page.drawText("SUMMER CUP 2026", {
    x: 40,
    y: 806,
    size: 10,
    font: bold,
    color: lime,
  });
  page.drawText(input.competitionName, {
    x: 40,
    y: 784,
    size: 21,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(`${input.eventName} · Ficha de jogo / Scoresheet`, {
    x: 40,
    y: 768,
    size: 9,
    font,
    color: rgb(0.9, 0.95, 0.9),
  });
  page.drawText(`Jogo #${input.matchNumber}`, {
    x: 468,
    y: 805,
    size: 10,
    font: bold,
    color: lime,
  });

  page.drawImage(qrImage, { x: 455, y: 612, width: 100, height: 100 });
  page.drawText("QR: sheetId · template · page", {
    x: 438,
    y: 600,
    size: 7,
    font,
    color: muted,
  });
  page.drawText(identity.sheetId, {
    x: 40,
    y: 736,
    size: 7.5,
    font,
    color: muted,
  });
  page.drawText(
    `${identity.templateVersion} · page ${identity.page}`,
    { x: 40, y: 725, size: 7.5, font, color: muted },
  );

  const bodyY = 650;
  page.drawText(input.homeTeamName, {
    x: 96,
    y: bodyY + 20,
    size: 15,
    font: bold,
    color: ink,
  });
  page.drawText(input.awayTeamName, {
    x: 330,
    y: bodyY + 20,
    size: 15,
    font: bold,
    color: ink,
  });
  page.drawText("Casa / Home", {
    x: 96,
    y: bodyY + 44,
    size: 8,
    font,
    color: muted,
  });
  page.drawText("Visitante / Away", {
    x: 330,
    y: bodyY + 44,
    size: 8,
    font,
    color: muted,
  });

  page.drawText("Gols / Goals", {
    x: 40,
    y: bodyY - 2,
    size: 10,
    font: bold,
    color: ink,
  });
  page.drawText("Pênaltis / Penalties", {
    x: 40,
    y: bodyY - 76,
    size: 10,
    font: bold,
    color: ink,
  });
  page.drawText(
    "Pênaltis são usados apenas para decidir mata-mata empatado. Penalties decide knockout ties only.",
    { x: 40, y: bodyY - 90, size: 7.5, font, color: muted },
  );

  for (const [x, name] of [
    [96, "result_home_goals"],
    [330, "result_away_goals"],
  ] as const) {
    page.drawRectangle({
      x,
      y: bodyY - 38,
      width: 92,
      height: 38,
      borderColor: line,
      borderWidth: 1.2,
      color: rgb(1, 1, 1),
    });
    const field = form.createTextField(name);
    field.addToPage(page, {
      x: x + 4,
      y: bodyY - 34,
      width: 84,
      height: 30,
      borderWidth: 0,
      textColor: ink,
    });
    field.setFontSize(21);
    field.setMaxLength(3);
  }

  for (const [x, name] of [
    [96, "result_home_penalty"],
    [330, "result_away_penalty"],
  ] as const) {
    page.drawRectangle({
      x,
      y: bodyY - 112,
      width: 92,
      height: 34,
      borderColor: line,
      borderWidth: 1.2,
      color: rgb(1, 1, 1),
    });
    const field = form.createTextField(name);
    field.addToPage(page, {
      x: x + 4,
      y: bodyY - 108,
      width: 84,
      height: 27,
      borderWidth: 0,
      textColor: ink,
    });
    field.setFontSize(17);
    field.setMaxLength(3);
  }

  const walkover = form.createCheckBox("result_walkover");
  walkover.addToPage(page, {
    x: 40,
    y: bodyY - 154,
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: ink,
  });
  page.drawText("W.O. / Walkover", {
    x: 63,
    y: bodyY - 150,
    size: 10,
    font: bold,
    color: ink,
  });

  const winner = form.createDropdown("result_walkover_winner");
  winner.addOptions(["", "home", "away"]);
  winner.addToPage(page, {
    x: 190,
    y: bodyY - 158,
    width: 160,
    height: 24,
    borderWidth: 1,
    borderColor: line,
    textColor: ink,
  });
  winner.setFontSize(9);
  page.drawText("Vencedor W.O. / Winner", {
    x: 190,
    y: bodyY - 128,
    size: 7.5,
    font,
    color: muted,
  });

  page.drawText("Observações / Notes", {
    x: 40,
    y: bodyY - 214,
    size: 10,
    font: bold,
    color: ink,
  });
  const notes = form.createTextField("result_notes");
  notes.addToPage(page, {
    x: 40,
    y: bodyY - 296,
    width: 515,
    height: 70,
    borderWidth: 1,
    borderColor: line,
    textColor: ink,
  });
  notes.setFontSize(10);
  notes.enableMultiline();

  labelField(form, "identity_sheet_id", identity.sheetId, page);
  labelField(
    form,
    "identity_template_version",
    identity.templateVersion,
    page,
  );
  labelField(form, "identity_page", String(identity.page), page);

  page.drawLine({
    start: { x: 40, y: 155 },
    end: { x: 555, y: 155 },
    thickness: 0.8,
    color: line,
  });
  page.drawText("Assinatura do árbitro / Referee signature", {
    x: 40,
    y: 138,
    size: 9,
    font: bold,
    color: ink,
  });
  page.drawLine({
    start: { x: 40, y: 120 },
    end: { x: 300, y: 120 },
    thickness: 0.8,
    color: line,
  });
  page.drawText(
    "Preencha os gols e envie pelo portal. Preencha os campos ou imprima e escaneie. Não altere os campos de identidade.",
    { x: 40, y: 96, size: 7.5, font, color: muted },
  );

  page.drawText(
    `${formatMatchDate(input.startsAt, input.timezone)} · ${input.venueName ?? "Local a definir / Venue TBC"}`,
    { x: 40, y: 78, size: 8.5, font, color: muted },
  );

  form.updateFieldAppearances(font);
  return pdf.save();
}

export type DemoSheetMode = "digital" | "scan";

/**
 * Builds a deterministic filled sheet for the guided demo. The digital variant
 * keeps AcroForm values and deliberately includes one malformed value so the
 * review screen always has something to flag. The scan variant flattens the
 * form, which forces the QR/fixed-region fallback path.
 */
export async function buildDemoScoresheetPdf(
  input: FootballScoresheetInput,
  mode: DemoSheetMode,
): Promise<Uint8Array> {
  const blank = await buildFootballScoresheetPdf(input);
  const pdf = await PDFDocument.load(blank);
  const form = pdf.getForm();

  const homeScore = 1 + (input.matchNumber % 3);
  const awayScore = input.matchNumber % 4;
  const malformed = mode === "digital" ? `${awayScore}?` : String(awayScore);

  form.getTextField("result_home_goals").setText(String(homeScore));
  form.getTextField("result_away_goals").setText(malformed);
  form.getTextField("result_notes").setText(
    mode === "digital"
      ? "Folha de demonstração: um valor precisa de revisão."
      : "Digitalização de demonstração: extração por região fixa.",
  );

  if (mode === "scan") {
    form.flatten();
    const page = pdf.getPages()[0]!;
    const font = await pdf.embedFont(StandardFonts.HelveticaBold);
    page.drawText("SCAN DEMO · fixed-region fallback", {
      x: 388,
      y: 64,
      size: 7,
      font,
      color: rgb(0.65, 0.28, 0.12),
    });
  }

  return pdf.save();
}
