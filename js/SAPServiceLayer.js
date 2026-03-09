/* ═══════════════════════════════════════════════════════════
   UNIMED AGENTIC AI — SAP Service Layer Client
   Handles: Session management, Drafts API, Attachments2,
   and master data queries against SAP B1 v10.0
   ═══════════════════════════════════════════════════════════ */

const SAPServiceLayer = (() => {
    'use strict';

    let _config = null;
    let _sessionId = null;
    let _connected = false;

    // SAP Draft endpoint mapping
    const DRAFT_ENDPOINTS = {
        'SALES_ORDER': 'Drafts',       // DocObjectCode = oOrders (17)
        'PURCHASE_ORDER': 'Drafts',    // DocObjectCode = oPurchaseOrders (22)
        'DELIVERY_NOTE': 'Drafts'      // DocObjectCode = oDeliveryNotes (15)
    };

    const DOC_OBJECT_CODES = {
        'SALES_ORDER': '17',
        'PURCHASE_ORDER': '22',
        'DELIVERY_NOTE': '15'
    };

    const DOC_OBJECT_NAMES = {
        'SALES_ORDER': 'oOrders',
        'PURCHASE_ORDER': 'oPurchaseOrders',
        'DELIVERY_NOTE': 'oDeliveryNotes'
    };

    // ═══════════════════════════════════════
    // SESSION MANAGEMENT
    // ═══════════════════════════════════════

    /**
     * Login to SAP Service Layer
     * @param {object} config - { baseUrl, companyDB, userName, password }
     */
    async function login(config) {
        _config = config;

        const loginPayload = {
            CompanyDB: config.companyDB,
            UserName: config.userName,
            Password: config.password
        };

        try {
            const response = await fetch(`${config.baseUrl}/Login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loginPayload),
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Login failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            _sessionId = data.SessionId;
            _connected = true;

            console.log(`[SAPServiceLayer] ✅ Logged in — Session: ${_sessionId?.substring(0, 16)}...`);
            return { success: true, sessionId: _sessionId };
        } catch (err) {
            console.warn(`[SAPServiceLayer] Login failed:`, err.message);
            _connected = false;
            return { success: false, error: err.message };
        }
    }

    /**
     * Logout from SAP Service Layer
     */
    async function logout() {
        if (!_connected || !_config) return;

        try {
            await fetch(`${_config.baseUrl}/Logout`, {
                method: 'POST',
                headers: _headers(),
                credentials: 'include'
            });
        } catch { /* ignore */ }

        _sessionId = null;
        _connected = false;
        console.log('[SAPServiceLayer] Logged out');
    }

    // ═══════════════════════════════════════
    // HTTP PRIMITIVES
    // ═══════════════════════════════════════

    function _headers() {
        const h = { 'Content-Type': 'application/json' };
        if (_sessionId) h['Cookie'] = `B1SESSION=${_sessionId}`;
        return h;
    }

    /**
     * GET request to Service Layer
     */
    async function get(endpoint) {
        if (!_connected) throw new Error('Not connected to SAP');

        const response = await fetch(`${_config.baseUrl}/${endpoint}`, {
            method: 'GET',
            headers: _headers(),
            credentials: 'include'
        });

        if (!response.ok) throw new Error(`GET /${endpoint} failed: ${response.status}`);
        return response.json();
    }

    /**
     * POST request to Service Layer
     */
    async function post(endpoint, body) {
        if (!_connected) throw new Error('Not connected to SAP');

        const response = await fetch(`${_config.baseUrl}/${endpoint}`, {
            method: 'POST',
            headers: _headers(),
            body: JSON.stringify(body),
            credentials: 'include'
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`POST /${endpoint} failed: ${response.status} — ${errorBody}`);
        }

        return response.json();
    }

    // ═══════════════════════════════════════
    // DRAFT POSTING
    // ═══════════════════════════════════════

    /**
     * Post a document as a Draft to SAP B1
     * @param {object} extractedData - Validated extraction result
     * @param {string} fileName - Original document filename
     * @returns {object} { success, docEntry, docNum, error }
     */
    async function postDraft(extractedData, fileName) {
        const docObjectCode = DOC_OBJECT_NAMES[extractedData.docType];

        const payload = {
            DocObjectCode: docObjectCode,
            CardCode: extractedData.cardCode !== '—' ? extractedData.cardCode : undefined,
            DocDate: extractedData.docDate !== '—' ? extractedData.docDate : undefined,
            NumAtCard: extractedData.docNumber !== '—' ? extractedData.docNumber : undefined,
            Comments: `Agentic AI — Auto-extracted from ${fileName}`,
            DocumentLines: extractedData.lines
                .filter(l => l.status !== 'rejected')
                .map(l => ({
                    ItemCode: l.itemCode !== 'UNRESOLVED' ? l.itemCode : undefined,
                    ItemDescription: l.description,
                    Quantity: l.quantity,
                    UnitPrice: l.unitPrice
                }))
        };

        // ── Connected mode: real API call ──
        if (_connected) {
            try {
                const result = await post('Drafts', payload);
                return {
                    success: true,
                    docEntry: result.DocEntry,
                    docNum: result.DocNum,
                    payload,
                    source: 'LIVE'
                };
            } catch (err) {
                return { success: false, error: err.message, payload, source: 'LIVE' };
            }
        }

        // ── Sandbox mode: simulate ──
        return _simulateDraftPost(payload, extractedData.docType);
    }

    /**
     * Simulate a draft post for demo/sandbox mode
     */
    function _simulateDraftPost(payload, docType) {
        const draftEntry = Math.floor(10000 + Math.random() * 89999);
        const draftNum = `DR-${new Date().getFullYear()}-${String(draftEntry).substring(0, 5)}`;

        const targetTable = {
            'SALES_ORDER': 'ORDR',
            'PURCHASE_ORDER': 'OPOR',
            'DELIVERY_NOTE': 'ODLN'
        }[docType] || 'ORDR';

        console.log(`[SAPServiceLayer] 📦 Sandbox Draft → ${targetTable} #${draftEntry}`);

        return {
            success: true,
            docEntry: draftEntry,
            docNum: draftNum,
            targetTable,
            payload,
            source: 'SANDBOX'
        };
    }

    // ═══════════════════════════════════════
    // PAYLOAD BUILDER (for display)
    // ═══════════════════════════════════════

    /**
     * Build a display-friendly SAP payload
     */
    function buildPayload(extractedData, fileName) {
        return {
            DocObjectCode: DOC_OBJECT_NAMES[extractedData.docType],
            DocObjectCodeNum: DOC_OBJECT_CODES[extractedData.docType],
            TargetTable: {
                'SALES_ORDER': 'ORDR',
                'PURCHASE_ORDER': 'OPOR',
                'DELIVERY_NOTE': 'ODLN'
            }[extractedData.docType],
            CardCode: extractedData.cardCode !== '—' ? extractedData.cardCode : null,
            DocDate: extractedData.docDate !== '—' ? extractedData.docDate : null,
            NumAtCard: extractedData.docNumber !== '—' ? extractedData.docNumber : null,
            Comments: `Agentic AI — Auto-extracted from ${fileName}`,
            DocumentLines: extractedData.lines
                .filter(l => l.status !== 'rejected')
                .map(l => ({
                    ItemCode: l.itemCode !== 'UNRESOLVED' ? l.itemCode : null,
                    ItemDescription: l.description,
                    Quantity: l.quantity,
                    UnitPrice: l.unitPrice
                }))
        };
    }

    // ═══════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════

    function isConnected() { return _connected; }
    function getSessionId() { return _sessionId; }

    function init() {
        // Try to restore config from SAPHandshake if available
        if (typeof SAPHandshake !== 'undefined') {
            const cfg = SAPHandshake.getConfig?.();
            if (cfg && cfg.url) {
                _config = {
                    baseUrl: cfg.url,
                    companyDB: cfg.companyDB,
                    userName: cfg.user,
                    password: cfg.password
                };
            }
        }
        console.log('[SAPServiceLayer] ✅ Initialized — Drafts API ready');
    }

    return {
        init,
        login,
        logout,
        get,
        post,
        postDraft,
        buildPayload,
        isConnected,
        getSessionId
    };
})();
