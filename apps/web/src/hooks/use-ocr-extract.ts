import { useMutation } from '@tanstack/react-query';
import { OcrApi, type OcrExtractInput, type OcrExtractResponseDto } from '@/lib/api/ocr.api';

export function useOcrExtract() {
  return useMutation<OcrExtractResponseDto, unknown, OcrExtractInput>({
    mutationFn: (input: OcrExtractInput) => OcrApi.extract(input),
  });
}
