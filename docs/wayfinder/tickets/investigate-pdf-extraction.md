---
labels:
  - wayfinder:research
parent: ../map.md
assignee: research-agent
blocked_by: []
status: closed
---

# Investigate reviewed PDF scoresheet extraction

## Question

Which practical extraction approach should the prototype use for standardized, competition-specific PDF scoresheets? Compare direct PDF field extraction, machine-readable identifiers, OCR, and AI-assisted extraction for filled and scanned forms; identify a simple implementation that exposes uncertain values and supports mandatory human review.

## Resolution

Generate each scoresheet as a fillable AcroForm PDF with stable field names and a QR code identifying the sheet, template version, and page. Extract digital form values directly. For scans, decode the QR code and use fixed-region OCR or document AI. Retain confidence scores and source-image crops, validate scores conservatively, and require side-by-side human review of all hand-filled scans and any flagged digital extraction before publication.

Research asset: [PDF scoresheet extraction findings](https://github.com/uessilva/tournament-saas-prototype/blob/research/pdf-scoresheet-extraction/docs/research/pdf-scoresheet-extraction.md) on the unmerged `research/pdf-scoresheet-extraction` branch.
