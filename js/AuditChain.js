/* ═══════════════════════════════════════════════════════════
   UNIMED AGENTIC AI — SHA-256 Audit Chain
   Tamper-proof hash chain for document lifecycle tracking
   Every action from upload → SAP posting is recorded
   ═══════════════════════════════════════════════════════════ */

const AuditChain = (() => {
    'use strict';

    const STORAGE_KEY = 'unimed-audit-chain';
    let chain = [];
    let _onEntry = null;

    /**
     * Compute SHA-256 hash of a string
     * Uses Web Crypto API (native, no dependencies)
     */
    async function _sha256(message) {
        const encoder = new TextEncoder();
        const data = encoder.encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Compute SHA-256 hash of a file (ArrayBuffer)
     */
    async function _hashFile(arrayBuffer) {
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Record a new audit entry
     * @param {string} action - Action type: 'UPLOAD', 'CLASSIFY', 'EXTRACT', 'VALIDATE', 'SAP_DRAFT', 'ATTACHMENT'
     * @param {object} payload - Action-specific data
     * @param {string} operator - Username performing the action
     * @returns {object} The audit entry with hash
     */
    async function record(action, payload, operator) {
        const prevHash = chain.length > 0
            ? chain[chain.length - 1].hash
            : '0'.repeat(64); // Genesis block

        const timestamp = new Date().toISOString();

        const entryData = JSON.stringify({
            action,
            timestamp,
            operator,
            payload,
            prevHash
        });

        const hash = await _sha256(entryData);

        const entry = {
            id: chain.length,
            action,
            timestamp,
            operator,
            payload,
            prevHash,
            hash
        };

        chain.push(entry);
        _persist();

        if (_onEntry) _onEntry(entry);

        console.log(`[AuditChain] #${entry.id} ${action} → ${hash.substring(0, 16)}...`);
        return entry;
    }

    /**
     * Verify the integrity of the entire chain
     * @returns {object} { valid: boolean, brokenAt: number|null }
     */
    async function verify() {
        if (chain.length === 0) return { valid: true, brokenAt: null };

        for (let i = 0; i < chain.length; i++) {
            const entry = chain[i];

            // Check prevHash links
            if (i === 0) {
                if (entry.prevHash !== '0'.repeat(64)) {
                    return { valid: false, brokenAt: 0 };
                }
            } else {
                if (entry.prevHash !== chain[i - 1].hash) {
                    return { valid: false, brokenAt: i };
                }
            }

            // Re-compute hash to verify integrity
            const entryData = JSON.stringify({
                action: entry.action,
                timestamp: entry.timestamp,
                operator: entry.operator,
                payload: entry.payload,
                prevHash: entry.prevHash
            });

            const computedHash = await _sha256(entryData);
            if (computedHash !== entry.hash) {
                return { valid: false, brokenAt: i };
            }
        }

        return { valid: true, brokenAt: null };
    }

    /**
     * Get all chain entries
     */
    function getChain() {
        return [...chain];
    }

    /**
     * Get the latest entry
     */
    function latest() {
        return chain.length > 0 ? chain[chain.length - 1] : null;
    }

    /**
     * Reset the chain (for new document sessions)
     */
    function reset() {
        chain = [];
        _persist();
        console.log('[AuditChain] Chain reset — genesis awaiting');
    }

    /**
     * Register a callback for new entries
     */
    function onEntry(callback) {
        _onEntry = callback;
    }

    /**
     * Persist chain to localStorage
     */
    function _persist() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(chain));
        } catch (e) {
            console.warn('[AuditChain] Storage write failed:', e);
        }
    }

    /**
     * Load chain from localStorage
     */
    function _load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                chain = JSON.parse(raw);
                console.log(`[AuditChain] Loaded ${chain.length} entries from storage`);
            }
        } catch {
            chain = [];
        }
    }

    /**
     * Initialize the audit chain
     */
    function init() {
        _load();
        console.log('[AuditChain] ✅ Initialized — SHA-256 hash chain active');
    }

    return {
        init,
        record,
        verify,
        getChain,
        latest,
        reset,
        onEntry,
        hashFile: _hashFile
    };
})();
