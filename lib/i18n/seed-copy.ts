import type { Locale } from "@/lib/i18n/dictionaries";

/**
 * The demo seed stores its editorial copy in Portuguese because it is also
 * shown in the Owner area. Public and guided screens pass it through this
 * lookup so the seeded display content follows the language switcher.
 *
 * User-entered content (team names, participant names, notes and reasons) is
 * intentionally not translated.
 */
const SEED_COPY: Record<string, Record<Locale, string>> = {
  "Dois esportes. Um verão inteiro de jogo.": {
    "pt-BR": "Dois esportes. Um verão inteiro de jogo.",
    en: "Two sports. A whole summer of play.",
  },
  "O Summer Cup reúne futebol de base e tênis em uma semana de competição no Parque Esportivo do Sol. Acompanhe cada rodada, resultado e classificação sem precisar criar uma conta.":
    {
      "pt-BR":
        "O Summer Cup reúne futebol de base e tênis em uma semana de competição no Parque Esportivo do Sol. Acompanhe cada rodada, resultado e classificação sem precisar criar uma conta.",
      en: "The Summer Cup brings youth football and tennis together for a week of competition at Parque Esportivo do Sol. Follow every round, result and table without creating an account.",
    },
  "Oito equipes, dois grupos e mata-mata. O futebol Sub-12 abre o Summer Cup com jogos curtos, intensos e muita torcida.":
    {
      "pt-BR":
        "Oito equipes, dois grupos e mata-mata. O futebol Sub-12 abre o Summer Cup com jogos curtos, intensos e muita torcida.",
      en: "Eight teams, two groups and a knockout stage. Under-12 Football opens the Summer Cup with short, intense matches and plenty of support.",
    },
  "Singles aberto em dois grupos, com os dois melhores de cada grupo avançando para as semifinais. Sets de melhor de três.":
    {
      "pt-BR":
        "Singles aberto em dois grupos, com os dois melhores de cada grupo avançando para as semifinais. Sets de melhor de três.",
      en: "Open singles across two groups, with the top two from each group advancing to the semi-finals. Best-of-three sets.",
    },
  "Atletas nascidos entre 1º de janeiro de 2014 e 31 de dezembro de 2015. Elencos de 9 a 14 jogadores.":
    {
      "pt-BR":
        "Atletas nascidos entre 1º de janeiro de 2014 e 31 de dezembro de 2015. Elencos de 9 a 14 jogadores.",
      en: "Players born between 1 January 2014 and 31 December 2015. Squads of 9 to 14 players.",
    },
  "Entrada individual. Cada inscrito compete como uma equipe de um participante.":
    {
      "pt-BR":
        "Entrada individual. Cada inscrito compete como uma equipe de um participante.",
      en: "Individual entry. Each entrant competes as a one-participant team.",
    },
  "Under-12 Football": {
    "pt-BR": "Futebol Sub-12",
    en: "Under-12 Football",
  },
  "Tennis Open": {
    "pt-BR": "Tênis Open",
    en: "Tennis Open",
  },
  "Campo Principal": {
    "pt-BR": "Campo Principal",
    en: "Main Pitch",
  },
  "Campo 2": {
    "pt-BR": "Campo 2",
    en: "Pitch 2",
  },
  "Quadra Central": {
    "pt-BR": "Quadra Central",
    en: "Centre Court",
  },
  "Quadra 2": {
    "pt-BR": "Quadra 2",
    en: "Court 2",
  },
};

/** Returns the localized seeded display string, or the original value. */
export function localizeSeedText(
  value: string | null | undefined,
  locale: Locale,
): string | null {
  if (!value) {
    return null;
  }
  return SEED_COPY[value]?.[locale] ?? value;
}
