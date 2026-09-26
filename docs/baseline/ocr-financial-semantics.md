# OCR Financial Semantics

The golden fixtures are the canonical evidence. Similar labels do not imply identical business
meaning across providers.

| Field | Canonical meaning |
|---|---|
| Gross | The provider-displayed trip fare before provider deductions. It is `null` when the source screen does not expose a gross fare. |
| Received | The value represented by the provider's payment/received field. For Uber it is driver income after commission; for DiDi it is rider payment; for inDrive it is the agreed cash fare. |
| Commission | The provider fee/deduction explicitly present in the source. It is `null` when the source does not expose it. |
| Tips | The explicitly displayed gratuity. Missing source values remain `null`; they are not rewritten as zero. |
| Adjustments | A separately displayed rider discount or correction. Missing values remain `null`. |
| Net | The provider-displayed driver income. It may equal `received`, but it is not derived from `received` when the provider exposes a separate income line. |

## Provider Rules

### Uber single-trip

`receivedEgp` is driver income after commission and is also the canonical net. `grossEgp` and
`commissionEgp` are independently captured from the receipt.

### Uber multi-trip

The summary cards expose income, not gross fare. Canonical gross and commission remain `null`.
Received and net are the sum of `trips[].receivedEgp`.

### DiDi

`grossEgp` is the trip fare, `receivedEgp` is the amount paid by the rider, and
`$notes.earningsLine` is driver net income. The rider discount is stored separately as an
adjustment. Therefore `received` must not be computed as `gross - commission`.

### inDrive

`grossEgp` and `receivedEgp` are the agreed cash fare. `$notes.incomeLine` is the displayed driver
income and is canonical net. VAT and service fee are represented by `commissionEgp`. The fixture's
displayed values are retained even when their arithmetic does not reconcile exactly; verification
must not invent a corrected amount.

## Automated Consistency

`scripts/verification/tests/financial-semantics.test.mjs` resolves every `sources` path in
`apps/api/test-fixtures/financial-semantics.json` against its named golden JSON file and compares
values in piastres. A semantic change cannot pass without changing the underlying fixture evidence
or explicitly changing its source mapping.
