import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Manages the global (non-user-scoped) tag list, and resolves free-text tag
 * names to ids for recipes — creating any tags that don't exist yet.
 */
@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  normalize(name: string): string {
    return name.trim().toLowerCase();
  }

  findAll() {
    return this.prisma.tag.findMany({ orderBy: { name: 'asc' } });
  }

  /**
   * Creates a tag with a normalized name.
   * @throws ConflictException if a tag with that normalized name already exists.
   */
  async create(name: string) {
    const normalized = this.normalize(name);
    const existing = await this.prisma.tag.findUnique({
      where: { name: normalized },
    });
    if (existing) {
      throw new ConflictException(`Tag "${normalized}" already exists`);
    }
    return this.prisma.tag.create({ data: { name: normalized } });
  }

  /**
   * Renames a tag.
   * @throws NotFoundException if `id` doesn't exist.
   * @throws ConflictException if another tag already has the normalized name.
   */
  async update(id: number, name: string) {
    const tag = await this.prisma.tag.findUnique({ where: { id } });
    if (!tag) {
      throw new NotFoundException(`Tag ${id} not found`);
    }
    const normalized = this.normalize(name);
    if (normalized === tag.name) {
      return tag;
    }
    const existing = await this.prisma.tag.findUnique({
      where: { name: normalized },
    });
    if (existing) {
      throw new ConflictException(`Tag "${normalized}" already exists`);
    }
    return this.prisma.tag.update({
      where: { id },
      data: { name: normalized },
    });
  }

  /**
   * Deletes a tag.
   * @throws NotFoundException if `id` doesn't exist.
   */
  async remove(id: number) {
    const tag = await this.prisma.tag.findUnique({ where: { id } });
    if (!tag) {
      throw new NotFoundException(`Tag ${id} not found`);
    }
    return this.prisma.tag.delete({ where: { id } });
  }

  /** Normalizes a list of raw tag names, de-duplicating and dropping empty strings. */
  normalizeNames(names: string[]): string[] {
    return [
      ...new Set(names.map((name) => this.normalize(name)).filter(Boolean)),
    ];
  }

  /** Normalizes the given names and upserts a tag for each, returning their ids (creates any that don't already exist). */
  async resolveTagIds(names: string[]): Promise<number[]> {
    const normalized = this.normalizeNames(names);
    if (normalized.length === 0) {
      return [];
    }
    const tags = await Promise.all(
      normalized.map((name) =>
        this.prisma.tag.upsert({
          where: { name },
          update: {},
          create: { name },
        }),
      ),
    );
    return tags.map((tag) => tag.id);
  }
}
