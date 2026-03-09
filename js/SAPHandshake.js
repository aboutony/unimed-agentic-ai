/* ═══════════════════════════════════════════════════════════
   UNIMED AGENTIC AI — SAP Handshake Module
   Manages SAP Business One v10.0 Service Layer connectivity
   Handshake states: Idle → Syncing → Connected → Error
   ═══════════════════════════════════════════════════════════ */

const SAPHandshake = (() => {
    const STORAGE_KEY = 'unimed-sap-config';

    const STATES = {
        IDLE: 'idle',
        SYNCING: 'syncing',
        CONNECTED: 'connected',
        ERROR: 'error'
    };

    let currentState = STATES.IDLE;
    let _onStateChange = null;

    /**
     * Update all visual indicators to reflect current state
     */
    function _updateVisuals(state) {
        currentState = state;

        // Topbar dot
        const topbarDot = document.getElementById('sapDotTopbar');
        if (topbarDot) {
            topbarDot.className = `sap-dot ${state}`;
        }

        // Panel indicator
        const indicator = document.getElementById('handshakeIndicator');
        if (indicator) {
            indicator.className = `handshake-indicator ${state}`;
        }

        // Panel labels
        const label = document.getElementById('handshakeLabel');
        const sub = document.getElementById('handshakeSub');
        if (label && sub) {
            switch (state) {
                case STATES.IDLE:
                    label.setAttribute('data-i18n', 'handshakeIdle');
                    sub.setAttribute('data-i18n', 'handshakeSub');
                    break;
                case STATES.SYNCING:
                    label.setAttribute('data-i18n', 'handshakeSyncing');
                    sub.setAttribute('data-i18n', 'handshakeSyncSub');
                    break;
                case STATES.CONNECTED:
                    label.setAttribute('data-i18n', 'handshakeConnected');
                    sub.setAttribute('data-i18n', 'handshakeConnSub');
                    break;
                case STATES.ERROR:
                    label.setAttribute('data-i18n', 'handshakeError');
                    sub.setAttribute('data-i18n', 'handshakeErrorSub');
                    break;
            }

            // Re-apply translations if TranslationModule is available
            if (typeof TranslationModule !== 'undefined') {
                label.textContent = TranslationModule.t(label.getAttribute('data-i18n'));
                sub.textContent = TranslationModule.t(sub.getAttribute('data-i18n'));
            }
        }

        // SAP card badge on dashboard
        const cardBadge = document.getElementById('sapCardBadge');
        if (cardBadge) {
            switch (state) {
                case STATES.IDLE:
                    cardBadge.className = 'card-badge pending';
                    cardBadge.textContent = TranslationModule?.t('badgeDisconnected') || 'Disconnected';
                    break;
                case STATES.SYNCING:
                    cardBadge.className = 'card-badge ai';
                    cardBadge.textContent = 'Syncing...';
                    break;
                case STATES.CONNECTED:
                    cardBadge.className = 'card-badge ready';
                    cardBadge.textContent = 'Connected';
                    break;
                case STATES.ERROR:
                    cardBadge.className = 'card-badge pending';
                    cardBadge.textContent = 'Error';
                    break;
            }
        }

        // Service layer dot
        const serviceDot = document.getElementById('sapServiceDot');
        if (serviceDot) {
            switch (state) {
                case STATES.IDLE: serviceDot.className = 'activity-dot warning'; break;
                case STATES.SYNCING: serviceDot.className = 'activity-dot info'; break;
                case STATES.CONNECTED: serviceDot.className = 'activity-dot success'; break;
                case STATES.ERROR: serviceDot.className = 'activity-dot critical'; break;
            }
        }

        const serviceStatus = document.getElementById('sapServiceStatus');
        if (serviceStatus) {
            switch (state) {
                case STATES.IDLE: serviceStatus.textContent = TranslationModule?.t('sapStatus1') || 'Not configured'; break;
                case STATES.SYNCING: serviceStatus.textContent = 'Connecting...'; break;
                case STATES.CONNECTED: serviceStatus.textContent = 'Operational'; break;
                case STATES.ERROR: serviceStatus.textContent = 'Failed'; break;
            }
        }

        if (_onStateChange) _onStateChange(state);
    }

    /**
     * Save SAP config
     */
    function _saveConfig() {
        const config = {
            url: document.getElementById('sapUrl')?.value || '',
            companyDB: document.getElementById('sapCompanyDB')?.value || '',
            user: document.getElementById('sapUser')?.value || '',
            // Password intentionally NOT stored
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    }

    /**
     * Load saved SAP config into form
     */
    function _loadConfig() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        try {
            const config = JSON.parse(raw);
            const urlEl = document.getElementById('sapUrl');
            const dbEl = document.getElementById('sapCompanyDB');
            const userEl = document.getElementById('sapUser');
            if (urlEl) urlEl.value = config.url || '';
            if (dbEl) dbEl.value = config.companyDB || '';
            if (userEl) userEl.value = config.user || '';
        } catch { /* ignore */ }
    }

    /**
     * Simulate SAP Service Layer /Login handshake
     * In production, this would POST to the actual Service Layer endpoint
     */
    async function _testHandshake() {
        const url = document.getElementById('sapUrl')?.value?.trim();
        const db = document.getElementById('sapCompanyDB')?.value?.trim();
        const user = document.getElementById('sapUser')?.value?.trim();
        const pass = document.getElementById('sapPassword')?.value;

        // Validate inputs
        if (!url || !db || !user || !pass) {
            _updateVisuals(STATES.ERROR);
            return false;
        }

        _saveConfig();
        _updateVisuals(STATES.SYNCING);

        // Simulate network handshake (2.5s for visual drama)
        await new Promise(r => setTimeout(r, 2500));

        // Demo mode: always succeed if fields are filled
        // In production: POST to `${url}/Login` with { CompanyDB, UserName, Password }
        const success = true;

        if (success) {
            _updateVisuals(STATES.CONNECTED);
            console.log('[SAPHandshake] B1SESSION established (demo mode)');
        } else {
            _updateVisuals(STATES.ERROR);
        }

        return success;
    }

    return {
        init() {
            _loadConfig();
            _updateVisuals(STATES.IDLE);
        },

        async testConnection() {
            return _testHandshake();
        },

        getState() {
            return currentState;
        },

        onStateChange(callback) {
            _onStateChange = callback;
        },

        STATES
    };
})();
