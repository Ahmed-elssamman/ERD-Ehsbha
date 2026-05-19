import { Injectable } from '@nestjs/common';
import { normalizeDigits, stripBidi } from './digit-normalizer';

const ARABIC_DIACRITICS = /[ً-ٰٟۖ-ۜ۟-۪ۤۧۨ-ۭ]/g;
const TATWEEL = /ـ/g;

@Injectable()
export class SemanticNormalizer {
  normalizeText(input: string): string {
    if (!input) return '';
    let s = stripBidi(input);
    s = s.replace(ARABIC_DIACRITICS, '');
    s = s.replace(TATWEEL, '');
    s = s.replace(/[أإآٱ]/g, 'ا');
    s = s.replace(/ى/g, 'ي');
    s = s.replace(/ة/g, 'ه');
    s = s.replace(/ؤ/g, 'و');
    s = s.replace(/ئ/g, 'ي');
    s = s.toLowerCase();
    s = s.replace(/\s+/g, ' ').trim();
    return s;
  }

  normalizeForCompare(input: string): string {
    return normalizeDigits(this.normalizeText(input));
  }
}
