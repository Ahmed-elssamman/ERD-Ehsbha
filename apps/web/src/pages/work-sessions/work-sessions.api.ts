import { sessionSchema, sessionPageSchema, openSessionSchema, workSessionHistorySchema } from '@ehsbha/api-contracts';
import { WorkSessionView } from '@ehsbha/shared-types';
import { api } from '@/lib/api/client';
import { parseData } from '@/features/platform-api';

export interface WorkSessionSnapshot { driverAppId: string | null; startedAt: string; endedAt: string | null; activeMinutes: number; version: number; deletedAt: string | null }
export interface WorkSessionRecord extends WorkSessionSnapshot { id: string; driverId: string; clientMutationId: string | null; createdAt: string; updatedAt: string }
export interface SessionStartInput { startedAt: string; clientMutationId: string }
export interface SessionVersionInput { expectedVersion: number; clientMutationId: string }
export interface SessionEndInput extends SessionVersionInput { endedAt: string }
export interface SessionCreateInput extends SessionStartInput { endedAt: string }
export interface SessionCorrectInput extends SessionCreateInput { expectedVersion: number }
export const WorkSessionsApi = {
  open: () => api.get('/sessions/open').then((res) => parseData(openSessionSchema, res.data, 'driver.sessions.open')),
  get: (id: string) => api.get(`/sessions/${id}`).then((res) => parseData(sessionSchema, res.data, 'driver.sessions.get')),
  list: (view: WorkSessionView, cursor = '') => api.get('/sessions', { params: { view, ...(cursor ? { cursor } : {}) } }).then((res) => parseData(sessionPageSchema, res.data, 'driver.sessions.list')),
  history: (id: string, cursor = '') => api.get(`/sessions/${id}/history`, { params: cursor ? { cursor } : {} }).then((res) => parseData(workSessionHistorySchema, res.data, 'driver.sessions.history')),
  start: (body: SessionStartInput) => api.post('/sessions/start', body).then((res) => parseData(sessionSchema, res.data, 'driver.sessions.start')),
  end: (id: string, body: SessionEndInput) => api.post(`/sessions/${id}/end`, body).then((res) => parseData(sessionSchema, res.data, 'driver.sessions.end')),
  create: (body: SessionCreateInput) => api.post('/sessions', body).then((res) => parseData(sessionSchema, res.data, 'driver.sessions.create')),
  correct: (id: string, body: SessionCorrectInput) => api.patch(`/sessions/${id}`, body).then((res) => parseData(sessionSchema, res.data, 'driver.sessions.correct')),
  remove: (id: string, body: SessionVersionInput) => api.post(`/sessions/${id}/delete`, body).then((res) => parseData(sessionSchema, res.data, 'driver.sessions.delete')),
  restore: (id: string, body: SessionVersionInput) => api.post(`/sessions/${id}/restore`, body).then((res) => parseData(sessionSchema, res.data, 'driver.sessions.restore')),
};
