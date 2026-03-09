/* ═══════════════════════════════════════════════════════════
   UNIMED AGENTIC AI — Pipeline Controller
   Orchestrates the document processing UI flow:
   Upload → Classify → Extract → Validate → SAP Ready
   ═══════════════════════════════════════════════════════════ */

const PipelineController = (() => {
    'use strict';

    // ── Pipeline States ──
    const STAGES = {
        IDLE: 'idle',
        UPLOAD: 'upload',
        CLASSIFYING: 'classifying',
        EXTRACTING: 'extracting',
        VALIDATING: 'validating',
        REVIEW: 'review',
        SAP_READY: 'sap_ready',
        POSTED: 'posted'
    };

    let currentStage = STAGES.IDLE;
    let currentFile = null;
    let currentFileHash = null;
    let extractedData = null;

    // ── Stage → Step index mapping ──
    const STEP_MAP = {
        [STAGES.UPLOAD]: 0,
        [STAGES.CLASSIFYING]: 1,
        [STAGES.EXTRACTING]: 1,
        [STAGES.VALIDATING]: 2,
        [STAGES.REVIEW]: 2,
        [STAGES.SAP_READY]: 3,
        [STAGES.POSTED]: 3
    };

    // ── Demo Data: Sample extraction results ──
    const DEMO_EXTRACTIONS = {
        SALES_ORDER: {
            docType: 'SALES_ORDER',
            docNumber: 'SO-2026-00147',
            docDate: '2026-03-09',
            cardCode: 'C10042',
            cardName: 'King Faisal Specialist Hospital',
            confidence: 94,
            lines: [
                { itemCode: 'MED-SUTURE-3-0', description: 'UNICRYL Braided PGA 3-0, 75cm, 26mm needle', quantity: 500, unitPrice: 42.50, total: 21250.00, status: 'valid' },
                { itemCode: 'MED-SUTURE-4-0', description: 'UNICRYL Braided PGA 4-0, 45cm, 19mm needle', quantity: 300, unitPrice: 38.75, total: 11625.00, status: 'valid' },
                { itemCode: 'GLV-LATEX-PF-M', description: 'Latex Surgical Gloves Powder-Free, Medium', quantity: 2000, unitPrice: 3.20, total: 6400.00, status: 'fuzzy' }
            ]
        },
        PURCHASE_ORDER: {
            docType: 'PURCHASE_ORDER',
            docNumber: 'PO-2026-00089',
            docDate: '2026-03-07',
            cardCode: 'V20015',
            cardName: 'MedTech Surgical Supplies LLC',
            confidence: 91,
            lines: [
                { itemCode: 'RAW-PGA-POLY', description: 'Polyglycolic Acid Raw Polymer, 25kg drum', quantity: 10, unitPrice: 875.00, total: 8750.00, status: 'valid' },
                { itemCode: 'RAW-NEEDLE-BLK', description: 'Atraumatic Needle Blanks, 26mm Taper-Point', quantity: 50000, unitPrice: 0.85, total: 42500.00, status: 'valid' },
                { itemCode: 'PKG-FOIL-STER', description: 'Sterile Foil Pouches, 120x200mm', quantity: 100000, unitPrice: 0.12, total: 12000.00, status: 'not_found' }
            ]
        },
        DELIVERY_NOTE: {
            docType: 'DELIVERY_NOTE',
            docNumber: 'DN-2026-00231',
            docDate: '2026-03-09',
            cardCode: 'C10088',
            cardName: 'Saudi German Hospital - Riyadh',
            confidence: 97,
            lines: [
                { itemCode: 'MED-SUTURE-2-0', description: 'UNICRYL Braided PGA 2-0, 90cm, 30mm needle', quantity: 200, unitPrice: 48.00, total: 9600.00, status: 'valid' },
                { itemCode: 'MED-SILK-3-0', description: 'Braided Silk Suture 3-0, 75cm, NR', quantity: 150, unitPrice: 35.50, total: 5325.00, status: 'valid' }
            ]
        }
    };

    // ── Demo: Validation review items ──
    const DEMO_REVIEWS = [
        {
            type: 'item',
            fieldLabel: 'Item Code',
            extracted: 'GLV-LATEX-PF-M',
            suggested: 'GLV-LTX-PF-MD',
            suggestedName: 'Latex Surgical Gloves PF Medium (SAP Master)',
            status: 'fuzzy-match',
            confidence: 87
        },
        {
            type: 'item',
            fieldLabel: 'Item Code',
            extracted: 'PKG-FOIL-STER',
            suggested: null,
            suggestedName: null,
            status: 'not-found',
            confidence: 0
        }
    ];

    // ═══════════════════════════════════════
    // DOM REFERENCES
    // ═══════════════════════════════════════
    let els = {};

    function _cacheDom() {
        els = {
            uploadZone: document.getElementById('uploadZone'),
            uploadInput: document.getElementById('uploadInput'),
            uploadIcon: document.getElementById('uploadIcon'),
            uploadTitle: document.getElementById('uploadTitle'),
            uploadSubtitle: document.getElementById('uploadSubtitle'),
            filePreview: document.getElementById('filePreview'),
            filePreviewName: document.getElementById('filePreviewName'),
            filePreviewMeta: document.getElementById('filePreviewMeta'),
            filePreviewHash: document.getElementById('filePreviewHash'),
            processBtn: document.getElementById('processBtn'),
            clearBtn: document.getElementById('clearBtn'),
            pipelineTrack: document.getElementById('pipelineTrack'),
            progressBar: document.getElementById('pipelineProgressBar'),
            steps: document.querySelectorAll('.pipeline-step'),
            extractionPreview: document.getElementById('extractionPreview'),
            extractionBadge: document.getElementById('extractionDoctypeBadge'),
            extractionConfidence: document.getElementById('extractionConfidence'),
            extractionFields: document.getElementById('extractionFields'),
            extractionTableBody: document.getElementById('extractionTableBody'),
            reviewQueue: document.getElementById('reviewQueue'),
            reviewCards: document.getElementById('reviewCards'),
            sapReadyPanel: document.getElementById('sapReadyPanel'),
            sapReadyTarget: document.getElementById('sapReadyTarget'),
            sapReadyPayload: document.getElementById('sapReadyPayload'),
            sapPostBtn: document.getElementById('sapPostBtn'),
            // Success card
            sapSuccessCard: document.getElementById('sapSuccessCard'),
            successTitle: document.getElementById('successTitle'),
            successSubtitle: document.getElementById('successSubtitle'),
            successDetails: document.getElementById('successDetails'),
            successAttachment: document.getElementById('successAttachment'),
            successAttachmentInfo: document.getElementById('successAttachmentInfo'),
            successNewBtn: document.getElementById('successNewBtn'),
            auditTimeline: document.getElementById('auditTimeline')
        };
    }

    // ═══════════════════════════════════════
    // UPLOAD ZONE HANDLERS
    // ═══════════════════════════════════════

    function _setupUploadZone() {
        if (!els.uploadZone) return;

        // Click → open file picker
        els.uploadZone.addEventListener('click', (e) => {
            if (currentStage !== STAGES.IDLE && currentStage !== STAGES.UPLOAD) return;
            if (e.target.closest('.file-preview-actions')) return;
            els.uploadInput.click();
        });

        // File picker change
        els.uploadInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) _handleFile(e.target.files[0]);
        });

        // Drag-and-drop
        els.uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            els.uploadZone.classList.add('drag-over');
        });

        els.uploadZone.addEventListener('dragleave', () => {
            els.uploadZone.classList.remove('drag-over');
        });

        els.uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            els.uploadZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) {
                _handleFile(e.dataTransfer.files[0]);
            }
        });

        // Process button
        if (els.processBtn) {
            els.processBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                _startProcessing();
            });
        }

        // Clear button
        if (els.clearBtn) {
            els.clearBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                _resetPipeline();
            });
        }

        // SAP Post button
        if (els.sapPostBtn) {
            els.sapPostBtn.addEventListener('click', () => {
                _postToSAP();
            });
        }
    }

    // ═══════════════════════════════════════
    // FILE HANDLING
    // ═══════════════════════════════════════

    async function _handleFile(file) {
        // Validate: PDF or image
        const isPDF = file.type === 'application/pdf' || file.name.endsWith('.pdf');
        const isImage = file.type.startsWith('image/');
        if (!isPDF && !isImage) {
            _showUploadError('Only PDF and image files are supported');
            return;
        }

        currentFile = file;
        currentStage = STAGES.UPLOAD;

        // Compute SHA-256 hash of the file
        const arrayBuffer = await file.arrayBuffer();
        currentFileHash = await AuditChain.hashFile(arrayBuffer);

        // Record upload in audit chain
        const session = typeof AuthGateway !== 'undefined' ? AuthGateway.getSession() : { name: 'system' };
        await AuditChain.record('UPLOAD', {
            fileName: file.name,
            fileSize: file.size,
            fileHash: currentFileHash,
            mimeType: file.type
        }, session.name);

        // Update UI
        _showFilePreview(file);
        _updatePipelineStep(0, 'complete');
    }

    function _showFilePreview(file) {
        els.uploadZone.classList.add('has-file');
        els.filePreviewName.textContent = file.name;
        const fileType = file.type.startsWith('image/') ? 'Image Document' : 'PDF Document';
        els.filePreviewMeta.textContent = `${_formatBytes(file.size)} · ${fileType}`;
        els.filePreviewHash.textContent = `SHA-256: ${currentFileHash.substring(0, 32)}...`;
    }

    function _showUploadError(message) {
        const title = els.uploadTitle;
        const origText = title.textContent;
        title.textContent = `❌ ${message}`;
        title.style.color = 'var(--health-critical)';
        setTimeout(() => {
            title.textContent = origText;
            title.style.color = '';
        }, 3000);
    }

    // ═══════════════════════════════════════
    // PROCESSING PIPELINE (Real OCR + Classifier + Extractor)
    // ═══════════════════════════════════════

    async function _startProcessing() {
        if (!currentFile) return;
        const session = typeof AuthGateway !== 'undefined' ? AuthGateway.getSession() : { name: 'system' };
        let ocrText = '';
        let ocrConfidence = 0;

        try {
            // ══════════════════════════════════
            // STAGE 1: OCR INGESTION
            // ══════════════════════════════════
            currentStage = STAGES.CLASSIFYING;
            _updatePipelineStep(1, 'active');
            _setProgressBar(15);
            _updateProcessBtn('⏳ Running OCR...', true);

            // Wire progress updates from ExtractionEngine
            ExtractionEngine.onProgress((info) => {
                _updateProcessBtn(`⏳ ${info.message}`, true);
            });

            const ocrResult = await ExtractionEngine.extractText(currentFile);
            ocrText = ocrResult.text;
            ocrConfidence = ocrResult.confidence;

            await AuditChain.record('OCR', {
                engine: 'Tesseract.js',
                pages: ocrResult.pageCount,
                chars: ocrText.length,
                confidence: ocrConfidence,
                elapsedMs: ocrResult.elapsedMs
            }, session.name);

            // UAT: Log OCR result
            if (typeof UATConsole !== 'undefined') {
                UATConsole.logOCR(ocrResult);
            }

            _setProgressBar(35);

            // ══════════════════════════════════
            // STAGE 2: AGENTIC CLASSIFICATION
            // ══════════════════════════════════
            _updateProcessBtn('⏳ Classifying...', true);

            const classification = DocumentClassifier.classify(ocrText);

            await AuditChain.record('CLASSIFY', {
                docType: classification.docType,
                confidence: classification.confidence,
                scores: classification.scores,
                isLowConfidence: classification.isLowConfidence,
                method: 'weighted_keyword_scoring + structural_heuristics'
            }, session.name);

            _setProgressBar(50);

            // UAT: Log classification decision
            if (typeof UATConsole !== 'undefined') {
                UATConsole.logClassification(classification);
            }

            // ── Low confidence → Amber review card ──
            if (classification.isLowConfidence) {
                _updatePipelineStep(1, 'error');
                _showClassificationReview(classification, ocrText);
                return;
            }

            _updatePipelineStep(1, 'complete');

            // ══════════════════════════════════
            // STAGE 3: FIELD EXTRACTION (Agentic Map)
            // ══════════════════════════════════
            currentStage = STAGES.EXTRACTING;
            _updatePipelineStep(2, 'active');
            _setProgressBar(60);
            _updateProcessBtn('⏳ Extracting fields...', true);

            const extraction = FieldExtractor.extract(ocrText, classification.docType);

            // Build the merged data object for display
            extractedData = {
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
                hasUnresolvedItems: extraction.hasUnresolvedItems,
                rawText: ocrText
            };

            await AuditChain.record('EXTRACT', {
                docType: extractedData.docType,
                docNumber: extractedData.docNumber,
                cardCode: extractedData.cardCode,
                lineCount: extractedData.lines.length,
                totalValue: extractedData.computedTotal,
                missingFields: extractedData.missingFields
            }, session.name);

            // UAT: Log extraction result
            if (typeof UATConsole !== 'undefined') {
                UATConsole.logExtraction(extractedData);
            }

            _showExtractionPreview(extractedData);
            _updatePipelineStep(2, 'complete');
            _setProgressBar(80);

            // ══════════════════════════════════════
            // STAGE 4: VALIDATION (via ValidationAgents)
            // ══════════════════════════════════════
            currentStage = STAGES.VALIDATING;
            _updatePipelineStep(3, 'active');
            _updateProcessBtn('⏳ Validating BP & Items...', true);

            await _delay(400); // Brief pause for visual flow

            // Run real validation against SAP master data
            const validation = await ValidationAgents.validate(extractedData);

            // Update extracted data with validated lines
            extractedData.lines = validation.validatedLines;

            // UAT: Log validation results
            if (typeof UATConsole !== 'undefined') {
                UATConsole.logValidation(validation);
            }

            // Build issues from validation results
            const issues = [];

            // BP issues
            if (validation.bpResult.status === 'NOT_FOUND') {
                issues.push({
                    type: 'bp',
                    fieldLabel: 'Business Partner',
                    extracted: extractedData.cardCode || '(not detected)',
                    suggested: null,
                    status: 'not-found'
                });
            } else if (validation.bpResult.status === 'TYPE_MISMATCH') {
                issues.push({
                    type: 'bp',
                    fieldLabel: 'Business Partner Type',
                    extracted: `${validation.bpResult.cardCode} (${validation.bpResult.actual})`,
                    suggested: `Expected: ${validation.bpResult.expected}`,
                    status: 'not-found'
                });
            } else if (validation.bpResult.status === 'FUZZY') {
                issues.push({
                    type: 'bp',
                    fieldLabel: 'Business Partner',
                    extracted: extractedData.cardCode,
                    suggested: `${validation.bpResult.suggestion} — ${validation.bpResult.suggestedName} (${Math.round(validation.bpResult.similarity * 100)}%)`,
                    status: 'fuzzy-match'
                });
            }

            // Item issues
            validation.validatedLines.forEach((line, idx) => {
                if (line.status === 'not_found') {
                    issues.push({
                        type: 'item',
                        fieldLabel: `Line ${idx + 1} Item Code`,
                        extracted: line.itemCode !== 'UNRESOLVED' ? line.itemCode : line.description?.substring(0, 40),
                        suggested: null,
                        status: 'not-found'
                    });
                } else if (line.status === 'fuzzy') {
                    issues.push({
                        type: 'item',
                        fieldLabel: `Line ${idx + 1} Item Code`,
                        extracted: line.itemCode,
                        suggested: `${line.suggestedCode} — ${line.suggestedName} (${Math.round(line.similarity * 100)}%)`,
                        status: 'fuzzy-match'
                    });
                }
            });

            // Missing header fields
            if (extractedData.missingFields?.length > 0) {
                for (const field of extractedData.missingFields) {
                    if (field === 'cardCode' && issues.some(i => i.type === 'bp')) continue; // Already covered
                    issues.push({
                        type: 'field',
                        fieldLabel: _fieldLabel(field),
                        extracted: '(not detected)',
                        suggested: null,
                        status: 'not-found'
                    });
                }
            }

            const hasIssues = issues.length > 0;

            await AuditChain.record('VALIDATE', {
                bpStatus: validation.bpResult.status,
                bpCode: validation.bpResult.cardCode,
                itemsTotal: validation.summary.totalItems,
                itemsValid: validation.summary.validItems,
                itemsFuzzy: validation.summary.fuzzyItems,
                itemsInvalid: validation.summary.invalidItems,
                overallValid: validation.summary.overallValid,
                overallResult: hasIssues ? 'REVIEW_REQUIRED' : 'ALL_VALID',
                elapsedMs: validation.summary.elapsedMs
            }, session.name);

            _setProgressBar(hasIssues ? 85 : 100);
            _updateProcessBtn('🚀 Process Document', false);

            if (hasIssues) {
                currentStage = STAGES.REVIEW;
                _showReviewQueue(issues);
                _updatePipelineStep(3, 'active');
            } else {
                _updatePipelineStep(3, 'complete');
                _showSAPReady(extractedData);
            }

        } catch (err) {
            console.error('[PipelineController] Processing error:', err);
            _updatePipelineStep(1, 'error');
            _updateProcessBtn('🚀 Process Document', false);
            _showUploadError(`Processing failed: ${err.message}`);

            await AuditChain.record('ERROR', {
                stage: currentStage,
                error: err.message
            }, session.name);
        }
    }

    /**
     * Update the process button text and disabled state
     */
    function _updateProcessBtn(text, disabled) {
        if (els.processBtn) {
            els.processBtn.textContent = text;
            els.processBtn.disabled = disabled;
        }
    }

    /**
     * Show classification review card when confidence is low
     */
    function _showClassificationReview(classification, rawText) {
        currentStage = STAGES.REVIEW;
        _updateProcessBtn('🚀 Process Document', false);

        const reviews = [{
            type: 'classification',
            fieldLabel: 'Document Type',
            extracted: `Detected: ${DocumentClassifier.getLabel(classification.docType)} (${classification.confidence}% confidence)`,
            suggested: null,
            status: 'not-found',
            scores: classification.scores
        }];

        // Build amber review card with type selection
        if (!els.reviewQueue || !els.reviewCards) return;

        const scoreEntries = Object.entries(classification.scores)
            .sort((a, b) => b[1] - a[1])
            .map(([type, score]) => `${DocumentClassifier.getLabel(type)}: ${score}pts`)
            .join(' · ');

        els.reviewCards.innerHTML = `
            <div class="review-card fuzzy" data-index="0">
                <div class="review-card-header">
                    <div class="review-card-type">
                        <span class="review-card-type-icon bp">🔍</span>
                        <span class="review-card-type-label">Low Classification Confidence</span>
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
                    <button class="review-btn accept" data-action="accept-classification" data-type="SALES_ORDER">
                        📋 Sales Order
                    </button>
                    <button class="review-btn accept" data-action="accept-classification" data-type="PURCHASE_ORDER">
                        📦 Purchase Order
                    </button>
                    <button class="review-btn accept" data-action="accept-classification" data-type="DELIVERY_NOTE">
                        🚚 Delivery Note
                    </button>
                    <button class="review-btn reject" data-action="reject" data-index="0">
                        ❌ Reject
                    </button>
                </div>
            </div>
        `;

        // Wire classification override actions
        els.reviewCards.querySelectorAll('[data-action="accept-classification"]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const overrideType = btn.dataset.type;
                const card = els.reviewCards.querySelector('[data-index="0"]');
                card.classList.remove('fuzzy');
                card.classList.add('resolved');
                card.querySelector('.review-card-status').className = 'review-card-status resolved';
                card.querySelector('.review-card-status').textContent = 'Overridden';
                card.querySelector('.review-card-actions').innerHTML =
                    `<span style="font-size: 0.78rem; color: var(--health-success); font-weight: 600;">✅ Set to ${DocumentClassifier.getLabel(overrideType)}</span>`;

                await AuditChain.record('CLASSIFY_OVERRIDE', {
                    original: classification.docType,
                    overrideTo: overrideType,
                    operator: 'manual'
                }, (typeof AuthGateway !== 'undefined' ? AuthGateway.getSession() : { name: 'system' }).name);

                // Resume pipeline with overridden type
                _updatePipelineStep(1, 'complete');
                await _delay(400);
                _resumeExtractionWithType(overrideType, rawText);
            });
        });

        els.reviewCards.querySelector('[data-action="reject"]')?.addEventListener('click', () => {
            _resetPipeline();
        });

        els.reviewQueue.classList.add('visible');
    }

    /**
     * Resume extraction after a classification override
     */
    async function _resumeExtractionWithType(docType, rawText) {
        const session = typeof AuthGateway !== 'undefined' ? AuthGateway.getSession() : { name: 'system' };

        // Hide the review queue from classification
        els.reviewQueue?.classList.remove('visible');

        // Extract fields with overridden type
        currentStage = STAGES.EXTRACTING;
        _updatePipelineStep(2, 'active');
        _setProgressBar(60);

        const extraction = FieldExtractor.extract(rawText, docType);

        extractedData = {
            docType,
            docNumber: extraction.docNumber || '—',
            docDate: extraction.docDate || '—',
            cardCode: extraction.cardCode || '—',
            cardName: extraction.cardName || '—',
            currency: extraction.currency || 'SAR',
            confidence: 50, // Low — was overridden
            lines: extraction.lines.map(l => ({
                ...l,
                status: l.itemCode === 'UNRESOLVED' ? 'not_found' : 'pending'
            })),
            computedTotal: extraction.computedTotal,
            missingFields: extraction.missingFields,
            rawText
        };

        await AuditChain.record('EXTRACT', {
            docType, docNumber: extractedData.docNumber,
            cardCode: extractedData.cardCode,
            lineCount: extractedData.lines.length,
            totalValue: extractedData.computedTotal
        }, session.name);

        _showExtractionPreview(extractedData);
        _updatePipelineStep(2, 'complete');

        // Validation via ValidationAgents
        currentStage = STAGES.VALIDATING;
        _updatePipelineStep(3, 'active');
        _setProgressBar(90);

        const validation = await ValidationAgents.validate(extractedData);
        extractedData.lines = validation.validatedLines;

        await AuditChain.record('VALIDATE', {
            bpStatus: validation.bpResult.status,
            overallValid: validation.summary.overallValid,
            itemsTotal: validation.summary.totalItems,
            itemsValid: validation.summary.validItems,
            overrideClassification: true
        }, session.name);

        _setProgressBar(100);
        _updatePipelineStep(3, 'complete');
        _showSAPReady(extractedData);
    }

    /**
     * Map field keys to human-readable labels
     */
    function _fieldLabel(key) {
        const map = {
            'docNumber': 'Document Number',
            'docDate': 'Document Date',
            'cardCode': 'Business Partner Code'
        };
        return map[key] || key;
    }

    // ═══════════════════════════════════════
    // PIPELINE STEP MANAGEMENT
    // ═══════════════════════════════════════

    function _updatePipelineStep(index, state) {
        if (!els.steps || !els.steps[index]) return;
        const step = els.steps[index];

        // Remove previous states
        step.classList.remove('pending', 'active', 'complete', 'error');
        step.classList.add(state);

        // Update time display
        const timeEl = step.querySelector('.pipeline-step-time');
        if (timeEl && (state === 'complete' || state === 'active')) {
            const now = new Date();
            timeEl.textContent = now.toLocaleTimeString('en-US', {
                hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
        }
    }

    function _setProgressBar(percent) {
        if (els.progressBar) {
            els.progressBar.style.width = `${percent}%`;
        }
    }

    // ═══════════════════════════════════════
    // EXTRACTION PREVIEW
    // ═══════════════════════════════════════

    function _showExtractionPreview(data) {
        if (!els.extractionPreview) return;

        // Badge
        const badgeClass = {
            'SALES_ORDER': 'sales-order',
            'PURCHASE_ORDER': 'purchase-order',
            'DELIVERY_NOTE': 'delivery-note'
        }[data.docType] || '';

        const badgeText = {
            'SALES_ORDER': '📋 Sales Order',
            'PURCHASE_ORDER': '📦 Purchase Order',
            'DELIVERY_NOTE': '🚚 Delivery Note'
        }[data.docType] || data.docType;

        els.extractionBadge.className = `extraction-doctype-badge ${badgeClass}`;
        els.extractionBadge.textContent = badgeText;
        els.extractionConfidence.innerHTML = `Confidence: <strong>${data.confidence}%</strong>`;

        // Header fields
        els.extractionFields.innerHTML = `
            <div class="extraction-field">
                <span class="extraction-field-label">Document #</span>
                <span class="extraction-field-value">${data.docNumber}</span>
            </div>
            <div class="extraction-field">
                <span class="extraction-field-label">Date</span>
                <span class="extraction-field-value">${data.docDate}</span>
            </div>
            <div class="extraction-field">
                <span class="extraction-field-label">Business Partner</span>
                <span class="extraction-field-value valid">${data.cardCode}</span>
            </div>
            <div class="extraction-field">
                <span class="extraction-field-label">Partner Name</span>
                <span class="extraction-field-value">${data.cardName}</span>
            </div>
        `;

        // Table
        els.extractionTableBody.innerHTML = data.lines.map((line, i) => {
            const statusIcon = {
                'valid': '✅',
                'fuzzy': '⚠️',
                'not_found': '❌'
            }[line.status] || '—';

            const statusClass = {
                'valid': 'valid',
                'fuzzy': 'fuzzy',
                'not_found': 'invalid'
            }[line.status] || '';

            return `
                <tr>
                    <td>${i + 1}</td>
                    <td class="extraction-field-value ${statusClass}">${line.itemCode}</td>
                    <td>${line.description}</td>
                    <td>${line.quantity.toLocaleString()}</td>
                    <td>SAR ${line.unitPrice.toFixed(2)}</td>
                    <td>SAR ${line.total.toLocaleString('en', { minimumFractionDigits: 2 })}</td>
                    <td class="status-icon">${statusIcon}</td>
                </tr>
            `;
        }).join('');

        els.extractionPreview.classList.add('visible');
    }

    // ═══════════════════════════════════════
    // REVIEW QUEUE
    // ═══════════════════════════════════════

    function _showReviewQueue(issues) {
        if (!els.reviewQueue || !els.reviewCards) return;

        const reviews = issues.map(issue => {
            const demo = DEMO_REVIEWS.find(r => r.extracted === issue.itemCode) || {
                type: 'item',
                fieldLabel: 'Item Code',
                extracted: issue.itemCode,
                suggested: null,
                suggestedName: null,
                status: 'not-found',
                confidence: 0
            };
            return demo;
        });

        els.reviewCards.innerHTML = reviews.map((review, i) => {
            const cardClass = review.status === 'fuzzy-match' ? 'fuzzy' : 'mismatch';
            const statusLabel = review.status === 'fuzzy-match' ? 'Fuzzy Match' : 'Not Found';
            const typeIcon = review.type === 'bp' ? '🏢' : '📦';

            return `
                <div class="review-card ${cardClass}" data-index="${i}" style="animation-delay: ${i * 100}ms">
                    <div class="review-card-header">
                        <div class="review-card-type">
                            <span class="review-card-type-icon ${review.type}">${typeIcon}</span>
                            <span class="review-card-type-label">${review.fieldLabel} Mismatch</span>
                        </div>
                        <span class="review-card-status ${review.status}">${statusLabel}</span>
                    </div>
                    <div class="review-card-body">
                        <div class="review-card-field">
                            <span class="review-card-field-label">Extracted (OCR)</span>
                            <span class="review-card-field-value extracted">${review.extracted}</span>
                        </div>
                        <div class="review-card-field">
                            <span class="review-card-field-label">SAP Suggestion</span>
                            <span class="review-card-field-value ${review.suggested ? 'suggested' : 'extracted'}">
                                ${review.suggested || 'No match found in master data'}
                            </span>
                        </div>
                    </div>
                    <div class="review-card-actions">
                        ${review.suggested ? `
                            <button class="review-btn accept" data-action="accept" data-index="${i}">
                                ✅ Accept Suggestion
                            </button>
                        ` : ''}
                        <button class="review-btn manual" data-action="manual" data-index="${i}">
                            ✏️ Manual Entry
                        </button>
                        <button class="review-btn reject" data-action="reject" data-index="${i}">
                            ❌ Reject
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Wire review actions
        els.reviewCards.querySelectorAll('.review-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                const index = parseInt(e.target.dataset.index);
                _handleReviewAction(action, index);
            });
        });

        els.reviewQueue.classList.add('visible');
    }

    async function _handleReviewAction(action, index) {
        const card = els.reviewCards.querySelector(`[data-index="${index}"]`);
        if (!card) return;

        const session = typeof AuthGateway !== 'undefined' ? AuthGateway.getSession() : { name: 'system' };

        switch (action) {
            case 'accept':
                card.classList.remove('mismatch', 'fuzzy');
                card.classList.add('resolved');
                card.querySelector('.review-card-status').className = 'review-card-status resolved';
                card.querySelector('.review-card-status').textContent = 'Resolved';
                card.querySelector('.review-card-actions').innerHTML = '<span style="font-size: 0.78rem; color: var(--health-success); font-weight: 600;">✅ Suggestion accepted</span>';
                break;

            case 'manual':
                card.classList.remove('mismatch', 'fuzzy');
                card.classList.add('resolved');
                card.querySelector('.review-card-status').className = 'review-card-status resolved';
                card.querySelector('.review-card-status').textContent = 'Resolved';
                card.querySelector('.review-card-actions').innerHTML = '<span style="font-size: 0.78rem; color: var(--health-success); font-weight: 600;">✏️ Manually corrected</span>';
                break;

            case 'reject':
                card.style.opacity = '0.4';
                card.querySelector('.review-card-actions').innerHTML = '<span style="font-size: 0.78rem; color: var(--health-critical); font-weight: 600;">❌ Line removed</span>';
                break;
        }

        await AuditChain.record('REVIEW_ACTION', {
            action,
            index,
            result: action === 'reject' ? 'REMOVED' : 'RESOLVED'
        }, session.name);

        // Check if all reviews are resolved
        const unresolvedCards = els.reviewCards.querySelectorAll('.review-card:not(.resolved)');
        const allResolved = Array.from(unresolvedCards).every(c => c.style.opacity === '0.4');

        if (unresolvedCards.length === 0 || allResolved) {
            _setProgressBar(100);
            _updatePipelineStep(3, 'complete');
            await _delay(500);
            _showSAPReady(extractedData);
        }
    }

    // ═══════════════════════════════════════
    // SAP READY PANEL
    // ═══════════════════════════════════════

    function _showSAPReady(data) {
        if (!els.sapReadyPanel) return;

        currentStage = STAGES.SAP_READY;
        _setProgressBar(100);

        // Set target badge
        const targetMap = {
            'SALES_ORDER': 'ORDR (Sales Orders)',
            'PURCHASE_ORDER': 'OPOR (Purchase Orders)',
            'DELIVERY_NOTE': 'ODLN (Delivery Notes)'
        };
        els.sapReadyTarget.textContent = targetMap[data.docType] || data.docType;

        // Build SAP payload preview using SAPServiceLayer
        const payload = SAPServiceLayer.buildPayload(data, currentFile?.name || 'document');

        els.sapReadyPayload.textContent = JSON.stringify(payload, null, 2);
        els.sapReadyPanel.classList.add('visible');
    }

    async function _postToSAP() {
        if (!extractedData) return;

        const session = typeof AuthGateway !== 'undefined' ? AuthGateway.getSession() : { name: 'system' };

        els.sapPostBtn.disabled = true;
        els.sapPostBtn.textContent = '⏳ Posting to SAP B1...';

        try {
            // ══ Step 1: Post Draft via SAPServiceLayer ══
            const draftResult = await SAPServiceLayer.postDraft(extractedData, currentFile?.name || 'document');

            if (!draftResult.success) {
                els.sapPostBtn.textContent = '❌ Post Failed';
                els.sapPostBtn.style.background = 'linear-gradient(135deg, #DC2626, #EF4444)';
                await AuditChain.record('SAP_DRAFT_ERROR', {
                    error: draftResult.error
                }, session.name);
                return;
            }

            await AuditChain.record('SAP_DRAFT', {
                docType: extractedData.docType,
                docEntry: draftResult.docEntry,
                docNum: draftResult.docNum,
                targetTable: draftResult.targetTable,
                source: draftResult.source,
                status: 'DRAFT_CREATED'
            }, session.name);

            // ══ Step 2: Attach original PDF via AttachmentManager ══
            els.sapPostBtn.textContent = '⏳ Attaching PDF...';

            const attachResult = await AttachmentManager.uploadAndLink(
                currentFile,
                draftResult.docEntry,
                extractedData.docType,
                currentFileHash
            );

            if (attachResult.success) {
                await AuditChain.record('ATTACHMENT', {
                    fileName: currentFile?.name,
                    fileHash: currentFileHash?.substring(0, 32),
                    attachmentEntry: attachResult.attachmentEntry,
                    linkedTo: `Draft #${draftResult.docEntry}`,
                    source: attachResult.source,
                    status: 'ATTACHED'
                }, session.name);
            }

            // ══ Step 3: Show Success Card ══
            currentStage = STAGES.POSTED;
            _updatePipelineStep(3, 'complete');

            // Hide SAP Ready panel, show Success card
            els.sapReadyPanel?.classList.remove('visible');
            _showSuccessCard(draftResult, attachResult);

        } catch (err) {
            console.error('[PipelineController] SAP posting error:', err);
            els.sapPostBtn.textContent = '❌ Post Failed';
            els.sapPostBtn.style.background = 'linear-gradient(135deg, #DC2626, #EF4444)';

            await AuditChain.record('SAP_DRAFT_ERROR', {
                error: err.message
            }, session.name);
        }
    }

    // ═══════════════════════════════════════
    // SUCCESS CARD
    // ═══════════════════════════════════════

    function _showSuccessCard(draftResult, attachResult) {
        if (!els.sapSuccessCard) return;

        const targetTable = draftResult.targetTable || {
            'SALES_ORDER': 'ORDR',
            'PURCHASE_ORDER': 'OPOR',
            'DELIVERY_NOTE': 'ODLN'
        }[extractedData.docType] || 'DRAFT';

        const docLabel = DocumentClassifier.getLabel(extractedData.docType);

        // Title
        els.successTitle.textContent = `Draft #${draftResult.docEntry} Created`;
        els.successSubtitle.textContent = `${docLabel} posted to ${targetTable} in SAP Business One`;

        // Details grid
        els.successDetails.innerHTML = `
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
                <div class="success-detail-value">${extractedData.cardCode !== '—' ? extractedData.cardCode : 'Manual Entry'}</div>
            </div>
            <div class="success-detail">
                <div class="success-detail-label">Line Items</div>
                <div class="success-detail-value">${extractedData.lines.length} items</div>
            </div>
            <div class="success-detail">
                <div class="success-detail-label">Total Value</div>
                <div class="success-detail-value">${extractedData.currency || 'SAR'} ${extractedData.computedTotal?.toLocaleString('en', { minimumFractionDigits: 2 }) || '0.00'}</div>
            </div>
            <div class="success-detail">
                <div class="success-detail-label">Source</div>
                <div class="success-detail-value">${draftResult.source === 'LIVE' ? '🟢 Live SAP' : '🟡 Sandbox'}</div>
            </div>
        `;

        // Attachment summary
        if (attachResult && attachResult.success) {
            els.successAttachment.style.display = 'flex';
            els.successAttachmentInfo.innerHTML = `
                <strong>📎 ${attachResult.fileName} → Draft #${draftResult.docEntry}</strong>
                Attachment Entry: ATC-${attachResult.attachmentEntry} · 
                SHA-256: ${attachResult.fileHash || '—'}... · 
                Source: ${attachResult.source}
            `;
        }

        // Show the card
        els.sapSuccessCard.classList.add('visible');

        // Scroll into view
        els.sapSuccessCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // ═══════════════════════════════════════
    // AUDIT TIMELINE RENDERING
    // ═══════════════════════════════════════

    function _renderAuditEntry(entry) {
        if (!els.auditTimeline) return;

        const actionLabels = {
            'UPLOAD': '📤 Document Uploaded',
            'OCR': '🔍 OCR Text Extracted',
            'CLASSIFY': '🧠 Document Classified',
            'CLASSIFY_OVERRIDE': '👤 Classification Overridden',
            'EXTRACT': '📋 Fields Extracted',
            'VALIDATE': '✅ Validation Complete',
            'REVIEW_ACTION': '👤 Review Action',
            'SAP_DRAFT': '📦 SAP Draft Created',
            'SAP_DRAFT_ERROR': '❌ SAP Draft Failed',
            'ATTACHMENT': '📎 PDF Attached',
            'ERROR': '⚠️ Processing Error'
        };

        const actionClass = {
            'UPLOAD': 'upload',
            'CLASSIFY': 'classify',
            'EXTRACT': 'extract',
            'VALIDATE': 'validate',
            'REVIEW_ACTION': 'validate',
            'SAP_DRAFT': 'post',
            'ATTACHMENT': 'post'
        };

        const time = new Date(entry.timestamp).toLocaleTimeString('en-US', {
            hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
        });

        const el = document.createElement('div');
        el.className = `audit-entry ${actionClass[entry.action] || ''}`;
        el.innerHTML = `
            <div class="audit-entry-header">
                <span class="audit-entry-action">${actionLabels[entry.action] || entry.action}</span>
                <span class="audit-entry-time">${time}</span>
            </div>
            <div class="audit-entry-hash">${entry.hash.substring(0, 48)}...</div>
        `;

        els.auditTimeline.appendChild(el);

        // Scroll to latest
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // ═══════════════════════════════════════
    // RESET
    // ═══════════════════════════════════════

    function _resetPipeline() {
        currentStage = STAGES.IDLE;
        currentFile = null;
        currentFileHash = null;
        extractedData = null;

        // Reset upload zone
        if (els.uploadZone) els.uploadZone.classList.remove('has-file');
        if (els.uploadInput) els.uploadInput.value = '';

        // Reset pipeline steps
        els.steps.forEach((step, i) => {
            step.classList.remove('active', 'complete', 'error');
            step.classList.add('pending');
            const timeEl = step.querySelector('.pipeline-step-time');
            if (timeEl) timeEl.textContent = '';
        });
        _setProgressBar(0);

        // Hide panels
        els.extractionPreview?.classList.remove('visible');
        els.reviewQueue?.classList.remove('visible');
        els.sapReadyPanel?.classList.remove('visible');
        els.sapSuccessCard?.classList.remove('visible');

        // Re-query SAP post button (may have been cloned by previous sessions)
        els.sapPostBtn = document.getElementById('sapPostBtn');
        if (els.sapPostBtn) {
            els.sapPostBtn.disabled = false;
            els.sapPostBtn.textContent = '📦 Post as Draft to SAP B1';
            els.sapPostBtn.style.background = '';
        }

        // Reset success attachment
        if (els.successAttachment) els.successAttachment.style.display = 'none';

        // Clear audit timeline
        if (els.auditTimeline) els.auditTimeline.innerHTML = '';

        // Reset audit chain
        AuditChain.reset();
    }

    /**
     * Re-cache DOM references — call after external code modifies DOM elements
     */
    function _recacheDom() {
        els.sapPostBtn = document.getElementById('sapPostBtn');
        els.successNewBtn = document.getElementById('successNewBtn');
        els.sapSuccessCard = document.getElementById('sapSuccessCard');
        els.sapReadyPanel = document.getElementById('sapReadyPanel');
        els.reviewQueue = document.getElementById('reviewQueue');
        els.reviewCards = document.getElementById('reviewCards');
    }

    // ═══════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════

    function _delay(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    function _formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    // ═══════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════

    function init() {
        _cacheDom();
        _setupUploadZone();

        // Wire audit chain to timeline renderer
        AuditChain.onEntry(_renderAuditEntry);

        // Wire success card new document button
        if (els.successNewBtn) {
            els.successNewBtn.addEventListener('click', () => _resetPipeline());
        }

        // Initialize all steps as pending
        els.steps.forEach(step => step.classList.add('pending'));

        console.log('[PipelineController] ✅ Initialized — Sovereign Handshake ready');
    }

    return {
        init,
        reset: _resetPipeline,
        recacheDom: _recacheDom,
        getStage: () => currentStage,
        STAGES
    };
})();
