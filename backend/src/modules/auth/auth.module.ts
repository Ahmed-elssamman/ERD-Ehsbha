import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { loadEnv } from '../../config/env';
import { MailerModule } from '../mailer/mailer.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    MailerModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const env = loadEnv();
        return {
          secret: env.JWT_ACCESS_SECRET,
          signOptions: { expiresIn: env.JWT_ACCESS_TTL as any },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
