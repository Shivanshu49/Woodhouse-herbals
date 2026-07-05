import { Controller, Get, Param, Post, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminAuditInterceptor } from '../../common/audit/admin-audit.interceptor';
import { InvoiceService } from './invoice.service';

// A tax invoice is a document, not money movement — ADMIN + MANAGER may view it.
const INVOICE_ROLES = [UserRole.ADMIN, UserRole.MANAGER];

@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AdminAuditInterceptor)
export class InvoicesController {
  constructor(private readonly invoices: InvoiceService) {}

  @Roles(...INVOICE_ROLES)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post(':id/invoice')
  generate(@Param('id') id: string) {
    return this.invoices.generateForOrder(id);
  }

  @Roles(...INVOICE_ROLES)
  @Get(':id/invoice')
  async get(@Param('id') id: string) {
    const inv = await this.invoices.getForOrder(id);
    return inv ? { number: inv.number, fy: inv.fy, issuedAt: inv.issuedAt } : null;
  }

  @Roles(...INVOICE_ROLES)
  @Get(':id/invoice/pdf')
  async pdf(@Param('id') id: string, @Res() res: Response) {
    const { buffer, filename } = await this.invoices.getPdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(buffer);
  }
}
