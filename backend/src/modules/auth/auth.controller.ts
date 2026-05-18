import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import {
  ForgotPasswordDto,
  ForgotPasswordSchema,
  LoginDto,
  LoginSchema,
  LogoutDto,
  LogoutSchema,
  RefreshDto,
  RefreshSchema,
  RegisterDto,
  RegisterSchema,
  ResetPasswordDto,
  ResetPasswordSchema,
} from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body(new ZodValidationPipe(RegisterSchema)) dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body(new ZodValidationPipe(LoginSchema)) dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body(new ZodValidationPipe(RefreshSchema)) dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async logout(@Body(new ZodValidationPipe(LogoutSchema)) dto: LogoutDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }

  @Post('password/forgot')
  @HttpCode(HttpStatus.OK)
  forgot(@Body(new ZodValidationPipe(ForgotPasswordSchema)) dto: ForgotPasswordDto) {
    return this.auth.forgotPassword({ phone: dto.phone, email: dto.email });
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  async reset(@Body(new ZodValidationPipe(ResetPasswordSchema)) dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto.phone, dto.code, dto.newPassword);
    return { ok: true };
  }
}
