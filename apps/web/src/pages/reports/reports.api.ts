import { reportPageSchema, reportRecordSchema, reportPreferencesSchema, type CreateReport, type ReviseReport, type UpdateReportPreferences } from '@ehsbha/api-contracts';
import { api } from '@/lib/api/client';
import { parseData } from '@/features/platform-api';

export const ReportsApi = {
  list: (cursor = '') => api.get('/reports', { params: cursor ? { cursor } : {} }).then((res) => parseData(reportPageSchema, res.data, 'driver.reports.list')),
  get: (id: string) => api.get(`/reports/${id}`).then((res) => parseData(reportRecordSchema, res.data, 'driver.reports.get')),
  create: (body: CreateReport) => api.post('/reports', body).then((res) => parseData(reportRecordSchema, res.data, 'driver.reports.create')),
  revise: (id: string, body: ReviseReport) => api.post(`/reports/${id}/revisions`, body).then((res) => parseData(reportRecordSchema, res.data, 'driver.reports.revise')),
  history: (id: string, cursor = '') => api.get(`/reports/${id}/revisions`, { params: cursor ? { cursor } : {} }).then((res) => parseData(reportPageSchema, res.data, 'driver.reports.history')),
  revision: (id: string, version: number) => api.get(`/reports/${id}/revisions/${version}`).then((res) => parseData(reportRecordSchema, res.data, 'driver.reports.revision')),
  preferences: () => api.get('/reports/preferences').then((res) => parseData(reportPreferencesSchema, res.data, 'driver.reports.preferences.get')),
  updatePreferences: (body: UpdateReportPreferences) => api.patch('/reports/preferences', body).then((res) => parseData(reportPreferencesSchema, res.data, 'driver.reports.preferences.update')),
};
