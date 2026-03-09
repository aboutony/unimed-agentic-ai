# UNIMED — Agentic AI Document Intelligence Suite

> Intelligent document processing and automated SAP Business One integration, purpose-built for healthcare operations in KSA.

![Phase](https://img.shields.io/badge/Phase-3%20UAT-gold)
![SAP](https://img.shields.io/badge/SAP%20B1-v10.0-blue)
![Domain](https://img.shields.io/badge/Domain-Healthcare-teal)

---

## Overview

UNIMED Agentic AI is a zero-server, browser-native document processing platform that extracts, classifies, validates, and posts medical trade documents directly to SAP Business One as draft entries.

### Core Pipeline

```
📄 PDF Upload → 🔍 OCR (Tesseract.js) → 🧠 NLP Classification → 📋 Field Extraction → ✅ BP/Item Validation → 📦 SAP B1 Draft Post
```

### Supported Document Types

| Type | SAP Object | Target Table |
|------|-----------|-------------|
| Sales Order | `oOrders` | `ORDR` |
| Purchase Order | `oPurchaseOrders` | `OPOR` |
| Delivery Note | `oDeliveryNotes` | `ODLN` |

---

## Architecture

```
├── index.html              # Main dashboard
├── login.html              # Auth gateway
├── css/
│   ├── variables.css       # Design tokens
│   ├── main.css            # Core styles
│   ├── pipeline.css        # Processing pipeline UI
│   └── uat.css             # UAT console + demo styles
├── js/
│   ├── App.js              # Boot orchestrator
│   ├── AuthGateway.js      # Session management + Founder override
│   ├── TranslationModule.js # EN/AR i18n with SAR formatting
│   ├── ExtractionEngine.js # Tesseract.js OCR wrapper
│   ├── DocumentClassifier.js # Weighted keyword + structural scoring
│   ├── FieldExtractor.js   # Regex-based header/line extraction
│   ├── ValidationAgents.js # BP + Item fuzzy matching (Levenshtein)
│   ├── SAPServiceLayer.js  # REST payload builder
│   ├── PipelineController.js # UI flow orchestration
│   ├── AuditChain.js       # SHA-256 tamper-proof audit trail
│   ├── UATConsole.js       # Hidden accuracy logging console
│   └── FounderDemo.js      # Demo scenarios (Perfect Pass / Amber Review)
└── assets/
    └── unimed-logo-official.svg
```

---

## UAT Sandbox (Phase 3)

The platform is in **UAT lockdown** with frozen master data:

- **6 KSA Hospital Customers**: King Faisal Specialist, Saudi German, KFMC, NGHA, Dr. Sulaiman Al Habib, Dallah
- **5 Medical Vendors**: MedTech Surgical, Saudi Medical Instruments, Gulf Pharma, Al Borg Medical, Unipharma
- **10 Item Codes**: Sutures (PGA, Silk, Chromic), Gloves, Drapes, Needles, Polymers, Foils, Gauze

### Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Founder | `adonis@saqr.io` | `saqr2026` |
| Admin | `admin@unimed.com` | `unimed2026` |

---

## Quick Start

```bash
# Serve locally (no build step required)
npx -y http-server ./ -p 8080 -c-1

# Open in browser
open http://localhost:8080/login.html
```

### Founder Demo Controls

1. Login as `adonis@saqr.io` / `saqr2026`
2. Use the bottom-right toolbar:
   - 🟢 **Perfect Pass** — End-to-end green flow
   - 🟡 **Amber Review** — Manual classification override
   - 🧪 **UAT Console** — Toggle accuracy logger (`Ctrl+Shift+U`)

---

## Key Features

- **Agentic Classification**: Weighted keyword scoring + structural heuristics with confidence thresholds
- **Fuzzy Matching**: Levenshtein distance-based BP and Item validation against SAP master data
- **Live Threshold Tuning**: UAT Console slider adjusts fuzzy sensitivity in real-time
- **SHA-256 Audit Chain**: Immutable record of every pipeline event
- **Bilingual UI**: Full English/Arabic with RTL support and SAR currency formatting
- **PDF Attachment**: Automatic PDF linking to SAP draft entries

---

## License

Proprietary — UNIMED © 2026
