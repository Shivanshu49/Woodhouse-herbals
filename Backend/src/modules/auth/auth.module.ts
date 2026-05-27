import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { env } from '../../common/config/env';

@Module({
  imports: [
    // JwtModule is configured per-call in AuthService (different secrets/TTL
    // for access vs refresh), but we register a default with the access secret
    // so injected JwtService works for guards.
    JwtModule.register({
      global: true,
      secret: env.JWT_ACCESS_SECRET,
      signOptions: { expiresIn: env.JWT_ACCESS_TTL },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
