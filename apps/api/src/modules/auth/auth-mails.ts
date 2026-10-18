import type { MailMessage } from '../mail/mail.service.js';

interface Recipient {
  email: string;
  name: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function layout(name: string, intro: string, cta: string, link: string, outro: string): string {
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:Segoe UI,Arial,sans-serif;color:#18181b">
    <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
      <tr><td>
        <p style="font-size:18px;font-weight:600;margin:0 0 16px">DevMirror</p>
        <p>Bonjour ${escapeHtml(name)},</p>
        <p>${intro}</p>
        <p style="margin:28px 0">
          <a href="${escapeHtml(link)}" style="background:#18181b;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">${cta}</a>
        </p>
        <p style="font-size:13px;color:#71717a">${outro}</p>
        <p style="font-size:12px;color:#a1a1aa;word-break:break-all">${escapeHtml(link)}</p>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function verificationEmail(user: Recipient, link: string): MailMessage {
  return {
    to: user.email,
    subject: 'Confirmez votre adresse email — DevMirror',
    html: layout(
      user.name,
      'Merci de votre inscription. Confirmez votre adresse email pour sécuriser votre compte.',
      'Confirmer mon email',
      link,
      'Ce lien expire dans 1 heure. Si vous n’êtes pas à l’origine de cette inscription, ignorez cet email.',
    ),
    text: `Bonjour ${user.name},\n\nConfirmez votre adresse email : ${link}\n\nCe lien expire dans 1 heure.`,
  };
}

export function passwordResetEmail(user: Recipient, link: string): MailMessage {
  return {
    to: user.email,
    subject: 'Réinitialisation de votre mot de passe — DevMirror',
    html: layout(
      user.name,
      'Vous avez demandé à réinitialiser votre mot de passe.',
      'Choisir un nouveau mot de passe',
      link,
      'Ce lien expire dans 1 heure et ne fonctionne qu’une fois. Si vous n’avez rien demandé, ignorez cet email : votre mot de passe reste inchangé.',
    ),
    text: `Bonjour ${user.name},\n\nChoisissez un nouveau mot de passe : ${link}\n\nCe lien expire dans 1 heure et ne fonctionne qu'une fois.`,
  };
}
