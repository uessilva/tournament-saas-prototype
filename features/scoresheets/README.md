# Scoresheets feature boundary

Football scoresheet template generation, uploads, local storage, extraction,
review and publication live here.

- `template.ts` builds a competition-specific fillable AcroForm PDF with a QR
  identity (`sheetId`, template version, page) and deterministic demo sheets.
- `extraction.ts` reads AcroForm values directly and provides the replaceable
  scan adapter. The prototype scan path uses QR/filename identity plus
  representative fixed-region values when local OCR is unavailable.
- `processor.ts` persists fields, confidence, flags, crops and preview assets.
  It is shared by the PostgreSQL worker and the synchronous demo fallback.
- `queries.ts` and `actions.ts` power the Owner review queue, side-by-side
  review, rejection, retry and manual entry.
- `../results/publication.ts` is the shared transactional publication seam that
  tickets 06/07 extend for corrections, standings and advancement.

`lib/storage` stores originals, preview SVGs and source crops locally;
`scoresheets`/`extracted_fields` keep only metadata and storage keys.
