import { useMutation } from '@tanstack/react-query';
import { OcrApi, type OcrExtractResponseDto } from '@/lib/api/ocr.api';

export function useOcrExtract() {
  return useMutation<OcrExtractResponseDto, unknown, File[]>({
    mutationFn: (files: File[]) => OcrApi.extract(files),
  });
}
