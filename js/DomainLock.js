/* ═══════════════════════════════════════════════════════════
   UNIMED AGENTIC AI — Domain Lock
   Sovereign Domain: HEALTHCARE
   Founder Override: adonis@saqr.io bypasses pruning
   ═══════════════════════════════════════════════════════════ */

const DomainLock = (() => {
    const SOVEREIGN_DOMAIN = 'HEALTHCARE';

    // Non-healthcare domains that must be pruned
    const FOREIGN_DOMAINS = [
        'FLEET', 'LEGAL', 'CONSTRUCTION', 'RETAIL', 'MANUFACTURING',
        'LOGISTICS', 'AGRICULTURE', 'EDUCATION', 'FINANCE', 'MINING',
        'REAL_ESTATE', 'HOSPITALITY', 'TELECOMMUNICATIONS', 'ENERGY'
    ];

    let _isFounderOverride = false;

    /**
     * Prune all DOM elements with data-domain attributes
     * that don't match HEALTHCARE.
     * Founder Override: if logged in as adonis@saqr.io, skip pruning.
     */
    function _pruneDOM() {
        if (_isFounderOverride) {
            console.log(`[DomainLock] Founder Override active — DOM pruning bypassed`);
            return;
        }

        const allDomainElements = document.querySelectorAll('[data-domain]');
        let pruned = 0;

        allDomainElements.forEach(el => {
            const elDomain = el.getAttribute('data-domain').toUpperCase().trim();
            if (elDomain !== SOVEREIGN_DOMAIN) {
                el.remove();
                pruned++;
            }
        });

        if (pruned > 0) {
            console.log(`[DomainLock] Pruned ${pruned} non-HEALTHCARE element(s) from DOM`);
        }

        console.log(`[DomainLock] Sovereign Domain: ${SOVEREIGN_DOMAIN} — locked`);
    }

    /**
     * Continuous watcher — ensures no foreign elements are injected
     * after initial load (e.g., via dynamic rendering)
     */
    function _deployWatcher() {
        if (_isFounderOverride) return;

        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const domain = node.getAttribute?.('data-domain');
                        if (domain && domain.toUpperCase().trim() !== SOVEREIGN_DOMAIN) {
                            node.remove();
                            console.warn(`[DomainLock] Intercepted & pruned foreign element: domain="${domain}"`);
                        }
                        // Also check descendants
                        const nested = node.querySelectorAll?.('[data-domain]');
                        nested?.forEach(child => {
                            const d = child.getAttribute('data-domain').toUpperCase().trim();
                            if (d !== SOVEREIGN_DOMAIN) {
                                child.remove();
                            }
                        });
                    }
                });
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    return {
        /**
         * Initialize Domain Lock
         * @param {boolean} founderOverride - If true, skip pruning (Founder access)
         */
        init(founderOverride = false) {
            _isFounderOverride = founderOverride;
            _pruneDOM();
            _deployWatcher();
        },

        /** Get the sovereign domain */
        getDomain() {
            return SOVEREIGN_DOMAIN;
        },

        /** Check if Founder Override is active */
        isFounderOverrideActive() {
            return _isFounderOverride;
        },

        /** Get domain metadata */
        getMetadata() {
            return {
                domain: SOVEREIGN_DOMAIN,
                founderOverride: _isFounderOverride,
                foreignDomains: FOREIGN_DOMAINS,
                timestamp: new Date().toISOString()
            };
        }
    };
})();
