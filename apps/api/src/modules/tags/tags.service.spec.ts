import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { Prisma } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { CreateTagDto } from './dto/tag.dto.js';
import { MAX_TAGS_PER_USER, TagsService } from './tags.service.js';

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError(code, { code, clientVersion: '7.10.0' });

describe('TagsService', () => {
  const prisma = {
    tag: { findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  };
  const service = new TagsService(prisma as unknown as PrismaService);

  beforeEach(() => vi.clearAllMocks());

  it('liste les tags avec leur utilisation', async () => {
    prisma.tag.findMany.mockResolvedValue([
      { id: 't1', name: 'angular', color: null, _count: { projects: 2, notes: 1 } },
    ]);

    await expect(service.findAll('user-1')).resolves.toEqual([
      { id: 't1', name: 'angular', color: null, usage: { projects: 2, notes: 1 } },
    ]);
    expect(prisma.tag.findMany.mock.calls[0][0]).toMatchObject({
      where: { userId: 'user-1' },
      orderBy: { name: 'asc' },
    });
  });

  it('traduit un nom déjà pris en 409', async () => {
    prisma.tag.count.mockResolvedValue(0);
    prisma.tag.create.mockRejectedValue(prismaError('P2002'));

    await expect(service.create('user-1', { name: 'angular' })).rejects.toThrow(
      new ConflictException('Un tag porte déjà ce nom'),
    );
  });

  it(`refuse au-delà de ${MAX_TAGS_PER_USER} tags`, async () => {
    prisma.tag.count.mockResolvedValue(MAX_TAGS_PER_USER);

    await expect(service.create('user-1', { name: 'un-de-trop' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.tag.create).not.toHaveBeenCalled();
  });

  it('update et remove renvoient 404 pour le tag d’un autre utilisateur', async () => {
    prisma.tag.update.mockRejectedValue(prismaError('P2025'));
    prisma.tag.delete.mockRejectedValue(prismaError('P2025'));

    await expect(service.update('user-1', 't9', { name: 'x' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.remove('user-1', 't9')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.tag.delete).toHaveBeenCalledWith({ where: { id: 't9', userId: 'user-1' } });
  });

  describe('assertOwned', () => {
    it('accepte des tags qui appartiennent tous à l’utilisateur', async () => {
      prisma.tag.count.mockResolvedValue(2);

      await expect(service.assertOwned('user-1', ['t1', 't2'])).resolves.toBeUndefined();
      expect(prisma.tag.count).toHaveBeenCalledWith({
        where: { userId: 'user-1', id: { in: ['t1', 't2'] } },
      });
    });

    it('refuse si un seul tag est inconnu ou appartient à quelqu’un d’autre', async () => {
      prisma.tag.count.mockResolvedValue(1);

      await expect(service.assertOwned('user-1', ['t1', 'autre'])).rejects.toThrow(
        'Un ou plusieurs tags sont introuvables',
      );
    });

    it('n’interroge pas la base pour une liste vide', async () => {
      await service.assertOwned('user-1', []);
      expect(prisma.tag.count).not.toHaveBeenCalled();
    });
  });
});

describe('CreateTagDto', () => {
  it('normalise le nom : espaces superflus et minuscules', () => {
    const dto = plainToInstance(CreateTagDto, { name: '  Angular   JS ' });

    expect(validateSync(dto)).toEqual([]);
    expect(dto.name).toBe('angular js');
  });

  it('refuse un nom vide ou trop long', () => {
    expect(validateSync(plainToInstance(CreateTagDto, { name: '   ' }))).toHaveLength(1);
    expect(validateSync(plainToInstance(CreateTagDto, { name: 'x'.repeat(31) }))).toHaveLength(1);
  });
});
