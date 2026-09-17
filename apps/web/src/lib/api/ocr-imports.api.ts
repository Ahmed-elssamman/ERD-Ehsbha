import {
  ocrImportDetailSchema, ocrConfirmationResponseSchema,
  type CreateOcrImportRequest, type OcrImportDetail, type OcrConfirmationRequest, type OcrConfirmationResponse,
} from '@ehsbha/api-contracts';
import { parseData } from '@/features/platform-api';
import { api } from './client';

export const OcrImportsApi = {
  async create(request: CreateOcrImportRequest, signal?: AbortSignal): Promise<OcrImportDetail> {
    const response = await api.post('/ocr/imports', request, { signal });
    return parseData(ocrImportDetailSchema, response.data, 'driver.ocr.imports.create');
  },
  async get(id: string, signal?: AbortSignal): Promise<OcrImportDetail> {
    const response = await api.get(`/ocr/imports/${id}`, { signal });
    return parseData(ocrImportDetailSchema, response.data, 'driver.ocr.imports.get');
  },
  async upload(id: string, imageId: string, image: File, signal?: AbortSignal): Promise<OcrImportDetail> {
    const form = new FormData(); form.append('image', image, 'screenshot');
    const response = await api.post(`/ocr/imports/${id}/images/${imageId}`, form, { signal, timeout: 60000, headers: { 'Content-Type': 'multipart/form-data' } });
    return parseData(ocrImportDetailSchema, response.data, 'driver.ocr.imports.upload');
  },
  async confirm(id: string, request: OcrConfirmationRequest): Promise<OcrConfirmationResponse> {
    const response = await api.post(`/ocr/imports/${id}/confirm`, request);
    return parseData(ocrConfirmationResponseSchema, response.data, 'driver.ocr.imports.confirm');
  },
  async cancel(id: string): Promise<OcrImportDetail> {
    const response = await api.delete(`/ocr/imports/${id}`);
    return parseData(ocrImportDetailSchema, response.data, 'driver.ocr.imports.cancel');
  },
};
