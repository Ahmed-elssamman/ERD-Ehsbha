import { UberParser } from '../src/modules/ocr/parsers/uber.parser';
import { DidiParser } from '../src/modules/ocr/parsers/didi.parser';
import { IndriveParser } from '../src/modules/ocr/parsers/indrive.parser';
import { SemanticNormalizer } from '../src/modules/ocr/semantic/normalizer';
import { BaseParser } from '../src/modules/ocr/parsers/base.parser';
import { FIXTURE as UBER_AR } from '../src/modules/ocr/__fixtures__/uber-ar.txt';
import { FIXTURE as UBER_EN } from '../src/modules/ocr/__fixtures__/uber-en.txt';
import { FIXTURE as UBER_MIXED } from '../src/modules/ocr/__fixtures__/uber-mixed.txt';
import { FIXTURE as DIDI_AR } from '../src/modules/ocr/__fixtures__/didi-ar.txt';
import { FIXTURE as DIDI_EN } from '../src/modules/ocr/__fixtures__/didi-en.txt';
import { FIXTURE as INDRIVE_AR } from '../src/modules/ocr/__fixtures__/indrive-ar.txt';
import { FIXTURE as INDRIVE_EN } from '../src/modules/ocr/__fixtures__/indrive-en.txt';

const args = process.argv.slice(2);
const familyIdx = args.indexOf('--family');
const fixtureIdx = args.indexOf('--fixture');
const family = familyIdx >= 0 ? args[familyIdx + 1] : '';
const fixtureName = fixtureIdx >= 0 ? args[fixtureIdx + 1] : '';

function toPiastres(value: number | null | undefined): number | null {
  return value === null || value === undefined ? null : Math.round(value * 100);
}

const normalizer = new SemanticNormalizer();

const parsers: Record<string, BaseParser> = {
  uber: new UberParser(normalizer),
  didi: new DidiParser(normalizer),
  indrive: new IndriveParser(normalizer),
};

interface FixtureEntry {
  parser: string;
  text: string;
}

const fixtures: Record<string, FixtureEntry> = {
  'uber-ar': { parser: 'uber', text: UBER_AR },
  'uber-en': { parser: 'uber', text: UBER_EN },
  'uber-mixed': { parser: 'uber', text: UBER_MIXED },
  'didi-ar': { parser: 'didi', text: DIDI_AR },
  'didi-en': { parser: 'didi', text: DIDI_EN },
  'indrive-ar': { parser: 'indrive', text: INDRIVE_AR },
  'indrive-en': { parser: 'indrive', text: INDRIVE_EN },
};

if (fixtureName && fixtures[fixtureName]) {
  const f = fixtures[fixtureName];
  const parser = parsers[f.parser];
  const result = parser.parse(f.text, []);
  const fields = result.fields;
  const output = {
    fixtureName,
    family: f.parser,
    gross: toPiastres(fields.grossEgp),
    commission: toPiastres(fields.commissionEgp),
    tips: toPiastres(fields.tipEgp),
    received: toPiastres(fields.receivedEgp),
    net: toPiastres(fields.receivedEgp != null && fields.commissionEgp != null
      ? fields.receivedEgp - fields.commissionEgp
      : fields.receivedEgp ?? fields.grossEgp),
    adjustments: null as number | null,
    currency: 'EGP',
    unit: 'piastres',
    warnings: result.warnings,
  };
  console.log(JSON.stringify(output));
} else if (family) {
  const parser = parsers[family];
  if (!parser) throw new Error(`Unknown parser family: ${family}`);
  type FixtureResults = Record<string, { grossEgp: number | null | undefined; receivedEgp: number | null | undefined; commissionEgp: number | null | undefined; tipEgp: number | null | undefined; warnings: string[] }>;
  const allResults: FixtureResults = {};
  for (const [name, f] of Object.entries(fixtures)) {
    if (f.parser === family) {
      const result = parser.parse(f.text, []);
      allResults[name] = {
        grossEgp: result.fields.grossEgp,
        receivedEgp: result.fields.receivedEgp,
        commissionEgp: result.fields.commissionEgp,
        tipEgp: result.fields.tipEgp,
        warnings: result.warnings,
      };
    }
  }
  console.log(JSON.stringify({ family, fixtures: allResults }));
} else {
  type AllResults = Record<string, { grossEgp: number | null | undefined; receivedEgp: number | null | undefined; commissionEgp: number | null | undefined; tipEgp: number | null | undefined }>;
  const allResults: AllResults = {};
  for (const [name, f] of Object.entries(fixtures)) {
    const parser = parsers[f.parser];
    const result = parser.parse(f.text, []);
    allResults[name] = {
      grossEgp: result.fields.grossEgp,
      receivedEgp: result.fields.receivedEgp,
      commissionEgp: result.fields.commissionEgp,
      tipEgp: result.fields.tipEgp,
    };
  }
  console.log(JSON.stringify({ all: allResults }));
}
