import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class ConcernsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.concern.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  findBySlug(slug: string) {
    return this.prisma.concern.findUnique({
      where: { slug },
      include: { products: { include: { product: true } } },
    });
  }
}
