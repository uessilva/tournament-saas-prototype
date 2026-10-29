# Reviewed PDF scoresheet extraction

Date: 2026-10-29  
Status: Research complete  
Scope: Practical extraction options for standardized football and tennis scoresheets in a tournament SaaS prototype.

## Recommendation in one paragraph

Generate every scoresheet as a **fillable AcroForm PDF with stable field names and a QR code containing an opaque `sheetId`, template version, and page number**. On upload, read AcroForm values directly when they still exist; otherwise decode the QR code and run OCR/document AI only over the known field regions. Normalize and validate the results, retain each value's confidence and source crop, and show the extracted result beside the original page. Highlight missing, low-confidence, unreadable, or rule-violating fields and require explicit human confirmation before publication. For the simplest trustworthy prototype, route **every hand-filled scan** through review rather than trying to prove that high-confidence scans can bypass it.

This is one ingestion pipeline with two extraction paths, not two separate products. Direct fields make digitally filled PDFs reliable and cheap; QR codes preserve document identity after printing; fixed-region OCR plus review makes hand-filled scans demonstrable without promising flawless handwriting recognition.

## Approaches and evidence

### 1. AcroForm / direct field extraction

An AcroForm stores interactive fields separately from the visual page. Field names such as `home_goals`, `away_goals`, or `set_1_home_games` therefore provide a direct mapping to application data, avoiding character recognition. PDF-lib explicitly supports creating forms and filling and reading text fields, checkboxes, radio groups, dropdowns, and option lists in browser or Node JavaScript runtimes.[1] Mozilla PDF.js also exposes `getFieldObjects()`, returning AcroForm field data or `null` if none exists.[2]

**Strengths**

- Highest reliability of the options for a digitally filled, unflattened form because values are read as data rather than inferred from pixels.
- Deterministic field mapping, simple implementation, and no OCR service or model dependency.
- Checkboxes and constrained controls are useful for marks that would otherwise be ambiguous.

**Limits**

- Printing and scanning produces page imagery, so handwriting cannot be recovered through AcroForm APIs.
- Flattening turns field appearances into page content; PDF-lib describes this operation explicitly.[1] A pipeline must not assume that every visually completed PDF still has readable fields.
- Direct extraction is not semantic validation: impossible scores, missing values, and edits made outside the intended fields still need checks.

### 2. QR codes or barcodes for machine-readable identity

ZXing's `QRCodeReader` detects and decodes QR codes in images and reports not-found, format, and checksum failures.[3] A small QR code on each generated page can identify the fixture, template version, and page without asking OCR to read those identifiers.

**Strengths**

- Survives the print/scan transition as a machine-readable image and has explicit decode-failure behavior.
- Removes error-prone OCR of fixture IDs, team IDs, and template versions.
- Simple to generate and decode with mature libraries; useful in both digital and scanned paths.

**Limits**

- A QR code should carry identity/routing metadata, not the handwritten score: the code is printed before the match and cannot change when the referee writes on the sheet.
- A damaged, blurred, cropped, or low-resolution code can fail to decode. Failure must route the upload to review, not trigger a guessed fixture.
- Treat the payload as an opaque lookup key and verify it against server-side fixture data. Do not trust user-supplied team names or results embedded in the code.

### 3. Conventional OCR

Tesseract can provide word-level confidence values (0–100).[4] Its own quality guidance says accuracy is affected by image processing, skew, noise, resolution, borders, and segmentation; it recommends at least 300 DPI for best results, notes problems with tables without custom layout analysis, and supports digit whitelists and small-region segmentation modes.[5]

**Strengths**

- Self-hostable, no per-document cloud dependency, and confidence output can support a review queue.
- Standardized fixed field boxes allow cropping one score at a time and restricting recognition to digits.
- A reasonable low-cost baseline for printed digits and clearly hand-printed values.

**Limits**

- Handwriting, strokes through table lines, corrections, skew, shadows, and ambiguous digits remain practical failure modes; no universal accuracy should be claimed without testing real scoresheets.
- Cropping, deskewing, page alignment, field mapping, and confidence aggregation add implementation work.
- Word confidence is not a guarantee that a complete score is correct.

### 4. AI-assisted document extraction

Managed document AI combines OCR with form/layout understanding. Amazon Textract accepts PDF and common image formats, returns form key-value pairs with confidence, and supports tables and selection elements.[6][7] AWS recommends high-quality input, confidence thresholds, and human scrutiny for results below the application-specific threshold.[7] Microsoft Document Intelligence extracts text, structure, key-value mappings, and selection marks, supports handwritten text through OCR, and returns confidence for words and key-value mappings.[8]

**Strengths**

- Less custom layout code than building an OCR/table parser from primitives.
- Better fit than plain full-page OCR when extracting structured values from hand-filled forms.
- Native confidence and geometry can drive highlighted fields and source-image crops.

