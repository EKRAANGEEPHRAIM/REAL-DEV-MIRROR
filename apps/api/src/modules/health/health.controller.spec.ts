import { HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  const prisma = { $queryRaw: vi.fn() };
  const status = vi.fn();
  const res = { status } as unknown as Response;
  let controller: HealthController;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();

    controller = moduleRef.get(HealthController);
  });

  it('renvoie ok quand la base répond', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const result = await controller.check(res);

    expect(result).toMatchObject({ status: 'ok', database: 'up' });
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    expect(status).not.toHaveBeenCalled();
  });

  it('renvoie 503 et degraded quand la base est injoignable', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connexion refusée'));

    const result = await controller.check(res);

    expect(result).toMatchObject({ status: 'degraded', database: 'down' });
    expect(status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
  });
});
