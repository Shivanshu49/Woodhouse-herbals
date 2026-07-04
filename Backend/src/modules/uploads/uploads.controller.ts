import { Body, Controller, HttpCode, Post, UseInterceptors } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { UploadsService } from './uploads.service';
import { SignUploadDto } from './dto/sign-upload.dto';
import { DeleteUploadDto } from './dto/delete-upload.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminAuditInterceptor } from '../../common/audit/admin-audit.interceptor';

@Controller('admin/uploads')
@Roles(UserRole.ADMIN, UserRole.MANAGER)
@UseInterceptors(AdminAuditInterceptor)
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  // Signatures are cheap but rate-limited anyway — a gallery upload burst
  // is ~10 signatures; 30/min leaves headroom without enabling abuse.
  @Throttle({ default: { ttl: 60 * 1000, limit: 30 } })
  @Post('sign')
  @HttpCode(200)
  sign(@Body() dto: SignUploadDto) {
    return this.uploads.sign(dto);
  }

  // Delete-on-remove: the product form calls this the moment an image uploaded
  // this session is removed, so it is never orphaned in Cloudinary. Scoped to
  // our own folders by DeleteUploadDto.
  @Throttle({ default: { ttl: 60 * 1000, limit: 30 } })
  @Post('delete')
  @HttpCode(200)
  remove(@Body() dto: DeleteUploadDto) {
    return this.uploads.destroy(dto.publicId);
  }
}