**Limits**

- Adds a cloud integration, operational cost, data-handling considerations, and service-specific response mapping.
- Confidence still requires calibration on representative football and tennis sheets. Microsoft explicitly recommends a proof of concept and scenario-specific thresholds.[8]
- AI does not remove the need for validation or human review. Do not equate a fluent normalized result with a correct reading of the page.
- Custom model training is unnecessary for the first prototype; it adds dataset and evaluation work.

## Comparison

| Input / method | Expected reliability | Implementation complexity | Prototype suitability |
|---|---|---|---|
| Digitally filled AcroForm + direct extraction | **High** for field transcription; still validate meaning and completeness | **Low** | Excellent fast path |
| Digitally filled but flattened/rasterized PDF | Direct fields unavailable; falls back to image recognition | **Medium** | Must handle explicitly |
| Hand-filled scan + QR + fixed-region OCR | **Variable**; legibility and capture quality matter | **Medium** | Good with review and original-image evidence |
| Hand-filled scan + managed document AI | **Variable**, generally the most capable structured OCR option here, but not authoritative | **Medium**, plus vendor operations | Convincing demo if confidence and review are visible |
| QR/barcode alone for fixture identity | **High when decodable**, explicit failure otherwise | **Low** | Strong complement, not a score extractor |
| Free-form OCR/AI over the entire sheet | Layout and field-association errors are harder to control | **Medium–high** to make robust | Avoid for the simple prototype |

The reliability labels are architectural judgments, not measured accuracy claims. A production threshold or vendor choice requires a labeled test set containing real scans, phone photos, handwriting styles, corrections, and both sports' templates.

## Proposed prototype flow

1. **Generate** a sport-specific AcroForm template. Give every result cell a stable field name and print a QR code containing `sheetId`, `templateVersion`, and `pageNumber`. Also print a short human-readable sheet code for support/fallback.
2. **Classify the upload by capability, not filename**: attempt direct field extraction and QR decoding. If fields contain values, use them. Otherwise rasterize/read the page, decode the QR code, and extract the known regions.
3. **Extract scans into one common result shape**, for example:
   - `fieldName`
   - `rawText` and normalized `value`
   - `confidence: number | null`
   - `source: acroform | ocr | document-ai | manual`
   - `boundingBox` / source crop
   - `issues[]` such as `low_confidence`, `missing`, `qr_mismatch`, or `invalid_score`
4. **Normalize conservatively**. Football result cells should be non-negative integers; tennis game/point/tie-break cells should use the allowed domain and sport-specific consistency rules. Cross-check extracted fixture identity with the QR code. Never silently invent a missing value or “repair” an inconsistent score.
5. **Review before publication**. Display the original page beside editable extracted fields, with low-confidence and invalid values visibly highlighted and linked to their crops. Require the reviewer to resolve every flagged item and explicitly confirm the sheet. A hand-filled scan remains `needs_review` even if all confidence values are high.
6. **Publish atomically** only after confirmation. Keep the original upload, raw extraction, reviewer edits, and final confirmation for auditability.

For a UI-only demo, a stub extractor can return representative values and confidence levels, but it should use the same result shape and review states as the real pipeline.

## Why this is the simplest convincing choice

- It demonstrates the polished end-to-end story: download, fill, upload, inspect uncertainty, correct, and publish.
- The happy path is deterministic for digital forms, while the scan path honestly exposes uncertainty rather than hiding it behind “AI-powered” copy.
- Stable fields and QR identity eliminate unnecessary recognition work, leaving OCR/AI only for handwritten result cells.
- The same review UI works with local OCR, a managed AI service, or fixture-backed demo data, so the prototype does not lock itself into a vendor.

## Sources

1. PDF-lib, official documentation: form creation, filling/reading, supported controls, browser/Node support, and flattening. https://pdf-lib.js.org/
2. Mozilla PDF.js, `PDFDocumentProxy.getFieldObjects()` API. https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFDocumentProxy.html
3. ZXing, `QRCodeReader` API and decode failures. https://zxing.github.io/zxing/apidocs/com/google/zxing/qrcode/QRCodeReader.html
4. Tesseract, `TessBaseAPI` confidence APIs. https://tesseract-ocr.github.io/tessapi/5.x/a02438.html
5. Tesseract, “Improving the quality of the output.” https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html
6. Amazon Textract, “Form Data (Key-Value Pairs).” https://docs.aws.amazon.com/textract/latest/dg/how-it-works-kvp.html
7. Amazon Textract, “Best Practices” (input quality and confidence-based scrutiny). https://docs.aws.amazon.com/textract/latest/dg/textract-best-practices.html
8. Microsoft, “Transparency note for Document Intelligence” (OCR/handwriting, confidence, evaluation, and human review). https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/document-intelligence/transparency-note
