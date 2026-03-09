/* ═══════════════════════════════════════════════════════════
   UNIMED AGENTIC AI — Dashboard Sync
   Wires pipeline events to the 4 dashboard cards:
   Document Queue → AI Processing → SAP B1 → Compliance
   ═══════════════════════════════════════════════════════════ */

const DashboardSync = (() => {
    'use strict';

    // ── Session state ──
    let _docsProcessed = 0;
    let _totalValue = 0;
    let _lastDocType = null;
    let _lastDraftEntry = null;
    let _activityLog = [];

    // ── DOM refs ──
    let _els = {};

    function init() {
        _els = {
            // Card 1: Document Queue
            queueBadge: document.getElementById('dqBadge'),
            queueMetric: document.getElementById('dqMetric'),
            queueDesc: document.getElementById('dqDesc'),

            // Card 2: AI Processing
            aiBadge: document.getElementById('aiBadge'),
            aiOcrText: document.getElementById('aiOcrText'),
            aiOcrTime: document.getElementById('aiOcrTime'),
            aiOcrDot: document.getElementById('aiOcrDot'),
            aiNlpText: document.getElementById('aiNlpText'),
            aiNlpTime: document.getElementById('aiNlpTime'),
            aiNlpDot: document.getElementById('aiNlpDot'),
            aiExtText: document.getElementById('aiExtText'),
            aiExtTime: document.getElementById('aiExtTime'),
            aiExtDot: document.getElementById('aiExtDot'),

            // Card 3: SAP B1 Integration
            sapBadge: document.getElementById('sapCardBadge'),
            sapServiceDot: document.getElementById('sapServiceDot'),
            sapServiceStatus: document.getElementById('sapServiceStatus'),
            sapDiDot: document.getElementById('sapDiDot'),
            sapDiStatus: document.getElementById('sapDiStatus'),
            sapPostDot: document.getElementById('sapPostDot'),
            sapPostStatus: document.getElementById('sapPostStatus'),
        };

        console.log('[DashboardSync] ✅ Initialized — Dashboard cards wired');
    }

    // ═══════════════════════════════════════
    // OCR STAGE
    // ═══════════════════════════════════════

    function onOCRStart() {
        _setBadge(_els.aiBadge, 'Processing', 'processing');
        _setActivity(_els.aiOcrDot, 'processing', _els.aiOcrText, 'OCR Engine — Running...', _els.aiOcrTime, '⏳');
    }

    function onOCRComplete(result) {
        const timeStr = `${(result.elapsedMs / 1000).toFixed(1)}s`;
        _setActivity(_els.aiOcrDot, 'success', _els.aiOcrText,
            `OCR Engine — ${result.pageCount} pages · ${result.confidence}%`, _els.aiOcrTime, timeStr);
    }

    // ═══════════════════════════════════════
    // CLASSIFICATION STAGE
    // ═══════════════════════════════════════

    function onClassifyStart() {
        _setActivity(_els.aiNlpDot, 'processing', _els.aiNlpText, 'NLP Classifier — Analyzing...', _els.aiNlpTime, '⏳');
    }

    function onClassifyComplete(classification) {
        const label = typeof DocumentClassifier !== 'undefined'
            ? DocumentClassifier.getLabel(classification.docType)
            : classification.docType;
        _setActivity(_els.aiNlpDot, 'success', _els.aiNlpText,
            `NLP Classifier — ${label} · ${classification.confidence}%`, _els.aiNlpTime, '✅');
        _lastDocType = classification.docType;
    }

    // ═══════════════════════════════════════
    // EXTRACTION STAGE
    // ═══════════════════════════════════════

    function onExtractStart() {
        _setActivity(_els.aiExtDot, 'processing', _els.aiExtText, 'Field Extraction — Mapping...', _els.aiExtTime, '⏳');
    }

    function onExtractComplete(extraction) {
        const lines = extraction.lineCount || extraction.lines?.length || 0;
        _setActivity(_els.aiExtDot, 'success', _els.aiExtText,
            `Field Extraction — ${lines} lines extracted`, _els.aiExtTime, '✅');
        _setBadge(_els.aiBadge, 'Complete', 'ready');
    }

    // ═══════════════════════════════════════
    // SAP POSTING STAGE
    // ═══════════════════════════════════════

    function onSAPPostStart() {
        _setBadge(_els.sapBadge, 'Posting...', 'processing');
        _setActivity(_els.sapPostDot, 'processing', null, null, _els.sapPostStatus, 'Posting...');
    }

    function onSAPPostSuccess(draftResult, extractedData) {
        _docsProcessed++;
        _totalValue += extractedData?.computedTotal || 0;
        _lastDraftEntry = draftResult?.docEntry;

        // SAP card → Connected
        _setBadge(_els.sapBadge, 'Connected', 'ready');
        _setActivity(_els.sapServiceDot, 'success', null, null, _els.sapServiceStatus, 'Active');
        _setActivity(_els.sapDiDot, 'success', null, null, _els.sapDiStatus, 'Ready');
        _setActivity(_els.sapPostDot, 'success', null, null, _els.sapPostStatus,
            `Draft #${draftResult?.docEntry || '—'}`);

        // Document Queue → update
        _updateDocumentQueue();

        // Activity log
        const docLabel = _getDocTypeLabel(extractedData?.docType);
        _activityLog.unshift({
            time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
            text: `${docLabel} #${extractedData?.docNumber || '—'} → Draft #${draftResult?.docEntry || '—'}`,
            value: extractedData?.computedTotal || 0
        });

        console.log(`[DashboardSync] 📊 Session: ${_docsProcessed} docs, SAR ${_totalValue.toLocaleString('en', { minimumFractionDigits: 2 })}`);
    }

    function onSAPPostError(error) {
        _setBadge(_els.sapBadge, 'Error', 'processing');
        _setActivity(_els.sapPostDot, 'error', null, null, _els.sapPostStatus, 'Failed');
    }

    // ═══════════════════════════════════════
    // DOCUMENT QUEUE CARD
    // ═══════════════════════════════════════

    function _updateDocumentQueue() {
        if (_els.queueMetric) {
            _els.queueMetric.innerHTML = `<span class="currency" data-currency-symbol>SAR</span> ${_totalValue.toLocaleString('en', { minimumFractionDigits: 2 })}`;
        }
        if (_els.queueBadge) {
            _els.queueBadge.textContent = `${_docsProcessed} Processed`;
            _els.queueBadge.className = 'card-badge ready';
        }
        if (_els.queueDesc) {
            const latest = _activityLog[0];
            if (latest) {
                _els.queueDesc.innerHTML = `<span style="color:var(--health-success);font-weight:600;">✅ ${latest.text}</span>`;
            }
        }
    }

    // ═══════════════════════════════════════
    // RESET (on new document upload)
    // ═══════════════════════════════════════

    function onPipelineReset() {
        // Reset AI Processing card to standby (keep cumulative queue data)
        _setBadge(_els.aiBadge, 'Standby', 'pending');
        _setActivity(_els.aiOcrDot, 'info', _els.aiOcrText, 'OCR Engine — Idle', _els.aiOcrTime, '—');
        _setActivity(_els.aiNlpDot, 'info', _els.aiNlpText, 'NLP Classifier — Standby', _els.aiNlpTime, '—');
        _setActivity(_els.aiExtDot, 'info', _els.aiExtText, 'Field Extraction — Awaiting', _els.aiExtTime, '—');
    }

    // ═══════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════

    function _setBadge(el, text, type) {
        if (!el) return;
        el.textContent = text;
        el.className = `card-badge ${type || ''}`;
    }

    function _setActivity(dotEl, dotType, textEl, text, timeEl, time) {
        if (dotEl) dotEl.className = `activity-dot ${dotType || 'info'}`;
        if (textEl && text) textEl.textContent = text;
        if (timeEl && time) timeEl.textContent = time;
    }

    function _getDocTypeLabel(docType) {
        return { SALES_ORDER: 'SO', PURCHASE_ORDER: 'PO', DELIVERY_NOTE: 'DN' }[docType] || docType;
    }

    // ── Public API ──
    return {
        init,
        onOCRStart, onOCRComplete,
        onClassifyStart, onClassifyComplete,
        onExtractStart, onExtractComplete,
        onSAPPostStart, onSAPPostSuccess, onSAPPostError,
        onPipelineReset,
        getStats: () => ({ docsProcessed: _docsProcessed, totalValue: _totalValue, activityLog: _activityLog }),
    };
})();
