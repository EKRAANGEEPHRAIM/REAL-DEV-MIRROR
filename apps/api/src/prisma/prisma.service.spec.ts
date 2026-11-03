import type { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { PrismaService } from './prisma.service.js';

describe('PrismaService', () => {
  const get = vi.fn(() => 'postgresql://user:pass@ep-test.neon.tech/devmirror');
  const config = { get } as unknown as ConfigService<EnvironmentVariables, true>;

  it('se connecte avec DATABASE_URL (aucune requête avant le premier appel)', () => {
    new PrismaService(config);
    expect(get).toHaveBeenCalledWith('DATABASE_URL', { infer: true });
  });

  it('ferme ses connexions à l’arrêt de l’application', async () => {
    const prisma = new PrismaService(config);
    const disconnect = vi.spyOn(prisma, '$disconnect').mockResolvedValue();

    await prisma.onModuleDestroy();

    expect(disconnect).toHaveBeenCalledOnce();
  });
});
