"use client";

import { useI18n } from "@/lib/i18n/client";
import { groupDisplayName } from "@/features/public/labels";
import type {
  CompetitionGroup,
  CompetitionStandingRow,
} from "@/features/competitions/types";
import type { FootballStandingRow } from "@/features/competitions/football-standings";
import type { TennisStandingRow } from "@/features/competitions/tennis-standings";
import type { Sport } from "@/features/public/types";

function Signed(value: number) {
  if (value === 0) {
    return "0";
  }
  return value > 0 ? `+${value}` : String(value);
}

function footballRow(row: CompetitionStandingRow): FootballStandingRow | null {
  return "goalsFor" in row ? row : null;
}

function tennisRow(row: CompetitionStandingRow): TennisStandingRow | null {
  return "setsWon" in row ? row : null;
}

export function StandingsTable({
  group,
  sport,
  qualifiersPerGroup,
  showCaption = true,
}: {
  group: CompetitionGroup;
  sport: Sport;
  qualifiersPerGroup: number;
  showCaption?: boolean;
}) {
  const { t } = useI18n();
  const isFootball = sport === "football";
  const hasSeededDraw =
    isFootball && group.seededDraws.some((draw) => draw.teamIds.length > 1);

  return (
    <div>
      <h3 className="text-sm font-extrabold">
        {groupDisplayName(group.name, t)}
      </h3>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-sm">
          {showCaption ? (
            <caption className="sr-only">
              {groupDisplayName(group.name, t)} — {t("competition.standings")}
            </caption>
          ) : null}
          <thead>
            <tr className="border-b border-line text-[10px] uppercase tracking-[0.1em] text-muted">
              <th scope="col" className="py-2 pr-2 font-extrabold">
                {t("standings.pos")}
              </th>
              <th scope="col" className="py-2 pr-2 font-extrabold">
                {t("standings.entrant")}
              </th>
              <th scope="col" className="py-2 pr-2 text-center font-extrabold">
                {t("standings.played")}
              </th>
              <th scope="col" className="py-2 pr-2 text-center font-extrabold">
                {t("standings.won")}
              </th>
              {isFootball ? (
                <th scope="col" className="py-2 pr-2 text-center font-extrabold">
                  {t("standings.drawn")}
                </th>
              ) : null}
              <th scope="col" className="py-2 pr-2 text-center font-extrabold">
                {t("standings.lost")}
              </th>
              {isFootball ? (
                <>
                  <th scope="col" className="py-2 pr-2 text-center font-extrabold">
                    {t("standings.goalsFor")}
                  </th>
                  <th scope="col" className="py-2 pr-2 text-center font-extrabold">
                    {t("standings.goalsAgainst")}
                  </th>
                  <th scope="col" className="py-2 pr-2 text-center font-extrabold">
                    {t("standings.goalDifference")}
                  </th>
                </>
              ) : (
                <>
                  <th scope="col" className="py-2 pr-2 text-center font-extrabold">
                    {t("standings.sets")}
                  </th>
                  <th scope="col" className="py-2 pr-2 text-center font-extrabold">
                    {t("standings.games")}
                  </th>
                </>
              )}
              <th scope="col" className="py-2 text-center font-extrabold">
                {t("standings.points")}
              </th>
            </tr>
          </thead>
          <tbody>
            {group.standings.map((row, index) => {
              const football = footballRow(row);
              const tennis = tennisRow(row);
              return (
                <tr
                  key={row.teamId}
                  className={`border-b border-line/70 last:border-b-0 ${
                    index < qualifiersPerGroup ? "bg-soft-green/50" : ""
                  }`}
                >
                  <td className="py-2.5 pr-2 font-extrabold text-muted">
                    {index + 1}
                  </td>
                  <td className="py-2.5 pr-2 font-bold">
                    <span className="inline-flex items-center gap-1.5">
                      {index < qualifiersPerGroup ? (
                        <span
                          aria-hidden="true"
                          className="size-1.5 rounded-full bg-green"
                        />
                      ) : null}
                      {row.teamName}
                      {index < qualifiersPerGroup ? (
                        <span className="sr-only">
                          {t("standings.qualifier")}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="py-2.5 pr-2 text-center">{row.played}</td>
                  <td className="py-2.5 pr-2 text-center">
                    {football ? football.won : (tennis?.wins ?? 0)}
                  </td>
                  {isFootball ? (
                    <td className="py-2.5 pr-2 text-center">
                      {football ? football.drawn : 0}
                    </td>
                  ) : null}
                  <td className="py-2.5 pr-2 text-center">
                    {football ? football.lost : (tennis?.losses ?? 0)}
                  </td>
                  {isFootball ? (
                    <>
                      <td className="py-2.5 pr-2 text-center">
                        {football ? football.goalsFor : 0}
                      </td>
                      <td className="py-2.5 pr-2 text-center">
                        {football ? football.goalsAgainst : 0}
                      </td>
                      <td className="py-2.5 pr-2 text-center">
                        {football ? Signed(football.goalDifference) : "0"}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2.5 pr-2 text-center">
                        {tennis ? Signed(tennis.setDifference) : "0"}
                      </td>
                      <td className="py-2.5 pr-2 text-center">
                        {tennis ? Signed(tennis.gameDifference) : "0"}
                      </td>
                    </>
                  )}
                  <td className="py-2.5 text-center text-lg font-extrabold">
                    {row.points}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {hasSeededDraw ? (
        <p className="mt-2 rounded-lg bg-soft-orange px-2.5 py-1.5 text-[11px] font-semibold text-clay">
          {t("standings.seededDrawUsed").replace(
            "{teams}",
            group.seededDraws
              .map((draw) => draw.teamNames.join(" / "))
              .join("; "),
          )}
        </p>
      ) : null}
    </div>
  );
}
