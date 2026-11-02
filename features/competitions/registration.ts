export type RegistrationStatus = {
  open: boolean;
  deadlinePassed: boolean;
  closedByDeadline: boolean;
  generated: boolean;
  canReopen: boolean;
};

export type RegistrationInput = {
  registrationState: "open" | "closed";
  registrationDeadline: Date | null;
  drawGeneratedAt: Date | null;
  status?: string;
};

export function getRegistrationStatus(
  competition: RegistrationInput,
  now = new Date(),
): RegistrationStatus {
  const generated = competition.drawGeneratedAt != null;
  const deadlinePassed =
    competition.registrationDeadline != null &&
    competition.registrationDeadline.getTime() <= now.getTime();
  const closedByDeadline =
    competition.registrationState === "open" && deadlinePassed && !generated;
  const blockedByStatus =
    competition.status === "cancelled" || competition.status === "completed";
  const open =
    competition.registrationState === "open" &&
    !deadlinePassed &&
    !generated &&
    !blockedByStatus;

  return {
    open,
    deadlinePassed,
    closedByDeadline,
    generated,
    canReopen: !generated,
  };
}
