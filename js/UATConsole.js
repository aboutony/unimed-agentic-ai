/* ═══════════════════════════════════════════════════════════
   UNIMED AGENTIC AI — UAT Console
   Hidden accuracy-logging panel for test-month tuning.
   Toggle: Ctrl+Shift+U  (Founder: always available)
   Logs: classification decisions, fuzzy matches,
   extraction confidence, validation outcomes
   ═══════════════════════════════════════════════════════════ */

const UATConsole = (() => {
    'use strict';

    let _panel = null;
    let _logContainer = null;
    let _isVisible = false;
    let _logs = [];
    let _sessionId = null;

    const MAX_LOGS = 500;

    // Log entry types with icons and colors
    const LOG_TYPES = {
        CLASSIFY: { icon: '🧠', color: '#7AB8E1', label: 'CLASSIFY' },
        FUZZY_BP: { icon: '🔍', color: '#F59E0B', label: 'FUZZY-BP' },
        FUZZY_ITEM: { icon: '🔍', color: '#F59E0B', label: 'FUZZY-ITEM' },
        VALIDATE_BP: { icon: '🛡️', color: '#22C55E', label: 'VALID-BP' },
        VALIDATE_ITEM: { icon: '📦', color: '#22C55E', label: 'VALID-ITEM' },
        EXTRACT: { icon: '📋', color: '#3B82F6', label: 'EXTRACT' },
        OCR: { icon: '🔤', color: '#8B5CF6', label: 'OCR' },
        POST: { icon: '📦', color: '#16A34A', label: 'SAP-POST' },
        OVERRIDE: { icon: '👤', color: '#EF4444', label: 'OVERRIDE' },
        DEMO: { icon: '🎯', color: '#EC4899', label: 'DEMO' },
        SYSTEM: { icon: '⚙️', color: '#6B7280', label: 'SYSTEM' }
    };

    // ═══════════════════════════════════════
    // LOGGING ENGINE
    // ═══════════════════════════════════════

    /**
     * Log an event to the UAT console
     * @param {string} type - Log type from LOG_TYPES
     * @param {string} message - Human-readable message
     * @param {object} data - Structured data for CSV export
     */
    function log(type, message, data = {}) {
        const entry = {
            id: _logs.length + 1,
            timestamp: new Date().toISOString(),
            type,
            message,
            data,
            sessionId: _sessionId
        };

        _logs.push(entry);
        if (_logs.length > MAX_LOGS) _logs.shift();

        // Render to panel if open
        if (_isVisible && _logContainer) {
            _renderEntry(entry);
        }

        // Also log to browser console with grouping
        const logType = LOG_TYPES[type] || LOG_TYPES.SYSTEM;
        console.log(`%c[UAT] ${logType.icon} ${logType.label}%c ${message}`,
            `color:${logType.color};font-weight:bold`, 'color:inherit', data);
    }

    // ═══════════════════════════════════════
    // CONVENIENCE LOGGERS
    // ═══════════════════════════════════════

    function logClassification(result) {
        const scoreStr = Object.entries(result.scores)
            .map(([k, v]) => `${k.replace('_', '')}:${v}`)
            .join(' · ');

        log('CLASSIFY',
            `${result.docType} @ ${result.confidence}% conf | ${scoreStr} | low=${result.isLowConfidence}`,
            {
                docType: result.docType,
                confidence: result.confidence,
                ...result.scores,
                isLowConfidence: result.isLowConfidence,
                margin: result.margin
            }
        );
    }

    function logFuzzyBP(bpResult) {
        if (bpResult.status === 'FUZZY') {
            log('FUZZY_BP',
                `"${bpResult.cardCode}" → suggestion: ${bpResult.suggestion} (${Math.round(bpResult.similarity * 100)}%)`,
                {
                    extracted: bpResult.cardCode,
                    suggested: bpResult.suggestion,
                    suggestedName: bpResult.suggestedName,
                    similarity: bpResult.similarity
                }
            );
        } else if (bpResult.status === 'NOT_FOUND') {
            log('FUZZY_BP', `"${bpResult.cardCode || '—'}" → NOT FOUND`, { extracted: bpResult.cardCode });
        }
    }

    function logFuzzyItem(line, index) {
        if (line.status === 'fuzzy') {
            log('FUZZY_ITEM',
                `Line ${index + 1}: "${line.itemCode}" → ${line.suggestedCode} (${Math.round(line.similarity * 100)}%)`,
                {
                    lineIndex: index,
                    extracted: line.itemCode,
                    suggested: line.suggestedCode,
                    suggestedName: line.suggestedName,
                    similarity: line.similarity
                }
            );
        } else if (line.status === 'not_found') {
            log('FUZZY_ITEM', `Line ${index + 1}: "${line.itemCode}" → NOT FOUND`, {
                lineIndex: index,
                extracted: line.itemCode
            });
        }
    }

    function logValidation(validation) {
        const s = validation.summary;
        log('VALIDATE_BP',
            `BP: ${validation.bpResult.status} | Items: ${s.validItems}✅ ${s.fuzzyItems}⚠️ ${s.invalidItems}❌ | ${s.elapsedMs}ms`,
            {
                bpStatus: validation.bpResult.status,
                bpCode: validation.bpResult.cardCode,
                totalItems: s.totalItems,
                validItems: s.validItems,
                fuzzyItems: s.fuzzyItems,
                invalidItems: s.invalidItems,
                overallValid: s.overallValid,
                elapsedMs: s.elapsedMs
            }
        );

        // Log individual fuzzy/not-found items
        validation.validatedLines.forEach((line, idx) => {
            logFuzzyItem(line, idx);
        });

        logFuzzyBP(validation.bpResult);
    }

    function logExtraction(extracted) {
        const fieldCount = ['docNumber', 'docDate', 'cardCode', 'cardName'].filter(f =>
            extracted[f] && extracted[f] !== '—'
        ).length;

        log('EXTRACT',
            `${extracted.docType} | fields:${fieldCount}/4 | lines:${extracted.lines.length} | total:${extracted.computedTotal || 0}`,
            {
                docType: extracted.docType,
                docNumber: extracted.docNumber,
                docDate: extracted.docDate,
                cardCode: extracted.cardCode,
                lineCount: extracted.lines.length,
                total: extracted.computedTotal,
                missingFields: extracted.missingFields
            }
        );
    }

    function logOCR(ocrResult) {
        log('OCR',
            `${ocrResult.pageCount} pages | ${ocrResult.text.length} chars | conf:${ocrResult.confidence}% | ${ocrResult.elapsedMs}ms`,
            {
                pageCount: ocrResult.pageCount,
                textLength: ocrResult.text.length,
                confidence: ocrResult.confidence,
                elapsedMs: ocrResult.elapsedMs
            }
        );
    }

    function logPost(draftResult, attachResult) {
        log('POST',
            `Draft #${draftResult.docEntry} → ${draftResult.targetTable} | attach:${attachResult?.success ? 'OK' : 'FAIL'} | src:${draftResult.source}`,
            {
                docEntry: draftResult.docEntry,
                docNum: draftResult.docNum,
                targetTable: draftResult.targetTable,
                source: draftResult.source,
                attachmentEntry: attachResult?.attachmentEntry
            }
        );
    }

    function logOverride(from, to, operator) {
        log('OVERRIDE', `${from} → ${to} by ${operator}`, { from, to, operator });
    }

    function logDemo(scenario, description) {
        log('DEMO', `[${scenario}] ${description}`, { scenario });
    }

    // ═══════════════════════════════════════
    // PANEL UI
    // ═══════════════════════════════════════

    function _createPanel() {
        _panel = document.createElement('div');
        _panel.id = 'uatConsole';
        _panel.className = 'uat-console';
        _panel.innerHTML = `
            <div class="uat-console-header">
                <div class="uat-console-title">
                    <span class="uat-console-icon">🧪</span>
                    <span>UAT Accuracy Console</span>
                    <span class="uat-env-badge">SANDBOX</span>
                </div>
                <div class="uat-console-actions">
                    <button class="uat-btn" id="uatExport" title="Export CSV">📥 Export</button>
                    <button class="uat-btn" id="uatClear" title="Clear Logs">🗑️ Clear</button>
                    <button class="uat-btn" id="uatClose" title="Close (Ctrl+Shift+U)">✕</button>
                </div>
            </div>
            <div class="uat-console-tuning" id="uatTuning">
                <div class="uat-tuning-group">
                    <label class="uat-tuning-label">🎯 Fuzzy Threshold</label>
                    <input type="range" class="uat-threshold-slider" id="uatThresholdSlider" min="30" max="95" value="65" step="5">
                    <span class="uat-threshold-value" id="uatThresholdValue">0.65</span>
                </div>
                <div class="uat-accuracy-bar" id="uatAccuracyBar">
                    <span class="uat-acc-stat valid">✅ <strong>0</strong> valid</span>
                    <span class="uat-acc-stat fuzzy">🔍 <strong>0</strong> fuzzy</span>
                    <span class="uat-acc-stat failed">❌ <strong>0</strong> failed</span>
                    <span class="uat-acc-stat precision">🎯 Precision: <strong>—</strong></span>
                </div>
            </div>
            <div class="uat-console-filters" id="uatFilters">
                <button class="uat-filter active" data-filter="all">All</button>
                <button class="uat-filter" data-filter="CLASSIFY">🧠 Classify</button>
                <button class="uat-filter" data-filter="FUZZY">🔍 Fuzzy</button>
                <button class="uat-filter" data-filter="EXTRACT">📋 Extract</button>
                <button class="uat-filter" data-filter="POST">📦 SAP</button>
                <button class="uat-filter" data-filter="OVERRIDE">👤 Override</button>
                <button class="uat-filter" data-filter="DEMO">🎯 Demo</button>
            </div>
            <div class="uat-console-stats" id="uatStats">
                <span class="uat-stat">📊 <strong>0</strong> events</span>
                <span class="uat-stat">🔍 <strong>0</strong> fuzzy</span>
                <span class="uat-stat">✅ <strong>0</strong> valid</span>
                <span class="uat-stat">❌ <strong>0</strong> failed</span>
            </div>
            <div class="uat-console-log" id="uatLogContainer"></div>
        `;
        document.body.appendChild(_panel);

        _logContainer = document.getElementById('uatLogContainer');

        // Wire actions
        document.getElementById('uatClose').addEventListener('click', toggle);
        document.getElementById('uatClear').addEventListener('click', _clearLogs);
        document.getElementById('uatExport').addEventListener('click', _exportCSV);

        // Wire threshold slider
        const slider = document.getElementById('uatThresholdSlider');
        const sliderVal = document.getElementById('uatThresholdValue');
        if (slider && sliderVal) {
            // Sync initial value from ValidationAgents
            if (typeof ValidationAgents !== 'undefined' && ValidationAgents.getFuzzyThreshold) {
                const curr = ValidationAgents.getFuzzyThreshold();
                slider.value = Math.round(curr * 100);
                sliderVal.textContent = curr.toFixed(2);
            }
            slider.addEventListener('input', () => {
                const val = parseInt(slider.value) / 100;
                sliderVal.textContent = val.toFixed(2);
                if (typeof ValidationAgents !== 'undefined' && ValidationAgents.setFuzzyThreshold) {
                    ValidationAgents.setFuzzyThreshold(val);
                }
                // Update lockdown banner threshold display
                const bannerThresh = document.getElementById('uatLockdownThreshold');
                if (bannerThresh) bannerThresh.textContent = `Fuzzy: ${val.toFixed(2)}`;
                log('SYSTEM', `Fuzzy threshold adjusted → ${val.toFixed(2)}`, { threshold: val });
            });
        }

        // Wire filters
        document.getElementById('uatFilters').addEventListener('click', (e) => {
            const btn = e.target.closest('.uat-filter');
            if (!btn) return;
            document.querySelectorAll('.uat-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            _applyFilter(btn.dataset.filter);
        });
    }

    function _renderEntry(entry) {
        const logType = LOG_TYPES[entry.type] || LOG_TYPES.SYSTEM;
        const el = document.createElement('div');
        el.className = `uat-log-entry ${entry.type.toLowerCase().replace('_', '-')}`;
        el.dataset.type = entry.type;

        const time = new Date(entry.timestamp).toLocaleTimeString('en-GB', { hour12: false });

        el.innerHTML = `
            <span class="uat-log-time">${time}</span>
            <span class="uat-log-badge" style="color:${logType.color}">${logType.icon} ${logType.label}</span>
            <span class="uat-log-msg">${_escapeHtml(entry.message)}</span>
        `;

        _logContainer.appendChild(el);
        _logContainer.scrollTop = _logContainer.scrollHeight;
        _updateStats();
    }

    function _updateStats() {
        const statsEl = document.getElementById('uatStats');
        if (!statsEl) return;

        const total = _logs.length;
        const fuzzy = _logs.filter(l => l.type === 'FUZZY_BP' || l.type === 'FUZZY_ITEM').length;
        const valid = _logs.filter(l => l.type === 'VALIDATE_BP' || l.type === 'VALIDATE_ITEM').length;
        const failed = _logs.filter(l => l.type === 'OVERRIDE' || l.message?.includes('NOT FOUND')).length;

        statsEl.innerHTML = `
            <span class="uat-stat">📊 <strong>${total}</strong> events</span>
            <span class="uat-stat">🔍 <strong>${fuzzy}</strong> fuzzy</span>
            <span class="uat-stat">✅ <strong>${valid}</strong> valid</span>
            <span class="uat-stat">❌ <strong>${failed}</strong> failed</span>
        `;

        // Update accuracy bar
        const accBar = document.getElementById('uatAccuracyBar');
        if (accBar) {
            const totalDecisions = valid + fuzzy + failed;
            const precision = totalDecisions > 0 ? ((valid / totalDecisions) * 100).toFixed(1) : '—';
            accBar.innerHTML = `
                <span class="uat-acc-stat valid">✅ <strong>${valid}</strong> valid</span>
                <span class="uat-acc-stat fuzzy">🔍 <strong>${fuzzy}</strong> fuzzy</span>
                <span class="uat-acc-stat failed">❌ <strong>${failed}</strong> failed</span>
                <span class="uat-acc-stat precision">🎯 Precision: <strong>${precision}%</strong></span>
            `;
        }
    }

    function _applyFilter(filter) {
        if (!_logContainer) return;
        const entries = _logContainer.querySelectorAll('.uat-log-entry');
        entries.forEach(entry => {
            if (filter === 'all') {
                entry.style.display = '';
            } else if (filter === 'FUZZY') {
                entry.style.display = (entry.dataset.type === 'FUZZY_BP' || entry.dataset.type === 'FUZZY_ITEM') ? '' : 'none';
            } else {
                entry.style.display = entry.dataset.type === filter ? '' : 'none';
            }
        });
    }

    function _clearLogs() {
        _logs = [];
        if (_logContainer) _logContainer.innerHTML = '';
        _updateStats();
        log('SYSTEM', 'UAT Console cleared');
    }

    function _exportCSV() {
        const headers = ['id', 'timestamp', 'sessionId', 'type', 'message', 'confidence', 'similarity', 'threshold', 'data'];
        const rows = _logs.map(l => {
            const conf = l.data?.confidence ?? l.data?.scores?.PURCHASE_ORDER ?? '';
            const sim = l.data?.similarity ?? '';
            const thresh = (typeof ValidationAgents !== 'undefined' && ValidationAgents.getFuzzyThreshold)
                ? ValidationAgents.getFuzzyThreshold() : '';
            return [
                l.id,
                l.timestamp,
                l.sessionId || _sessionId,
                l.type,
                `"${l.message.replace(/"/g, '""')}"`,
                conf,
                sim,
                thresh,
                `"${JSON.stringify(l.data).replace(/"/g, '""')}"`
            ];
        });

        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `uat-log-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        log('SYSTEM', `Exported ${_logs.length} entries to CSV (with confidence scores)`);
    }

    function _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ═══════════════════════════════════════
    // VISIBILITY
    // ═══════════════════════════════════════

    function toggle() {
        if (!_panel) _createPanel();
        _isVisible = !_isVisible;
        _panel.classList.toggle('visible', _isVisible);

        if (_isVisible) {
            // Re-render all logs
            _logContainer.innerHTML = '';
            _logs.forEach(entry => _renderEntry(entry));
        }
    }

    function show() {
        if (!_panel) _createPanel();
        _isVisible = true;
        _panel.classList.add('visible');
        _logContainer.innerHTML = '';
        _logs.forEach(entry => _renderEntry(entry));
    }

    function hide() {
        _isVisible = false;
        _panel?.classList.remove('visible');
    }

    // ═══════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════

    function init() {
        _sessionId = `UAT-${Date.now().toString(36)}`;

        // Keyboard shortcut: Ctrl+Shift+U
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'U') {
                e.preventDefault();
                toggle();
            }
        });

        _createPanel();

        log('SYSTEM', `UAT Console initialized — Session: ${_sessionId}`);
        log('SYSTEM', `Environment: SANDBOX | Master Data: 6 Customers + 5 Vendors + 10 Items`);

        console.log('[UATConsole] ✅ Initialized — Ctrl+Shift+U to toggle');
    }

    return {
        init,
        log,
        logClassification,
        logFuzzyBP,
        logFuzzyItem,
        logValidation,
        logExtraction,
        logOCR,
        logPost,
        logOverride,
        logDemo,
        toggle,
        show,
        hide,
        getLogs: () => [..._logs],
        getSessionId: () => _sessionId
    };
})();
