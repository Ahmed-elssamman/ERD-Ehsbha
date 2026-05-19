import { Injectable } from '@nestjs/common';
import { BaseParser } from './base.parser';
import { OcrPlatform } from '../dto/ocr.dto';
import { SemanticNormalizer } from '../semantic/normalizer';

@Injectable()
export class DidiParser extends BaseParser {
  readonly platform: OcrPlatform = 'DIDI';

  constructor(normalizer: SemanticNormalizer) {
    super(normalizer);
  }
}
