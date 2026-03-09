/* ═══════════════════════════════════════════════════════════
   UNIMED AGENTIC AI — Founder Demo Flow
   Polished demo scenarios for the Founder walkthrough.
   Scenario A: "Perfect Pass" — Green end-to-end
   Scenario B: "Amber Review" — Manual override required
   Triggered via the demo toolbar (Founder only)
   ═══════════════════════════════════════════════════════════ */

const FounderDemo = (() => {
    'use strict';

    let _toolbar = null;
    let _isRunning = false;
    let _postAbort = null; // AbortController for SAP post button listener

    // ═══════════════════════════════════════
    // DEMO DATA: PERFECT PASS (GREEN)
    // Known BP + Known Items → 100% confidence
    // ═══════════════════════════════════════

    const PERFECT_PASS = {
        ocrText: `PURCHASE ORDER

PO Number: PO-2026-00142
Date: 09/03/2026
Vendor Code: V20015
Vendor Name: MedTech Surgical Supplies LLC

Payment Terms: Net 30
Expected Delivery: 20/03/2026

Item Code         Description                          Qty      Unit Price    Total
RAW-PGA-POLY      Polyglycolic Acid Raw Polymer 25kg    10       875.00       8,750.00
RAW-NEEDLE-BLK    Atraumatic Needle Blanks 26mm TP      50000    0.85         42,500.00

Subtotal: 51,250.00
VAT (15%): 7,687.50
Grand Total: SAR 58,937.50

Authorized by: Dr. Ahmed Al-Rashid
Procurement Department — UNIMED`,

        expectedClassification: {
            docType: 'PURCHASE_ORDER',
            confidence: 96,
            isLowConfidence: false
        },

        expectedExtraction: {
            docType: 'PURCHASE_ORDER',
            docNumber: 'PO-2026-00142',
            docDate: '2026-03-09',
            cardCode: 'V20015',
            cardName: 'MedTech Surgical Supplies LLC',
            currency: 'SAR',
            lines: [
                { itemCode: 'RAW-PGA-POLY', description: 'Polyglycolic Acid Raw Polymer 25kg', quantity: 10, unitPrice: 875.00, status: 'valid' },
                { itemCode: 'RAW-NEEDLE-BLK', description: 'Atraumatic Needle Blanks 26mm TP', quantity: 50000, unitPrice: 0.85, status: 'valid' }
            ],
            computedTotal: 51250.00
        }
    };

    // ═══════════════════════════════════════
    // DEMO DATA: AMBER REVIEW
    // Unknown BP + fuzzy items → low confidence
    // ═══════════════════════════════════════

    const AMBER_REVIEW = {
        ocrText: `DELIVERY NOTE

DN Number: DN-2026-03887
Date: 09/03/2026
Customer Code: C10042
Customer Name: King Faisal Specialist Hospital

Ship To: King Faisal Specialist Hospital, Al Faisal St, Riyadh 11211

Item Code       Description                               Ordered    Shipped
MED-SUTUR-3-0   UNICRYL Braided PGA Suture 3-0 75cm       2000       1800
GLV-LTX-PF-SM   Latex Surgical Gloves PF Small             5000       5000
PKG-FOIL-STR    Sterile Foil Pouches 120x200mm              10000      10000

Carrier: DHL Express Saudi
Tracking Number: SA-TRK-5589112
Dispatch Date: 09/03/2026

Received by: ________________________
Signature:   ________________________`,

        expectedClassification: {
            docType: 'DELIVERY_NOTE',
            confidence: 45,
            isLowConfidence: true
        },

        expectedExtraction: {
            docType: 'DELIVERY_NOTE',
            docNumber: 'DN-2026-03887',
            docDate: '2026-03-09',
            cardCode: 'C10042',
            cardName: 'King Faisal Specialist Hospital',
            currency: 'SAR',
            lines: [
                { itemCode: 'MED-SUTUR-3-0', description: 'UNICRYL Braided PGA Suture 3-0 75cm', quantity: 1800, unitPrice: 0, status: 'fuzzy' },
                { itemCode: 'GLV-LTX-PF-SM', description: 'Latex Surgical Gloves PF Small', quantity: 5000, unitPrice: 0, status: 'not_found' },
                { itemCode: 'PKG-FOIL-STR', description: 'Sterile Foil Pouches 120x200mm', quantity: 10000, unitPrice: 0, status: 'fuzzy' }
            ],
            computedTotal: 0
        }
    };

    // ═══════════════════════════════════════
    // DEMO EXECUTION
    // ═══════════════════════════════════════

    /**
     * Run a demo scenario by injecting synthetic OCR text
     * into the pipeline processing flow
     */
    async function _runScenario(scenario) {
        // ── Guard: prevent overlapping demo runs ──
        if (_isRunning) {
            console.warn('[FounderDemo] Demo already running — ignoring');
            return;
        }
        _isRunning = true;
        _setToolbarBusy(true);

        const data = scenario === 'perfect' ? PERFECT_PASS : AMBER_REVIEW;
        const label = scenario === 'perfect' ? '🟢 Perfect Pass' : '🟡 Amber Review';

        if (typeof UATConsole !== 'undefined') {
            UATConsole.logDemo(scenario, `Starting ${label} demo flow`);
        }

        // ── Clean previous demo state ──
        await _cleanPreviousDemo();

        // Create a synthetic File object from the demo text
        const blob = new Blob([data.ocrText], { type: 'text/plain' });
        const syntheticFile = new File([blob], `demo-${scenario}.txt`, { type: 'text/plain' });

        // Inject the demo text directly into the pipeline
        _injectDemo(data, syntheticFile, label);
    }

    /**
     * Clean previous demo run: reset pipeline, scroll to top, re-cache DOM
     */
    async function _cleanPreviousDemo() {
        // Abort any previous SAP post button listener
        if (_postAbort) {
            _postAbort.abort();
            _postAbort = null;
        }

        // Reset the pipeline state
        if (typeof PipelineController !== 'undefined') {
            PipelineController.reset();
        }

        // Wait for reset to settle
        await _delay(300);

        // Re-cache DOM after any cloneNode operations from previous runs
        if (typeof PipelineController !== 'undefined' && PipelineController.recacheDom) {
            PipelineController.recacheDom();
        }

        // Smooth scroll back to upload zone
        const uploadSection = document.getElementById('uploadSection');
        if (uploadSection) {
            uploadSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            await _delay(400);
        }
    }

    async function _injectDemo(data, file, label) {
        const session = typeof AuthGateway !== 'undefined' ? AuthGateway.getSession() : { name: 'Founder' };

        // ── 1. Simulate upload ──
        const uploadZone = document.getElementById('uploadZone');
        const filePreview = document.getElementById('filePreview');
        const filePreviewName = document.getElementById('filePreviewName');
        const filePreviewMeta = document.getElementById('filePreviewMeta');
        const filePreviewHash = document.getElementById('filePreviewHash');
        const processBtn = document.getElementById('processBtn');

        if (uploadZone) uploadZone.classList.add('has-file');
        if (filePreviewName) filePreviewName.textContent = file.name;
        if (filePreviewMeta) filePreviewMeta.textContent = `${(file.size / 1024).toFixed(1)} KB · Demo Document`;
        if (filePreviewHash) filePreviewHash.textContent = 'SHA-256: demo-' + Math.random().toString(36).substring(7);

        // Generate hash
        const hashBuffer = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        await AuditChain.record('UPLOAD', {
            fileName: file.name,
            fileSize: file.size,
            fileHash: hash.substring(0, 32),
            source: 'FOUNDER_DEMO'
        }, session.name);

        // ── 2. Skip OCR — inject text directly ──
        const steps = document.querySelectorAll('.pipeline-step');
        const progressBar = document.getElementById('pipelineProgressBar');

        _setStep(steps, 0, 'active');
        _setProgress(progressBar, 15);
        await _delay(600);

        _setStep(steps, 0, 'complete');
        _setStep(steps, 1, 'active');
        _setProgress(progressBar, 35);

        await AuditChain.record('OCR', {
            source: 'DEMO_INJECT',
            textLength: data.ocrText.length,
            confidence: 95,
            pageCount: 1
        }, session.name);

        if (typeof UATConsole !== 'undefined') {
            UATConsole.logOCR({ pageCount: 1, text: data.ocrText, confidence: 95, elapsedMs: 0 });
        }

        await _delay(500);

        // ── 3. Classify ──
        const classification = DocumentClassifier.classify(data.ocrText);

        await AuditChain.record('CLASSIFY', {
            docType: classification.docType,
            confidence: classification.confidence,
            scores: classification.scores,
            isLowConfidence: classification.isLowConfidence
        }, session.name);

        if (typeof UATConsole !== 'undefined') {
            UATConsole.logClassification(classification);
        }

        // Check if low confidence — show amber review
        if (classification.isLowConfidence) {
            _setStep(steps, 1, 'active');
            _setProgress(progressBar, 40);

            // Show the classification review in the review queue
            _showAmberReview(classification, data.ocrText, steps, progressBar, session, file, hash);
            return;
        }

        _setStep(steps, 1, 'complete');
        _setStep(steps, 2, 'active');
        _setProgress(progressBar, 55);
        await _delay(400);

        // ── 4. Extract ──
        const extraction = FieldExtractor.extract(data.ocrText, classification.docType);
        const extractedData = {
            docType: classification.docType,
            docNumber: extraction.docNumber || '—',
            docDate: extraction.docDate || '—',
            cardCode: extraction.cardCode || '—',
            cardName: extraction.cardName || '—',
            currency: extraction.currency || 'SAR',
            confidence: classification.confidence,
            lines: extraction.lines.map(l => ({
                ...l,
                status: l.itemCode === 'UNRESOLVED' ? 'not_found' : 'pending'
            })),
            computedTotal: extraction.computedTotal,
            missingFields: extraction.missingFields,
            rawText: data.ocrText
        };

        if (typeof UATConsole !== 'undefined') {
            UATConsole.logExtraction(extractedData);
        }

        await AuditChain.record('EXTRACT', {
            docType: extractedData.docType,
            docNumber: extractedData.docNumber,
            cardCode: extractedData.cardCode,
            lineCount: extractedData.lines.length,
            totalValue: extractedData.computedTotal
        }, session.name);

        _showExtractionPreview(extractedData);
        _setStep(steps, 2, 'complete');
        _setProgress(progressBar, 75);
        await _delay(400);

        // ── 5. Validate ──
        _setStep(steps, 3, 'active');
        _setProgress(progressBar, 85);

        const validation = await ValidationAgents.validate(extractedData);
        extractedData.lines = validation.validatedLines;

        if (typeof UATConsole !== 'undefined') {
            UATConsole.logValidation(validation);
        }

        await AuditChain.record('VALIDATE', {
            bpStatus: validation.bpResult.status,
            overallValid: validation.summary.overallValid,
            itemsTotal: validation.summary.totalItems,
            itemsValid: validation.summary.validItems,
            source: 'FOUNDER_DEMO'
        }, session.name);

        _setStep(steps, 3, 'complete');
        _setProgress(progressBar, 100);
        await _delay(300);

        // ── 6. Show SAP Ready ──
        _showSAPReady(extractedData, file, hash);
    }

    // ═══════════════════════════════════════
    // AMBER REVIEW FLOW
    // ═══════════════════════════════════════

    function _showAmberReview(classification, rawText, steps, progressBar, session, file, hash) {
        const reviewQueue = document.getElementById('reviewQueue');
        const reviewCards = document.getElementById('reviewCards');

        if (!reviewQueue || !reviewCards) return;

        const scoreEntries = Object.entries(classification.scores)
            .map(([type, score]) => `${DocumentClassifier.getLabel(type)}: ${score}pts`)
            .join(' · ');

        reviewCards.innerHTML = `
            <div class="review-card fuzzy" data-index="0">
                <div class="review-card-header">
                    <div class="review-card-type">
                        <span class="review-card-type-icon bp">🧠</span>
                        <span class="review-card-type-label">Agentic Classification</span>
                    </div>
                    <span class="review-card-status fuzzy-match">Amber — ${classification.confidence}%</span>
                </div>
                <div class="review-card-body">
                    <div class="review-card-field">
                        <span class="review-card-field-label">AI Classification Scores</span>
                        <span class="review-card-field-value">${scoreEntries}</span>
                    </div>
                    <div class="review-card-field">
                        <span class="review-card-field-label">Suggested Type</span>
                        <span class="review-card-field-value suggested">
                            ${DocumentClassifier.getLabel(classification.docType)}
                        </span>
                    </div>
                </div>
                <div class="review-card-actions">
                    <button class="review-btn accept" data-demo-type="SALES_ORDER">
                        📋 Sales Order
                    </button>
                    <button class="review-btn accept" data-demo-type="PURCHASE_ORDER">
                        📦 Purchase Order
                    </button>
                    <button class="review-btn accept" data-demo-type="DELIVERY_NOTE">
                        🚚 Delivery Note
                    </button>
                </div>
            </div>
        `;

        // Wire demo override actions
        reviewCards.querySelectorAll('[data-demo-type]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const overrideType = btn.dataset.demoType;

                if (typeof UATConsole !== 'undefined') {
                    UATConsole.logOverride(classification.docType, overrideType, session.name);
                }

                const card = reviewCards.querySelector('[data-index="0"]');
                card.classList.remove('fuzzy');
                card.classList.add('resolved');
                card.querySelector('.review-card-status').className = 'review-card-status resolved';
                card.querySelector('.review-card-status').textContent = 'Overridden ✅';
                card.querySelector('.review-card-actions').innerHTML =
                    `<span style="font-size: 0.78rem; color: var(--health-success); font-weight: 600;">✅ Set to ${DocumentClassifier.getLabel(overrideType)}</span>`;

                await AuditChain.record('CLASSIFY_OVERRIDE', {
                    original: classification.docType,
                    overrideTo: overrideType,
                    operator: session.name,
                    source: 'FOUNDER_DEMO'
                }, session.name);

                _setStep(steps, 1, 'complete');
                await _delay(400);

                // Hide review queue
                reviewQueue.classList.remove('visible');

                // Resume extraction
                _setStep(steps, 2, 'active');
                _setProgress(progressBar, 60);

                const extraction = FieldExtractor.extract(rawText, overrideType);
                const extractedData = {
                    docType: overrideType,
                    docNumber: extraction.docNumber || '—',
                    docDate: extraction.docDate || '—',
                    cardCode: extraction.cardCode || '—',
                    cardName: extraction.cardName || '—',
                    currency: extraction.currency || 'SAR',
                    confidence: 50,
                    lines: extraction.lines.map(l => ({
                        ...l,
                        status: l.itemCode === 'UNRESOLVED' ? 'not_found' : 'pending'
                    })),
                    computedTotal: extraction.computedTotal,
                    missingFields: extraction.missingFields,
                    rawText
                };

                if (typeof UATConsole !== 'undefined') {
                    UATConsole.logExtraction(extractedData);
                }

                await AuditChain.record('EXTRACT', {
                    docType: extractedData.docType,
                    docNumber: extractedData.docNumber,
                    lineCount: extractedData.lines.length,
                    source: 'FOUNDER_DEMO_OVERRIDE'
                }, session.name);

                _showExtractionPreview(extractedData);
                _setStep(steps, 2, 'complete');
                _setProgress(progressBar, 80);
                await _delay(400);

                // Validate
                _setStep(steps, 3, 'active');
                _setProgress(progressBar, 90);

                const validation = await ValidationAgents.validate(extractedData);
                extractedData.lines = validation.validatedLines;

                if (typeof UATConsole !== 'undefined') {
                    UATConsole.logValidation(validation);
                }

                _setStep(steps, 3, 'complete');
                _setProgress(progressBar, 100);
                await _delay(300);

                _showSAPReady(extractedData, file, hash);
            });
        });

        reviewQueue.classList.add('visible');
    }

    // ═══════════════════════════════════════
    // UI HELPERS
    // ═══════════════════════════════════════

    function _showExtractionPreview(data) {
        const preview = document.getElementById('extractionPreview');
        const badge = document.getElementById('extractionDoctypeBadge');
        const confidence = document.getElementById('extractionConfidence');
        const fields = document.getElementById('extractionFields');
        const table = document.getElementById('extractionTableBody');

        if (!preview) return;

        const badgeClass = data.docType === 'SALES_ORDER' ? 'sales-order' :
            data.docType === 'PURCHASE_ORDER' ? 'purchase-order' : 'delivery-note';

        if (badge) {
            badge.className = `extraction-doctype-badge ${badgeClass}`;
            badge.textContent = DocumentClassifier.getLabel(data.docType);
        }
        if (confidence) {
            confidence.innerHTML = `Confidence: <strong>${data.confidence}%</strong>`;
        }

        if (fields) {
            fields.innerHTML = `
                <div class="extraction-field">
                    <span class="extraction-field-label">Doc Number</span>
                    <span class="extraction-field-value">${data.docNumber}</span>
                </div>
                <div class="extraction-field">
                    <span class="extraction-field-label">Doc Date</span>
                    <span class="extraction-field-value">${data.docDate}</span>
                </div>
                <div class="extraction-field">
                    <span class="extraction-field-label">BP Code</span>
                    <span class="extraction-field-value">${data.cardCode}</span>
                </div>
                <div class="extraction-field">
                    <span class="extraction-field-label">BP Name</span>
                    <span class="extraction-field-value">${data.cardName}</span>
                </div>
                <div class="extraction-field">
                    <span class="extraction-field-label">Currency</span>
                    <span class="extraction-field-value">${data.currency}</span>
                </div>
            `;
        }

        if (table) {
            table.innerHTML = data.lines.map((l, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td>${l.itemCode || 'UNRESOLVED'}</td>
                    <td>${l.description || '—'}</td>
                    <td>${l.quantity || 0}</td>
                    <td>${l.unitPrice?.toFixed(2) || '0.00'}</td>
                    <td><span class="status-icon">${l.status === 'valid' ? '✅' : l.status === 'fuzzy' ? '⚠️' : '❌'}</span></td>
                </tr>
            `).join('');
        }

        preview.classList.add('visible');
    }

    function _showSAPReady(data, file, hash) {
        const panel = document.getElementById('sapReadyPanel');
        const target = document.getElementById('sapReadyTarget');
        const payload = document.getElementById('sapReadyPayload');
        const postBtn = document.getElementById('sapPostBtn');

        if (!panel) return;

        const targetMap = {
            'SALES_ORDER': 'ORDR (Sales Orders)',
            'PURCHASE_ORDER': 'OPOR (Purchase Orders)',
            'DELIVERY_NOTE': 'ODLN (Delivery Notes)'
        };
        if (target) target.textContent = targetMap[data.docType] || data.docType;

        const sapPayload = SAPServiceLayer.buildPayload(data, file?.name || 'demo-doc');
        if (payload) payload.textContent = JSON.stringify(sapPayload, null, 2);

        // Wire post button for demo — using AbortController (no cloneNode!)
        if (postBtn) {
            postBtn.disabled = false;
            postBtn.textContent = '📦 Post as Draft to SAP B1';
            postBtn.style.background = '';

            // Abort any previous listener
            if (_postAbort) _postAbort.abort();
            _postAbort = new AbortController();

            postBtn.addEventListener('click', async () => {
                postBtn.disabled = true;
                postBtn.textContent = '⏳ Posting to SAP B1...';

                const draftResult = await SAPServiceLayer.postDraft(data, file?.name || 'demo-doc');
                const attachResult = await AttachmentManager.uploadAndLink(file, draftResult.docEntry, data.docType, hash);

                const session = typeof AuthGateway !== 'undefined' ? AuthGateway.getSession() : { name: 'Founder' };

                await AuditChain.record('SAP_DRAFT', {
                    docEntry: draftResult.docEntry,
                    docNum: draftResult.docNum,
                    targetTable: draftResult.targetTable,
                    source: 'FOUNDER_DEMO'
                }, session.name);

                await AuditChain.record('ATTACHMENT', {
                    fileName: file?.name,
                    attachmentEntry: attachResult.attachmentEntry,
                    source: 'FOUNDER_DEMO'
                }, session.name);

                if (typeof UATConsole !== 'undefined') {
                    UATConsole.logPost(draftResult, attachResult);
                }

                // Show success card
                panel.classList.remove('visible');
                _showSuccessCard(data, draftResult, attachResult);

                // Mark demo as complete so next demo can start
                _isRunning = false;
                _setToolbarBusy(false);
            }, { signal: _postAbort.signal });
        }

        panel.classList.add('visible');
    }

    function _showSuccessCard(data, draftResult, attachResult) {
        const card = document.getElementById('sapSuccessCard');
        const title = document.getElementById('successTitle');
        const subtitle = document.getElementById('successSubtitle');
        const details = document.getElementById('successDetails');
        const attachment = document.getElementById('successAttachment');
        const attachInfo = document.getElementById('successAttachmentInfo');

        if (!card) return;

        const targetTable = draftResult.targetTable || 'DRAFT';
        const docLabel = DocumentClassifier.getLabel(data.docType);

        if (title) title.textContent = `Draft #${draftResult.docEntry} Created`;
        if (subtitle) subtitle.textContent = `${docLabel} posted to ${targetTable} in SAP Business One`;

        if (details) {
            details.innerHTML = `
                <div class="success-detail">
                    <div class="success-detail-label">DocEntry</div>
                    <div class="success-detail-value green">#${draftResult.docEntry}</div>
                </div>
                <div class="success-detail">
                    <div class="success-detail-label">Draft Number</div>
                    <div class="success-detail-value">${draftResult.docNum || '—'}</div>
                </div>
                <div class="success-detail">
                    <div class="success-detail-label">Target Table</div>
                    <div class="success-detail-value">${targetTable}</div>
                </div>
                <div class="success-detail">
                    <div class="success-detail-label">Document Type</div>
                    <div class="success-detail-value">${docLabel}</div>
                </div>
                <div class="success-detail">
                    <div class="success-detail-label">Business Partner</div>
                    <div class="success-detail-value">${data.cardCode !== '—' ? data.cardCode : 'Manual Entry'}</div>
                </div>
                <div class="success-detail">
                    <div class="success-detail-label">Line Items</div>
                    <div class="success-detail-value">${data.lines.length} items</div>
                </div>
                <div class="success-detail">
                    <div class="success-detail-label">Total Value</div>
                    <div class="success-detail-value">${data.currency || 'SAR'} ${data.computedTotal?.toLocaleString('en', { minimumFractionDigits: 2 }) || '0.00'}</div>
                </div>
                <div class="success-detail">
                    <div class="success-detail-label">Source</div>
                    <div class="success-detail-value">🟡 Sandbox Demo</div>
                </div>
            `;
        }

        if (attachResult?.success && attachment && attachInfo) {
            attachment.style.display = 'flex';
            attachInfo.innerHTML = `
                <strong>📎 ${attachResult.fileName} → Draft #${draftResult.docEntry}</strong>
                ATC Entry: ATC-${attachResult.attachmentEntry} · Source: ${attachResult.source}
            `;
        }

        card.classList.add('visible');
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function _setStep(steps, index, state) {
        if (!steps[index]) return;
        steps[index].classList.remove('pending', 'active', 'complete', 'error');
        steps[index].classList.add(state);
    }

    function _setProgress(bar, pct) {
        if (!bar) return;
        bar.style.width = `${pct}%`;
    }

    function _delay(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    function _setToolbarBusy(busy) {
        if (!_toolbar) return;
        const btns = _toolbar.querySelectorAll('.founder-demo-btn');
        btns.forEach(btn => {
            if (btn.id !== 'demoUAT') { // Keep UAT toggle always active
                btn.disabled = busy;
                btn.style.opacity = busy ? '0.5' : '1';
            }
        });
    }

    // ═══════════════════════════════════════
    // DEMO TOOLBAR
    // ═══════════════════════════════════════

    function _createToolbar() {
        _toolbar = document.createElement('div');
        _toolbar.className = 'founder-demo-toolbar';
        _toolbar.innerHTML = `
            <div class="founder-demo-badge">👑 Founder Demo</div>
            <button class="founder-demo-btn green" id="demoGreen">🟢 Perfect Pass</button>
            <button class="founder-demo-btn amber" id="demoAmber">🟡 Amber Review</button>
            <button class="founder-demo-btn uat" id="demoUAT">🧪 UAT Console</button>
        `;
        document.body.appendChild(_toolbar);

        document.getElementById('demoGreen').addEventListener('click', () => _runScenario('perfect'));
        document.getElementById('demoAmber').addEventListener('click', () => _runScenario('amber'));
        document.getElementById('demoUAT').addEventListener('click', () => {
            if (typeof UATConsole !== 'undefined') UATConsole.toggle();
        });
    }

    // ═══════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════

    function init() {
        // Only show toolbar for Founder users
        const isFounder = typeof AuthGateway !== 'undefined' && AuthGateway.isFounder();
        if (isFounder) {
            _createToolbar();
            console.log('[FounderDemo] ✅ Initialized — 👑 Founder toolbar active');
        } else {
            console.log('[FounderDemo] ✅ Initialized — (toolbar hidden, non-founder)');
        }
    }

    return {
        init,
        runPerfectPass: () => _runScenario('perfect'),
        runAmberReview: () => _runScenario('amber')
    };
})();
