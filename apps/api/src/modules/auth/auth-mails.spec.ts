import { passwordResetEmail, verificationEmail } from './auth-mails.js';

describe('emails d’authentification', () => {
  const link = 'https://app.devmirror.dev/verify-email?token=abc';

  it('contiennent le lien dans les versions HTML et texte', () => {
    const mail = verificationEmail({ email: 'ada@devmirror.dev', name: 'Ada' }, link);

    expect(mail.to).toBe('ada@devmirror.dev');
    expect(mail.html).toContain(`href="${link}"`);
    expect(mail.text).toContain(link);
  });

  it('échappent le nom saisi par l’utilisateur (pas d’injection HTML)', () => {
    const mail = passwordResetEmail(
      { email: 'x@devmirror.dev', name: '<img src=x onerror=alert(1)>' },
      link,
    );

    expect(mail.html).not.toContain('<img');
    expect(mail.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});
