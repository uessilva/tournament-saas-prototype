import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

export const FOOTBALL_TEMPLATE_VERSION = "football-v1";
export const FOOTBALL_TEMPLATE_PAGE_COUNT = 1;
export const TENNIS_TEMPLATE_VERSION = "tennis-v1";
export const TENNIS_TEMPLATE_PAGE_COUNT = 1;

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

export const TENNIS_FIELD_KEYS = [
  "result_set1_home",
  "result_set1_away",
  "result_set1_tiebreak_home",
  "result_set1_tiebreak_away",
  "result_set2_home",
  "result_set2_away",
  "result_set2_tiebreak_home",
  "result_set2_tiebreak_away",
  "result_set3_home",
  "result_set3_away",
  "result_set3_tiebreak_home",
  "result_set3_tiebreak_away",
  "result_walkover",
  "result_walkover_winner",
  "result_home_aces",
  "result_away_aces",
  "result_home_double_faults",
  "result_away_double_faults",
  "result_notes",
] as const;

export type TennisFieldKey = (typeof TENNIS_FIELD_KEYS)[number];

export type ScoresheetSport = "football" | "tennis";

export function scoresheetTemplateVersion(sport: ScoresheetSport) {
  return sport === "tennis" ? TENNIS_TEMPLATE_VERSION : FOOTBALL_TEMPLATE_VERSION;
}

export function scoresheetFieldKeys(sport: ScoresheetSport): readonly string[] {
  return sport === "tennis" ? TENNIS_FIELD_KEYS : FOOTBALL_FIELD_KEYS;
}


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

export type TennisScoresheetInput = FootballScoresheetInput;

