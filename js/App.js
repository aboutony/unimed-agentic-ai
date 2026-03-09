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
    // 7. PHASE 3 — UAT & DEMO
    // ══════════════════════════════════════
    UATConsole.init();
    FounderDemo.init();

    // ── UAT Lockdown Banner ──
    if (ValidationAgents.isLocked && ValidationAgents.isLocked()) {
        const banner = document.getElementById('uatLockdownBanner');
        if (banner) {
            banner.style.display = '';
            const stats = ValidationAgents.getStats();
            const scope = document.getElementById('uatLockdownScope');
            if (scope) scope.textContent = `${stats.customers} Customers · ${stats.vendors} Vendors · ${stats.items} Items`;
            const thresh = document.getElementById('uatLockdownThreshold');
            if (thresh) thresh.textContent = `Fuzzy: ${ValidationAgents.getFuzzyThreshold()}`;
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
        if (e.key === 'Escape') closeSettings();
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
    // 6. LOGOUT
    // ══════════════════════════════════════
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            AuthGateway.logout();
        });
    }

    // ══════════════════════════════════════
    // 7. BOOT COMPLETE
    // ══════════════════════════════════════
    console.log('[App] ════════════════════════════════════');
    console.log('[App] UNIMED Agentic AI — Phase 3 UAT Online');
    console.log(`[App] Domain: ${DomainLock.getDomain()}`);
    console.log(`[App] Theme: ${ThemeEngine.current()}`);
    console.log(`[App] Language: ${TranslationModule.current()}`);
    console.log(`[App] Founder: ${isFounder}`);
    console.log(`[App] Environment: ${ValidationAgents.getEnvironment()}`);
    console.log('[App] ════════════════════════════════════');

})();
