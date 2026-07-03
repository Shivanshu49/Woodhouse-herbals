import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AdminAuditInterceptor } from './admin-audit.interceptor';

// Global so every admin module can @UseInterceptors(AdminAuditInterceptor)
// and inject AuditService without importing this module each time.
@Global()
@Module({
  providers: [AuditService, AdminAuditInterceptor],
  exports: [AuditService, AdminAuditInterceptor],
})
export class AuditModule {}
