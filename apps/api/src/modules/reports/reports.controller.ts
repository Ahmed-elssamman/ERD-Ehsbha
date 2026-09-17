import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CreateReportSchema, ReportHistoryQuerySchema, ReportListQuerySchema, ReportVersionSchema, ReviseReportSchema, UpdateReportPreferencesSchema,
  type CreateReport, type ReportHistoryQuery, type ReportListQuery, type ReviseReport, type UpdateReportPreferences } from '@ehsbha/api-contracts';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentDriverId } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import { ReportsService } from './reports.service';
import { ReportPreferencesService } from './report-preferences.service';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private reports: ReportsService, private preferences: ReportPreferencesService) {}
  @Get('preferences')
  getPreferences(@CurrentDriverId() driverId: string) { return this.preferences.get(driverId); }
  @Patch('preferences')
  updatePreferences(@CurrentDriverId() driverId: string, @Body(new ZodValidationPipe(UpdateReportPreferencesSchema)) body: UpdateReportPreferences) { return this.preferences.update(driverId, body); }
  @Get()
  list(@CurrentDriverId() driverId: string, @Query(new ZodValidationPipe(ReportListQuerySchema)) query: ReportListQuery) { return this.reports.list(driverId, query); }
  @Post()
  create(@CurrentDriverId() driverId: string, @Body(new ZodValidationPipe(CreateReportSchema)) body: CreateReport) { return this.reports.create(driverId, body); }
  @Get(':id')
  get(@CurrentDriverId() driverId: string, @Param('id') id: string) { return this.reports.get(driverId, id); }
  @Post(':id/revisions')
  revise(@CurrentDriverId() driverId: string, @Param('id') id: string, @Body(new ZodValidationPipe(ReviseReportSchema)) body: ReviseReport) { return this.reports.revise(driverId, id, body); }
  @Get(':id/revisions')
  history(@CurrentDriverId() driverId: string, @Param('id') id: string, @Query(new ZodValidationPipe(ReportHistoryQuerySchema)) query: ReportHistoryQuery) { return this.reports.history(driverId, id, query); }
  @Get(':id/revisions/:version')
  revision(@CurrentDriverId() driverId: string, @Param('id') id: string, @Param('version', new ZodValidationPipe(ReportVersionSchema.shape.version)) version: number) { return this.reports.revision(driverId, id, version); }
}
