import { ProjectRole } from '../../generated/prisma/client.js';
import type { MailMessage } from '../mail/mail.service.js';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const ROLE_LABEL: Record<ProjectRole, string> = {
  [ProjectRole.EDITOR]: 'éditeur (vous pourrez créer et déplacer les tâches)',
  [ProjectRole.VIEWER]: 'lecteur (vous pourrez suivre l’avancement)',
};

interface InvitationMail {
  to: string;
  inviterName: string;
  projectName: string;
  role: ProjectRole;
  link: string;
}

/** Email d'invitation à rejoindre un projet ; noms échappés (saisis par les utilisateurs). */
export function invitationEmail({
  to,
  inviterName,
  projectName,
  role,
  link,
}: InvitationMail): MailMessage {
  const inviter = escapeHtml(inviterName);
  const project = escapeHtml(projectName);
  return {
    to,
    subject: `${inviterName} vous invite sur « ${projectName} » — DevMirror`,
    html: `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:Segoe UI,Arial,sans-serif;color:#18181b">
    <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
      <tr><td>
        <p style="font-size:18px;font-weight:600;margin:0 0 16px">DevMirror</p>
        <p>Bonjour,</p>
        <p><strong>${inviter}</strong> vous invite à rejoindre le projet <strong>${project}</strong> en tant que ${ROLE_LABEL[role]}.</p>
        <p style="margin:28px 0">
          <a href="${escapeHtml(link)}" style="background:#18181b;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">Voir l’invitation</a>
        </p>
        <p style="font-size:13px;color:#71717a">Pas encore de compte ? Créez-le avec cette adresse email, l’invitation vous attendra. Ce lien expire dans 7 jours.</p>
        <p style="font-size:12px;color:#a1a1aa;word-break:break-all">${escapeHtml(link)}</p>
      </td></tr>
    </table>
  </body>
</html>`,
    text: `Bonjour,\n\n${inviterName} vous invite à rejoindre le projet « ${projectName} » sur DevMirror en tant que ${ROLE_LABEL[role]}.\n\nVoir l'invitation : ${link}\n\nPas encore de compte ? Créez-le avec cette adresse email. Ce lien expire dans 7 jours.`,
  };
}
