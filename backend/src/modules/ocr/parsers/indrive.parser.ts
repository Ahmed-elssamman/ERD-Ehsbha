import { Injectable } from '@nestjs/common';
import { BaseParser, RawParsed } from './base.parser';
import { OcrPlatform } from '../dto/ocr.dto';
import { OcrWord, ParseContext } from '../types';
import { SemanticNormalizer } from '../semantic/normalizer';

@Injectable()
export class IndriveParser extends BaseParser {
  readonly platform: OcrPlatform = 'INDRIVE';

  constructor(normalizer: SemanticNormalizer) {
    super(normalizer);
  }

  override parse(text: string, words: OcrWord[], ctx?: Partial<ParseContext>): RawParsed {
    const res = super.parse(text, words, ctx);
    if (res.fields.commissionEgp == null) {
      res.fields.commissionEgp = 0;
      res.perField.commissionEgp = 0.4;
      res.warnings.push('OCR_INDRIVE_NO_COMMISSION_LINE');
    }
    return res;
  }
}
