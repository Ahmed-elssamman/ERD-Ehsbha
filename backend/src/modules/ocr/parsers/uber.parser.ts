import { Injectable } from '@nestjs/common';
import { BaseParser } from './base.parser';
import { OcrPlatform } from '../dto/ocr.dto';
import { SemanticNormalizer } from '../semantic/normalizer';

@Injectable()
export class UberParser extends BaseParser {
  readonly platform: OcrPlatform = 'UBER';

  constructor(normalizer: SemanticNormalizer) {
    super(normalizer);
  }
}
