/* ═══════════════════════════════════════════════════════════
   UNIMED AGENTIC AI — Hypercare Monitor (Phase 5)
   Post-deployment monitoring for 30 days.
   Tracks: integration errors, low-confidence, overrides
   Daily report generation & CSV export
   ═══════════════════════════════════════════════════════════ */

const HypercareMonitor = (() => {
    'use strict';

    // ── Configuration ──
    const HYPERCARE_DAYS = 30;
    const LOW_CONFIDENCE_THRESHOLD = 70;
    const STORAGE_KEY = 'hypercare-log';
    const MAX_EVENTS = 5000;

    // ── Event Types ──
    const EVENT_TYPES = {
        DOC_PROCESSED: { icon: '📄', label: 'Document Processed', color: '#4ade80' },
        EXTRACTION_OK: { icon: '✅', label: 'Extraction Success', color: '#4ade80' },
        LOW_CONFIDENCE: { icon: '⚠️', label: 'Low Confidence', color: '#fbbf24' },
        OVERRIDE: { icon: '🔄', label: 'Manual Override', color: '#f59e0b' },
        SAP_POST_SUCCESS: { icon: '📦', label: 'SAP Post Success', color: '#4ade80' },
        SAP_POST_FAILURE: { icon: '❌', label: 'SAP Post Failure', color: '#ef4444' },
        INTEGRATION_ERROR: { icon: '🚨', label: 'Integration Error', color: '#ef4444' },
        CLASSIFICATION_ERR: { icon: '🔍', label: 'Classification Issue', color: '#f59e0b' },
        VALIDATION_FAILURE: { icon: '🛡️', label: 'Validation Failure', color: '#ef4444' },
        SYSTEM_EVENT: { icon: '⚙️', label: 'System Event', color: '#60a5fa' }
    };

    let _events = [];
    let _isVisible = false;
    let _goLiveDate = null;
    let _panel = null;

    // ═══════════════════════════════════════
    // STORAGE
    // ═══════════════════════════════════════

    function _loadEvents() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) _events = JSON.parse(raw);
        } catch { _events = []; }
    }

    function _saveEvents() {
        try {
            // Trim to MAX_EVENTS
            if (_events.length > MAX_EVENTS) {
                _events = _events.slice(-MAX_EVENTS);
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(_events));
        } catch (e) {
            console.warn('[HypercareMonitor] Storage write failed:', e.message);
        }
    }

    // ═══════════════════════════════════════
    // EVENT LOGGING
    // ═══════════════════════════════════════

    function logEvent(type, message, data = {}) {
        const entry = {
            id: `HC-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            type,
            message,
            data,
            timestamp: new Date().toISOString(),
            day: _getCurrentDay()
        };

        _events.push(entry);
        _saveEvents();
        _renderEvent(entry);
        _updateSummary();

        const meta = EVENT_TYPES[type] || EVENT_TYPES.SYSTEM_EVENT;
        console.log(`[HypercareMonitor] ${meta.icon} ${meta.label}: ${message}`);

        return entry;
    }

    // ── Convenience loggers ──
    function logDocProcessed(docType, fileName, confidence) {
        logEvent('DOC_PROCESSED', `${docType} processed: ${fileName}`, { docType, fileName, confidence });
        if (confidence < LOW_CONFIDENCE_THRESHOLD) {
            logEvent('LOW_CONFIDENCE', `Low confidence (${confidence}%) on ${fileName}`, { docType, fileName, confidence });
        }
    }

    function logOverride(field, from, to, operator) {
        logEvent('OVERRIDE', `${field}: "${from}" → "${to}" by ${operator}`, { field, from, to, operator });
    }

    function logSAPPost(success, docEntry, error) {
        if (success) {
            logEvent('SAP_POST_SUCCESS', `Draft posted: ${docEntry}`, { docEntry });
        } else {
            logEvent('SAP_POST_FAILURE', `Post failed: ${error}`, { docEntry, error });
        }
    }

    function logIntegrationError(source, error) {
        logEvent('INTEGRATION_ERROR', `[${source}] ${error}`, { source, error });
    }

    function logValidationFailure(field, issue) {
        logEvent('VALIDATION_FAILURE', `${field}: ${issue}`, { field, issue });
    }

    // ═══════════════════════════════════════
    // HYPERCARE WINDOW
    // ═══════════════════════════════════════

    function _getCurrentDay() {
        if (!_goLiveDate) return 1;
        const now = new Date();
        const diff = Math.floor((now - _goLiveDate) / (1000 * 60 * 60 * 24));
        return Math.max(1, Math.min(diff + 1, HYPERCARE_DAYS));
    }

    function isActive() {
        return _getCurrentDay() <= HYPERCARE_DAYS;
    }

    // ═══════════════════════════════════════
    // DAILY REPORT
    // ═══════════════════════════════════════

    function _getDailyReport(day) {
        const dayEvents = _events.filter(e => e.day === day);

        return {
            day,
            totalEvents: dayEvents.length,
            docsProcessed: dayEvents.filter(e => e.type === 'DOC_PROCESSED').length,
            lowConfidence: dayEvents.filter(e => e.type === 'LOW_CONFIDENCE').length,
            overrides: dayEvents.filter(e => e.type === 'OVERRIDE').length,
            sapPostSuccess: dayEvents.filter(e => e.type === 'SAP_POST_SUCCESS').length,
            sapPostFailure: dayEvents.filter(e => e.type === 'SAP_POST_FAILURE').length,
            integrationErrors: dayEvents.filter(e => e.type === 'INTEGRATION_ERROR').length,
            validationFailures: dayEvents.filter(e => e.type === 'VALIDATION_FAILURE').length,
            events: dayEvents
        };
    }

    function _getTotalSummary() {
        return {
            docsProcessed: _events.filter(e => e.type === 'DOC_PROCESSED').length,
            errors: _events.filter(e =>
                e.type === 'SAP_POST_FAILURE' ||
                e.type === 'INTEGRATION_ERROR' ||
                e.type === 'VALIDATION_FAILURE'
            ).length,
            overrides: _events.filter(e => e.type === 'OVERRIDE').length,
            lowConfidence: _events.filter(e => e.type === 'LOW_CONFIDENCE').length,
        };
    }

    // ═══════════════════════════════════════
    // PANEL RENDERING
    // ═══════════════════════════════════════

    function _renderEvent(entry) {
        const logContainer = document.getElementById('hypercareLog');
        if (!logContainer) return;

        const meta = EVENT_TYPES[entry.type] || EVENT_TYPES.SYSTEM_EVENT;
        const time = new Date(entry.timestamp);
        const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        const row = document.createElement('div');
        row.className = 'hypercare-log-entry';
        row.style.borderLeft = `3px solid ${meta.color}`;
        row.innerHTML = `
            <span class="hc-log-icon">${meta.icon}</span>
            <span class="hc-log-msg">${_escapeHtml(entry.message)}</span>
            <span class="hc-log-time">${timeStr}</span>
        `;

        logContainer.prepend(row);

        // Keep log at max 200 DOM entries
        while (logContainer.children.length > 200) {
            logContainer.removeChild(logContainer.lastChild);
        }
    }

    function _updateSummary() {
        const summary = _getTotalSummary();
        const dayBadge = document.getElementById('hypercareDayBadge');
        const hcDocs = document.getElementById('hcDocsProcessed');
        const hcErrors = document.getElementById('hcErrors');
        const hcOverrides = document.getElementById('hcOverrides');
        const hcLowConf = document.getElementById('hcLowConfidence');

        if (dayBadge) dayBadge.textContent = `Day ${_getCurrentDay()} of ${HYPERCARE_DAYS}`;
        if (hcDocs) hcDocs.textContent = summary.docsProcessed;
        if (hcErrors) hcErrors.textContent = summary.errors;
        if (hcOverrides) hcOverrides.textContent = summary.overrides;
        if (hcLowConf) hcLowConf.textContent = summary.lowConfidence;

        // Update topbar dot color
        const dot = document.getElementById('hypercareDot');
        if (dot) {
            if (summary.errors > 0) {
                dot.className = 'hypercare-dot critical';
            } else if (summary.lowConfidence > 0 || summary.overrides > 0) {
                dot.className = 'hypercare-dot warning';
            } else {
                dot.className = 'hypercare-dot healthy';
            }
        }
    }

    function _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ═══════════════════════════════════════
    // EXPORT
    // ═══════════════════════════════════════

    function exportReport() {
        const currentDay = _getCurrentDay();
        const lines = [
            '═══════════════════════════════════════',
            'UNIMED HYPERCARE DAILY REPORT',
            `Generated: ${new Date().toISOString()}`,
            `Hypercare Day: ${currentDay} of ${HYPERCARE_DAYS}`,
            `Go-Live: ${_goLiveDate?.toISOString() || 'N/A'}`,
            '═══════════════════════════════════════',
            '',
            'Timestamp,Day,Type,Message,Data'
        ];

        for (const e of _events) {
            const dataStr = JSON.stringify(e.data || {}).replace(/,/g, ';');
            lines.push(`${e.timestamp},${e.day},${e.type},"${(e.message || '').replace(/"/g, '""')}","${dataStr}"`);
        }

        // Summary section
        const summary = _getTotalSummary();
        lines.push('');
        lines.push('═══════════════════════════════════════');
        lines.push('SUMMARY');
        lines.push(`Total Documents Processed,${summary.docsProcessed}`);
        lines.push(`Total Errors,${summary.errors}`);
        lines.push(`Total Overrides,${summary.overrides}`);
        lines.push(`Total Low Confidence,${summary.lowConfidence}`);

        const csv = lines.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `UNIMED_Hypercare_Day${currentDay}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        console.log(`[HypercareMonitor] 📥 Report exported — Day ${currentDay}`);
    }

    // ═══════════════════════════════════════
    // PANEL VISIBILITY
    // ═══════════════════════════════════════

    function toggle() {
        _isVisible ? hide() : show();
    }

    function show() {
        const panel = document.getElementById('hypercarePanel');
        const overlay = document.getElementById('hypercareOverlay');
        if (panel) panel.classList.add('active');
        if (overlay) overlay.classList.add('active');
        _isVisible = true;
        _updateSummary();
    }

    function hide() {
        const panel = document.getElementById('hypercarePanel');
        const overlay = document.getElementById('hypercareOverlay');
        if (panel) panel.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
        _isVisible = false;
    }

    // ═══════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════

    function init() {
        // Set go-live date
        if (typeof ValidationAgents !== 'undefined' && ValidationAgents.getProductionSince) {
            _goLiveDate = new Date(ValidationAgents.getProductionSince());
        } else {
            _goLiveDate = new Date();
        }

        _loadEvents();
        _updateSummary();

        // Render existing events into log
        const recent = _events.slice(-50);
        for (const entry of recent) {
            _renderEvent(entry);
        }

        // Log system boot event
        logEvent('SYSTEM_EVENT', `Hypercare Monitor initialized — Day ${_getCurrentDay()} of ${HYPERCARE_DAYS}`);

        console.log(`[HypercareMonitor] ✅ Initialized — Day ${_getCurrentDay()} of ${HYPERCARE_DAYS} | ${_events.length} events loaded`);
    }

    return {
        init,
        logEvent,
        logDocProcessed,
        logOverride,
        logSAPPost,
        logIntegrationError,
        logValidationFailure,
        exportReport,
        toggle,
        show,
        hide,
        isActive,
        getCurrentDay: _getCurrentDay,
        getDailyReport: _getDailyReport,
        getTotalSummary: _getTotalSummary
    };
})();
