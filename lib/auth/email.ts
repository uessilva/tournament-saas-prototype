import { runEmailJob } from "@/lib/jobs/mail";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendInvitationEmail({
  to,
  eventId,
  invitationId,
  eventName,
  teamNames,
  url,
  expiresAt,
}: {
  to: string;
  eventId: string;
  invitationId: string;
  eventName: string;
  teamNames: string[];
  url: string;
  expiresAt: Date;
}) {
  const safeUrl = escapeHtml(url);
  const safeTeams = teamNames.map(escapeHtml).join(", ");
  const expiry = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(expiresAt);

  return runEmailJob({
    to,
    eventId,
    invitationId,
    purpose: "invitation",
    subject: `Convite para gerenciar equipes · ${eventName}`,
    text: [
      `Você foi convidado a gerenciar ${safeTeams} no ${eventName}.`,
      "Você foi convidado a gerenciar equipes no Summer Cup.",
      "You have been invited to manage teams at the Summer Cup.",
      "",
      url,
      "",
      `O convite expira em ${expiry}.`,
      `This invitation expires on ${expiry}.`,
      "",
      "Entre com o mesmo e-mail que recebeu este convite.",
      "Sign in with the same email address that received this invitation.",
    ].join("\n"),
    html: `
      <div style="background:#fbfaf6;padding:32px;font-family:Arial,Helvetica,sans-serif;color:#17231d">
        <div style="max-width:540px;margin:0 auto;background:#ffffff;border:1px solid #dce2dc;border-radius:18px;overflow:hidden">
          <div style="background:#176b46;padding:26px 30px;color:#ffffff">
            <div style="display:inline-block;background:#d8f36a;color:#17231d;border-radius:999px;padding:6px 10px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">${escapeHtml(eventName)}</div>
            <h1 style="margin:18px 0 0;font-size:28px;line-height:1.2">Gerencie suas equipes.</h1>
          </div>
          <div style="padding:30px">
            <p style="margin:0 0 12px;font-size:16px;line-height:1.6">Você foi convidado a gerenciar <strong>${safeTeams}</strong>. Use o botão abaixo para aceitar o convite.</p>
            <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#65736b">You have been invited to manage <strong>${safeTeams}</strong>. Use the button below to accept.</p>
            <a href="${safeUrl}" style="display:inline-block;background:#17231d;color:#ffffff;text-decoration:none;border-radius:10px;padding:13px 20px;font-weight:700">Aceitar convite / Accept invitation</a>
            <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#65736b">O convite expira em ${escapeHtml(expiry)}. Entre com o mesmo e-mail que recebeu esta mensagem.<br>This invitation expires on ${escapeHtml(expiry)}. Sign in with the same email address that received this message.</p>
          </div>
        </div>
      </div>
    `,
  });
}

export async function sendMagicLinkEmail(email: string, url: string) {
  const safeUrl = escapeHtml(url);

  await runEmailJob(
    {
      to: email,
      purpose: "magic_link",
      subject: "Seu acesso ao Summer Cup 2026 / Your Summer Cup 2026 sign-in",
      text: [
      "Use o link abaixo para entrar no Summer Cup 2026.",
      "Use the link below to sign in to Summer Cup 2026.",
      "",
      url,
      "",
      "O link expira em 24 horas. Se você não pediu este acesso, ignore esta mensagem.",
      "This link expires in 24 hours. If you did not request it, ignore this message.",
    ].join("\n"),
    html: `
      <div style="background:#fbfaf6;padding:32px;font-family:Arial,Helvetica,sans-serif;color:#17231d">
        <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #dce2dc;border-radius:18px;overflow:hidden">
          <div style="background:#176b46;padding:26px 30px;color:#ffffff">
            <div style="display:inline-block;background:#d8f36a;color:#17231d;border-radius:999px;padding:6px 10px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Summer Cup 2026</div>
            <h1 style="margin:18px 0 0;font-size:28px;line-height:1.2">Entre no seu evento.</h1>
          </div>
          <div style="padding:30px">
            <p style="margin:0 0 12px;font-size:16px;line-height:1.6">Use o botão abaixo para acessar a administração do Summer Cup.</p>
            <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#65736b">Use the button below to sign in to the Summer Cup administration.</p>
            <a href="${safeUrl}" style="display:inline-block;background:#17231d;color:#ffffff;text-decoration:none;border-radius:10px;padding:13px 20px;font-weight:700">Entrar / Sign in</a>
            <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#65736b">O link expira em 24 horas. Se você não pediu este acesso, ignore esta mensagem.<br>This link expires in 24 hours. If you did not request it, ignore this message.</p>
          </div>
        </div>
      </div>
    `,
    },
    { throwOnError: true },
  );
}
