// Envio de e-mail via Resend. Configure no Railway:
//   RESEND_API_KEY  -> chave da sua conta Resend (https://resend.com)
//   EMAIL_FROM      -> remetente verificado, ex: "Sandra <nao-responder@seudominio.com.br>"
//                      (sem isso, usa o sandbox onboarding@resend.dev — só pra teste)

const KEY = process.env.RESEND_API_KEY || "";
const FROM = process.env.EMAIL_FROM || "Sandra <onboarding@resend.dev>";

export function emailEnabled() {
  return !!KEY;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!KEY) {
    console.warn("[email] RESEND_API_KEY ausente — e-mail não enviado:", subject, "->", to);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
    if (!res.ok) {
      console.error("[email] Resend falhou:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("[email] erro de rede:", e);
    return false;
  }
}

// Layout simples e branded pros e-mails
export function emailLayout(title: string, body: string, cta?: { label: string; url: string }) {
  return `<div style="font-family:'DM Sans',Arial,sans-serif;background:#f7f1e8;padding:32px">
    <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e6ddd0;border-radius:16px;overflow:hidden">
      <div style="background:#9250ac;color:#fff;padding:22px 28px;font-family:Georgia,serif;font-size:22px;font-weight:600">Sandra</div>
      <div style="padding:28px">
        <h1 style="font-family:Georgia,serif;font-size:20px;color:#33302c;margin:0 0 12px">${title}</h1>
        <div style="font-size:15px;color:#4a463f;line-height:1.6">${body}</div>
        ${cta ? `<div style="margin:22px 0 6px"><a href="${cta.url}" style="background:#9250ac;color:#fff;text-decoration:none;padding:11px 22px;border-radius:10px;font-weight:600;display:inline-block">${cta.label}</a></div><p style="font-size:12px;color:#9a938a">Se o botão não funcionar, copie e cole este link:<br>${cta.url}</p>` : ""}
      </div>
      <div style="padding:14px 28px;border-top:1px solid #e6ddd0;font-size:12px;color:#9a938a">Sandra · Gestão de tarefas do Grupo Gariglia</div>
    </div>
  </div>`;
}
