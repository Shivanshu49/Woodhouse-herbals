import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  findBySlug(slug: string) {
    return this.prisma.category.findUnique({ where: { slug } });
  }
}
