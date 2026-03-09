# UNIMED Agentic AI — Admin Handover · Phase 4 Production

> **Go-Live Date**: 2026-03-09  
> **Environment**: PRODUCTION  
> **Hypercare Window**: 30 days (expires 2026-04-08)

---

## 1. Access Credentials

### 👑 Founder Account (Full Administrative Oversight)
| Field     | Value              |
|-----------|--------------------|
| Email     | `adonis@saqr.io`   |
| Password  | `saqr2026`         |
| Role      | `founder`          |

**Founder Privileges:**
- Domain Lock bypass — full DOM access regardless of domain restrictions
- Demo Toolbar — run "Perfect Pass" and "Amber Review" demo scenarios at any time
- UAT Console — access accuracy logs, fuzzy match tuning, CSV export
- Hypercare Monitor — 30-day post-deployment monitoring panel (topbar 📊 button)
- All features available to Admin role

### 🔑 Admin Account
| Field     | Value              |
|-----------|--------------------|
| Email     | `admin@unimed.com` |
| Password  | `unimed2026`       |
| Role      | `admin`            |

**Admin Privileges:**
- Document upload and processing
- SAP Integration Hub configuration
- Extraction preview and review
- Draft posting to SAP B1

---

## 2. Founder-Only Features

| Feature | Access | Description |
|---------|--------|-------------|
| Demo Toolbar | Bottom-right floating bar | Run Perfect Pass (green) and Amber Review (amber) demo scenarios |
| UAT Console | `Ctrl+Shift+U` toggle | View accuracy logs, adjust fuzzy threshold, export CSV data |
| Hypercare Monitor | Topbar 📊 button | 30-day post-deployment monitoring: errors, overrides, confidence tracking |
| Domain Lock Override | Automatic | Bypasses domain-based feature restrictions |

---

## 3. SAP Service Layer Configuration

Configure via **⚙️ Integration Hub** (topbar gear icon):

| Parameter       | Production Value                         |
|-----------------|------------------------------------------|
| Service Layer URL | `https://<sap-server>:50000/b1s/v1/`  |
| Company Database  | `UNIMED_PROD`                          |
| SAP Username      | `GRPO_SERVICE`                         |
| SAP Password      | *(configured at deployment)*           |

**Note:** In PRODUCTION mode, the handshake attempts a real `/Login` POST to the Service Layer endpoint. If the endpoint is unreachable from the browser (CORS), credentials are stored for backend integration.

---

## 4. Document Types — Production Master Data

| Doc Type | SAP Table | Status | Synced |
|----------|-----------|--------|--------|
| Sales Order (SO) | `ORDR` | ✅ Synced | 2026-03-09 |
| Purchase Order (PO) | `OPOR` | ✅ Synced | 2026-03-09 |
| Delivery Note (DN) | `ODLN` | ✅ Synced | 2026-03-09 |

**Master Data:**
- 6 Customers (King Faisal Specialist Hospital, Saudi German Hospital, etc.)
- 5 Vendors (MedTech Surgical, Gulf Medical, J&J Medical Saudi, etc.)
- 10 Items (Sutures, Gloves, Raw Materials, Packaging)

---

## 5. Hypercare Monitoring (30 Days)

### Accessing the Panel
1. Log in as **Founder** (adonis@saqr.io)
2. Click the **📊** button in the topbar
3. Panel shows: Day X of 30, event counts, and event log

### Tracked Events
- **Document Processed** — every successful extraction
- **Low Confidence** — extractions below 70% confidence
- **Manual Override** — human corrections to AI suggestions
- **SAP Post Success/Failure** — draft posting outcomes
- **Integration Error** — Service Layer communication failures
- **Validation Failure** — Business Partner or Item Code validation issues

### Daily Report Export
1. Open Hypercare panel
2. Click **📥 Export Report**
3. CSV file downloads with all events and summary statistics

---

## 6. Production Capacity

| Metric | Target |
|--------|--------|
| Annual Throughput | 10,000 pages/year |
| Document Types | SO, PO, DN |
| Fuzzy Match Threshold | 0.65 (tunable via UAT Console) |
| Session Duration | 8 hours |

---

## 7. Escalation Matrix

| Severity | Indicator | Action |
|----------|-----------|--------|
| 🟢 Healthy | No errors in hypercare log | No action required |
| 🟡 Warning | Low confidence or overrides detected | Review in Hypercare panel, adjust threshold if needed |
| 🔴 Critical | Integration errors or SAP post failures | Check SAP connectivity, verify Service Layer credentials |