export function scoresheetIdentityForMatch(
  matchId: string,
  sport: ScoresheetSport = "football",
): ScoresheetIdentity {
  return {
    sheetId: `sheet-${matchId}`,
    templateVersion: scoresheetTemplateVersion(sport),
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
  const identity = scoresheetIdentityForMatch(input.matchId, "football");
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

export async function buildTennisScoresheetPdf(
  input: TennisScoresheetInput,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const form = pdf.getForm();
  const identity = scoresheetIdentityForMatch(input.matchId, "tennis");
  const qr = await QRCode.toBuffer(qrPayload(identity), {
    type: "png",
    margin: 1,
    width: 260,
    errorCorrectionLevel: "M",
  });
  const qrImage = await pdf.embedPng(qr);

  const green = rgb(0.09, 0.42, 0.27);
  const clay = rgb(0.78, 0.42, 0.18);
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
  page.drawText(`${input.eventName} · Ficha de tênis / Tennis scoresheet`, {
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
  page.drawText(`${identity.templateVersion} · page ${identity.page}`, {
    x: 40,
    y: 725,
    size: 7.5,
    font,
    color: muted,
  });

  page.drawText(input.homeTeamName, {
    x: 96,
    y: 686,
    size: 15,
    font: bold,
    color: ink,
  });
  page.drawText(input.awayTeamName, {
    x: 330,
    y: 686,
    size: 15,
    font: bold,
    color: ink,
  });
  page.drawText("Casa / Home", {
    x: 96,
    y: 706,
    size: 8,
    font,
    color: muted,
  });
  page.drawText("Visitante / Away", {
    x: 330,
    y: 706,
    size: 8,
    font,
    color: muted,
  });

  page.drawText("Sets · melhor de três / best of three", {
    x: 40,
    y: 650,
    size: 10,
    font: bold,
    color: clay,
  });
  page.drawText(
    "Sets vencedores em 6 games, 7–5 ou 7–6 com tie-break. O terceiro set é completo (sem match tie-break).",
    { x: 40, y: 638, size: 7.5, font, color: muted },
  );

  const setLabels = ["Set 1", "Set 2", "Set 3"];
  const columnX = [40, 150, 250, 350, 450];
  page.drawText("", { x: columnX[0]!, y: 612, size: 8, font, color: muted });
  page.drawText("Games casa", { x: columnX[1]!, y: 612, size: 8, font: bold, color: ink });
  page.drawText("Games fora", { x: columnX[2]!, y: 612, size: 8, font: bold, color: ink });
  page.drawText("TB casa", { x: columnX[3]!, y: 612, size: 8, font: bold, color: ink });
  page.drawText("TB fora", { x: columnX[4]!, y: 612, size: 8, font: bold, color: ink });

  const setKeys = [
    ["result_set1_home", "result_set1_away", "result_set1_tiebreak_home", "result_set1_tiebreak_away"],
    ["result_set2_home", "result_set2_away", "result_set2_tiebreak_home", "result_set2_tiebreak_away"],
    ["result_set3_home", "result_set3_away", "result_set3_tiebreak_home", "result_set3_tiebreak_away"],
  ] as const;

  setKeys.forEach((keys, index) => {
    const y = 566 - index * 46;
    page.drawText(setLabels[index]!, {
      x: columnX[0]!,
      y: y + 9,
      size: 10,
      font: bold,
      color: ink,
    });
    keys.forEach((key, column) => {
      page.drawRectangle({
        x: columnX[column + 1]!,
        y,
        width: 76,
        height: 30,
        borderColor: line,
        borderWidth: 1.2,
        color: rgb(1, 1, 1),
      });
      const field = form.createTextField(key);
      field.addToPage(page, {
        x: columnX[column + 1]! + 4,
        y: y + 4,
        width: 68,
        height: 22,
        borderWidth: 0,
        textColor: ink,
      });
      field.setFontSize(15);
      field.setMaxLength(2);
    });
  });

  const walkover = form.createCheckBox("result_walkover");
  walkover.addToPage(page, {
    x: 40,
    y: 400,
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: ink,
  });
  page.drawText("W.O. / Walkover (6–0, 6–0 para a classificação)", {
    x: 63,
    y: 404,
    size: 9.5,
    font: bold,
    color: ink,
  });

  const winner = form.createDropdown("result_walkover_winner");
  winner.addOptions(["", "home", "away"]);
  winner.addToPage(page, {
    x: 360,
    y: 396,
    width: 165,
    height: 24,
    borderWidth: 1,
    borderColor: line,
    textColor: ink,
  });
  winner.setFontSize(9);
  page.drawText("Vencedor W.O. / Winner", {
    x: 360,
    y: 426,
    size: 7.5,
    font,
    color: muted,
  });

  page.drawText("Aces", {
    x: 40,
    y: 356,
    size: 10,
    font: bold,
    color: clay,
  });
  page.drawText("Duplas faltas / Double faults", {
    x: 40,
    y: 310,
    size: 10,
    font: bold,
    color: clay,
  });

  for (const [x, label, key] of [
    [150, "Casa / Home", "result_home_aces"],
    [330, "Fora / Away", "result_away_aces"],
    [150, "Casa / Home", "result_home_double_faults"],
    [330, "Fora / Away", "result_away_double_faults"],
  ] as const) {
    const isAces = key.endsWith("aces");
    const y = isAces ? 342 : 296;
    page.drawText(label, {
      x,
      y: y + 30,
      size: 7.5,
      font,
      color: muted,
    });
    page.drawRectangle({
      x,
      y,
      width: 110,
      height: 26,
      borderColor: line,
      borderWidth: 1.2,
      color: rgb(1, 1, 1),
    });
    const field = form.createTextField(key);
    field.addToPage(page, {
      x: x + 4,
      y: y + 4,
      width: 102,
      height: 18,
      borderWidth: 0,
      textColor: ink,
    });
    field.setFontSize(12);
    field.setMaxLength(3);
  }

  page.drawText("Observações / Notes", {
    x: 40,
    y: 250,
    size: 10,
    font: bold,
    color: ink,
  });
  const notes = form.createTextField("result_notes");
  notes.addToPage(page, {
    x: 40,
    y: 170,
    width: 515,
    height: 66,
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
    start: { x: 40, y: 150 },
    end: { x: 555, y: 150 },
    thickness: 0.8,
    color: line,
  });
  page.drawText("Assinatura do árbitro / Referee signature", {
    x: 40,
    y: 132,
    size: 9,
    font: bold,
    color: ink,
  });
  page.drawLine({
    start: { x: 40, y: 116 },
    end: { x: 300, y: 116 },
    thickness: 0.8,
    color: line,
  });
  page.drawText(
    "Preencha os sets, tie-breaks e estatísticas ou imprima e escaneie. Não altere a identidade QR.",
    { x: 40, y: 94, size: 7.5, font, color: muted },
  );
  page.drawText(
    `${formatMatchDate(input.startsAt, input.timezone)} · ${input.venueName ?? "Local a definir / Venue TBC"}`,
    { x: 40, y: 76, size: 8.5, font, color: muted },
  );

  form.updateFieldAppearances(font);
  return pdf.save();
}

export type DemoScoresheetMode = "digital" | "scan";
export type DemoSheetMode = DemoScoresheetMode;

/**
 * Builds a deterministic filled football sheet for the guided demo. The digital
 * variant keeps AcroForm values and deliberately includes one malformed value
 * so the review screen always has something to flag. The scan variant flattens
 * the form, which forces the QR/fixed-region fallback path.
 */
export async function buildDemoScoresheetPdf(
  input: FootballScoresheetInput,
  mode: DemoScoresheetMode,
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

const TENNIS_DEMO_PATTERNS = [
  [{ home: 6, away: 4 }, { home: 6, away: 3 }, null],
  [{ home: 4, away: 6 }, { home: 6, away: 3 }, { home: 6, away: 2 }],
  [{ home: 7, away: 6, tiebreakHome: 7, tiebreakAway: 5 }, { home: 6, away: 4 }, null],
  [{ home: 6, away: 2 }, { home: 3, away: 6 }, { home: 7, away: 5 }],
] as const;

/**
 * Builds a deterministic tennis sheet. Digital keeps AcroForm values and
 * deliberately includes one malformed games value; scan flattens the form so
 * the QR/fixed-region fallback is used.
 */
export async function buildDemoTennisScoresheetPdf(
  input: TennisScoresheetInput,
  mode: DemoScoresheetMode,
): Promise<Uint8Array> {
  const blank = await buildTennisScoresheetPdf(input);
  const pdf = await PDFDocument.load(blank);
  const form = pdf.getForm();
  const pattern = TENNIS_DEMO_PATTERNS[input.matchNumber % TENNIS_DEMO_PATTERNS.length]!;

  pattern.forEach((set, index) => {
    if (!set) {
      return;
    }
    const number = index + 1;
    form
      .getTextField(`result_set${number}_home`)
      .setText(String(set.home));
    form
      .getTextField(`result_set${number}_away`)
      .setText(
        mode === "digital" && index === 1
          ? `${set.away}?`
          : String(set.away),
      );
    if ("tiebreakHome" in set && "tiebreakAway" in set) {
      form
        .getTextField(`result_set${number}_tiebreak_home`)
        .setText(String(set.tiebreakHome));
      form
        .getTextField(`result_set${number}_tiebreak_away`)
        .setText(String(set.tiebreakAway));
    }
  });

  form
    .getTextField("result_home_aces")
    .setText(String(5 + (input.matchNumber % 6)));
  form
    .getTextField("result_away_aces")
    .setText(String(3 + (input.matchNumber % 5)));
  form
    .getTextField("result_home_double_faults")
    .setText(String(1 + (input.matchNumber % 4)));
  form
    .getTextField("result_away_double_faults")
    .setText(String(2 + (input.matchNumber % 3)));
  form.getTextField("result_notes").setText(
    mode === "digital"
      ? "Ficha de tênis de demonstração: um valor precisa de revisão."
      : "Digitalização de tênis de demonstração: extração por região fixa.",
  );

  if (mode === "scan") {
    form.flatten();
    const page = pdf.getPages()[0]!;
    const font = await pdf.embedFont(StandardFonts.HelveticaBold);
    page.drawText("SCAN DEMO · fixed-region fallback", {
      x: 388,
      y: 60,
      size: 7,
      font,
      color: rgb(0.65, 0.28, 0.12),
    });
  }

  return pdf.save();
}
