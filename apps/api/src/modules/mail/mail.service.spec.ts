import type { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import { MailService } from './mail.service.js';

const message = {
  to: 'ada@devmirror.dev',
  subject: 'Sujet',
  html: '<p>Lien</p>',
  text: 'Lien secret',
};

function serviceWith(env: Partial<EnvironmentVariables>): MailService {
  const values = {
    MAIL_FROM: 'DevMirror <noreply@devmirror.dev>',
    NODE_ENV: 'development',
    ...env,
  };
  const config = { get: (key: keyof EnvironmentVariables) => values[key] };
  return new MailService(config as unknown as ConfigService<EnvironmentVariables, true>);
}

describe('MailService', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('envoie l’email via l’API Resend quand la clé est configurée', async () => {
    fetchMock.mockResolvedValue(new Response('{"id":"1"}', { status: 200 }));

    await serviceWith({ RESEND_API_KEY: 're_test' }).send(message);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe('Bearer re_test');
    expect(JSON.parse(init.body)).toMatchObject({
      from: 'DevMirror <noreply@devmirror.dev>',
      to: ['ada@devmirror.dev'],
      subject: 'Sujet',
    });
  });

  it('lève une erreur si Resend refuse l’email', async () => {
    fetchMock.mockResolvedValue(new Response('domaine non vérifié', { status: 403 }));

    await expect(serviceWith({ RESEND_API_KEY: 're_test' }).send(message)).rejects.toThrow(/403/);
  });

  it('n’appelle pas Resend sans clé', async () => {
    await serviceWith({}).send(message);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
