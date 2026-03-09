/* ═══════════════════════════════════════════════════════════
   UNIMED AGENTIC AI — Application Orchestrator
   Initializes: Auth → Theme → Translation → Domain Lock → SAP
   ═══════════════════════════════════════════════════════════ */

(function App() {
    'use strict';

    // ══════════════════════════════════════
    // 1. AUTH GUARD — Must be first
    // ══════════════════════════════════════
    if (!AuthGateway.guard()) return;

    const session = AuthGateway.getSession();
    console.log(`[App] Welcome, ${session.name} (${session.role})`);

    // ══════════════════════════════════════
    // 2. THEME ENGINE
    // ══════════════════════════════════════
    ThemeEngine.init();

    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
        themeBtn.textContent = ThemeEngine.current() === 'dark' ? '☀️' : '🌙';
        themeBtn.addEventListener('click', () => {
            ThemeEngine.toggle();
            themeBtn.textContent = ThemeEngine.current() === 'dark' ? '☀️' : '🌙';
        });
    }

    // ══════════════════════════════════════
    // 3. TRANSLATION MODULE
    // ══════════════════════════════════════
    TranslationModule.init();

    const langBtn = document.getElementById('langToggle');
    if (langBtn) {
        langBtn.textContent = TranslationModule.current() === 'en' ? 'EN' : 'عر';
        langBtn.addEventListener('click', () => {
            const next = TranslationModule.toggle();
            langBtn.textContent = next === 'en' ? 'EN' : 'عر';
        });
    }

    // ══════════════════════════════════════
    // 4. DOMAIN LOCK 
    //    Founder Override: adonis@saqr.io
    // ══════════════════════════════════════
    const isFounder = AuthGateway.isFounder();
    DomainLock.init(isFounder);

    if (isFounder) {
        console.log('[App] 👑 Founder Override active — full DOM access granted');
    }

    // ══════════════════════════════════════
    // 5. SAP HANDSHAKE
    // ══════════════════════════════════════
    SAPHandshake.init();

    // ══════════════════════════════════════
    // 6. PHASE 2 — AGENTIC AI PIPELINE
    // ══════════════════════════════════════
    AuditChain.init();
    ExtractionEngine.init();
    DocumentClassifier.init();
    FieldExtractor.init();
    ValidationAgents.init();
    SAPServiceLayer.init();
    AttachmentManager.init();
    PipelineController.init();

    // ══════════════════════════════════════
    // 7. PHASE 4 — PRODUCTION & HYPERCARE
    // ══════════════════════════════════════
    UATConsole.init();
    FounderDemo.init();

    // ── Production Banner ──
    const env = ValidationAgents.getEnvironment();
    if (env === 'PRODUCTION') {
        const banner = document.getElementById('productionBanner');
        if (banner) {
            banner.style.display = '';
            const syncStatus = ValidationAgents.getDocTypeSyncStatus();
            const scopeEl = document.getElementById('productionBannerScope');
            if (scopeEl) {
                const syncedTypes = Object.values(syncStatus).filter(s => s.synced).map(s => s.label.split('(')[1]?.replace(')', '') || s.label);
                scopeEl.textContent = syncedTypes.join(' · ') + ' Synced';
            }
            const dateEl = document.getElementById('productionBannerDate');
            if (dateEl) {
                const goLive = new Date(ValidationAgents.getProductionSince());
                dateEl.textContent = `Go-Live: ${goLive.toLocaleDateString('en-CA')}`;
            }
        }
    }

    // ── Hypercare Monitor (Founder Only) ──
    if (typeof HypercareMonitor !== 'undefined') {
        HypercareMonitor.init();

        if (isFounder) {
            // Show hypercare button in topbar
            const hcBtn = document.getElementById('hypercareBtn');
            if (hcBtn) hcBtn.style.display = '';

            // Toggle hypercare panel
            hcBtn?.addEventListener('click', () => HypercareMonitor.toggle());
            document.getElementById('hypercareClose')?.addEventListener('click', () => HypercareMonitor.hide());
            document.getElementById('hypercareOverlay')?.addEventListener('click', () => HypercareMonitor.hide());
            document.getElementById('hypercareExportBtn')?.addEventListener('click', () => HypercareMonitor.exportReport());
        }
    }

    // Settings panel open/close
    const settingsGear = document.getElementById('settingsGear');
    const settingsPanel = document.getElementById('settingsPanel');
    const settingsOverlay = document.getElementById('settingsOverlay');
    const settingsClose = document.getElementById('settingsClose');

    function openSettings() {
        settingsPanel.classList.add('active');
        settingsOverlay.classList.add('active');
        settingsGear.classList.add('active');
    }

    function closeSettings() {
        settingsPanel.classList.remove('active');
        settingsOverlay.classList.remove('active');
        settingsGear.classList.remove('active');
    }

    if (settingsGear) settingsGear.addEventListener('click', openSettings);
    if (settingsClose) settingsClose.addEventListener('click', closeSettings);
    if (settingsOverlay) settingsOverlay.addEventListener('click', closeSettings);

    // Keyboard: Escape to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeSettings();
            if (typeof HypercareMonitor !== 'undefined') HypercareMonitor.hide();
        }
    });

    // Test Connection button
    const sapTestBtn = document.getElementById('sapTestBtn');
    if (sapTestBtn) {
        sapTestBtn.addEventListener('click', async () => {
            sapTestBtn.disabled = true;
            await SAPHandshake.testConnection();
            sapTestBtn.disabled = false;
        });
    }

    // ══════════════════════════════════════
    // 8. LOGOUT
    // ══════════════════════════════════════
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            AuthGateway.logout();
        });
    }

    // ══════════════════════════════════════
    // 9. BOOT COMPLETE
    // ══════════════════════════════════════
    console.log('[App] ════════════════════════════════════');
    console.log('[App] UNIMED Agentic AI — Phase 4 PRODUCTION');
    console.log(`[App] Domain: ${DomainLock.getDomain()}`);
    console.log(`[App] Theme: ${ThemeEngine.current()}`);
    console.log(`[App] Language: ${TranslationModule.current()}`);
    console.log(`[App] Founder: ${isFounder}`);
    console.log(`[App] Environment: ${ValidationAgents.getEnvironment()}`);
    console.log(`[App] Go-Live: ${ValidationAgents.getProductionSince()}`);
    console.log('[App] ════════════════════════════════════');

})();
