import { ConflictException, NotFoundException } from '@nestjs/common';
import { TagsService } from './tags.service';
import { PrismaService } from '../prisma/prisma.service';

describe('TagsService', () => {
  let service: TagsService;
  let prisma: {
    tag: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      upsert: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      tag: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        upsert: jest.fn(),
      },
    };
    service = new TagsService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('normalizes the name and creates a tag', async () => {
      prisma.tag.findUnique.mockResolvedValue(null);
      prisma.tag.create.mockResolvedValue({ id: 1, name: 'weeknight' });

      const result = await service.create('  Weeknight  ');

      expect(prisma.tag.findUnique).toHaveBeenCalledWith({
        where: { name: 'weeknight' },
      });
      expect(prisma.tag.create).toHaveBeenCalledWith({
        data: { name: 'weeknight' },
      });
      expect(result).toEqual({ id: 1, name: 'weeknight' });
    });

    it('throws ConflictException when the name already exists', async () => {
      prisma.tag.findUnique.mockResolvedValue({ id: 1, name: 'weeknight' });

      await expect(service.create('weeknight')).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.tag.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('throws NotFoundException when the tag does not exist', async () => {
      prisma.tag.findUnique.mockResolvedValue(null);

      await expect(service.update(1, 'dinner')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.tag.update).not.toHaveBeenCalled();
    });

    it('returns the tag unchanged when the normalized name is the same', async () => {
      prisma.tag.findUnique.mockResolvedValueOnce({ id: 1, name: 'dinner' });

      const result = await service.update(1, 'Dinner');

      expect(prisma.tag.update).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 1, name: 'dinner' });
    });

    it('throws ConflictException when renaming to a name already in use', async () => {
      prisma.tag.findUnique
        .mockResolvedValueOnce({ id: 1, name: 'dinner' })
        .mockResolvedValueOnce({ id: 2, name: 'lunch' });

      await expect(service.update(1, 'lunch')).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.tag.update).not.toHaveBeenCalled();
    });

    it('renames the tag when the new name is free', async () => {
      prisma.tag.findUnique
        .mockResolvedValueOnce({ id: 1, name: 'dinner' })
        .mockResolvedValueOnce(null);
      prisma.tag.update.mockResolvedValue({ id: 1, name: 'weeknight-dinner' });

      const result = await service.update(1, 'Weeknight-Dinner');

      expect(prisma.tag.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { name: 'weeknight-dinner' },
      });
      expect(result).toEqual({ id: 1, name: 'weeknight-dinner' });
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when the tag does not exist', async () => {
      prisma.tag.findUnique.mockResolvedValue(null);

      await expect(service.remove(1)).rejects.toThrow(NotFoundException);
      expect(prisma.tag.delete).not.toHaveBeenCalled();
    });

    it('deletes the tag when it exists', async () => {
      prisma.tag.findUnique.mockResolvedValue({ id: 1, name: 'dinner' });
      prisma.tag.delete.mockResolvedValue({ id: 1, name: 'dinner' });

      const result = await service.remove(1);

      expect(prisma.tag.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual({ id: 1, name: 'dinner' });
    });
  });

  describe('resolveTagIds', () => {
    it('upserts each normalized, deduplicated name and returns their ids', async () => {
      prisma.tag.upsert
        .mockResolvedValueOnce({ id: 1, name: 'breakfast' })
        .mockResolvedValueOnce({ id: 2, name: 'weeknight' });

      const ids = await service.resolveTagIds([
        'Breakfast',
        'breakfast',
        ' Weeknight ',
      ]);

      expect(prisma.tag.upsert).toHaveBeenCalledTimes(2);
      expect(ids).toEqual([1, 2]);
    });

    it('returns an empty array for no names', async () => {
      const ids = await service.resolveTagIds([]);
      expect(ids).toEqual([]);
      expect(prisma.tag.upsert).not.toHaveBeenCalled();
    });
  });
});
