import { createTransport } from "nodemailer";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendMagicLinkEmail(email: string, url: string) {
  const transport = createTransport({
    host: process.env.SMTP_HOST ?? "127.0.0.1",
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: false,
    ignoreTLS: true,
  });

  const safeUrl = escapeHtml(url);
  const from = process.env.EMAIL_FROM ?? "Summer Cup <summercup@example.com>";

  await transport.sendMail({
    to: email,
    from,
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
  });
}
