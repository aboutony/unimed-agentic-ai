/* ═══════════════════════════════════════════════════════════
   UNIMED AGENTIC AI — Translation Module
   EN ↔ AR with SAR currency formatting
   Uses Official Saudi Riyal symbol (﷼) for premium display
   ═══════════════════════════════════════════════════════════ */

const TranslationModule = (() => {
    const STORAGE_KEY = 'unimed-lang';

    // ── Official Saudi Riyal Unicode Symbol ──
    const SAR_SYMBOL_EN = 'SAR';     // English display with ﷼ used in formatting
    const SAR_SYMBOL_AR = 'ر.س';     // Arabic display

    // ── Translation Dictionary ──
    const DICT = {
        en: {
            // Login
            loginTitle: 'UNIMED',
            loginSubtitle: 'Agentic AI Document Suite',
            emailLabel: 'Email / Username',
            passwordLabel: 'Password',
            loginBtn: 'Authenticate',
            domainLock: 'Sovereign Domain',

            // Topbar
            brandName: 'UNIMED',
            domainBadge: 'HEALTHCARE',

            // Welcome
            welcomeTitle: 'Agentic AI Command Center',
            welcomeDesc: 'Intelligent document processing, automated SAP integration, and real-time analytics — purpose-built for healthcare operations.',

            // Document Queue
            docQueueTitle: '📄 Document Queue',
            docQueueDesc: 'Pending invoices, purchase orders, and delivery notes awaiting AI extraction and SAP posting.',
            badgeAI: 'AI Ready',

            // AI Processing
            aiProcessTitle: '🤖 AI Processing',
            badgeStandby: 'Standby',
            aiItem1: 'OCR Engine — Idle',
            aiItem2: 'NLP Classifier — Standby',
            aiItem3: 'Field Extraction — Awaiting',
            aiTime1: '—',
            aiTime2: '—',
            aiTime3: '—',

            // SAP Status
            sapStatusTitle: '🔷 SAP B1 Integration',
            badgeDisconnected: 'Disconnected',
            sapItem1: 'Service Layer v10.0',
            sapItem2: 'DI API Adapter',
            sapItem3: 'Document Posting',
            sapStatus1: 'Not configured',
            sapStatus2: 'Pending setup',
            sapStatus3: 'Inactive',

            // Compliance
            complianceTitle: '🛡️ Compliance Engine',
            badgeArmed: 'Armed',
            compItem1: 'SFDA Regulatory Gate',
            compItem2: 'SABER Conformity',
            compItem3: 'SHA-256 Audit Chain',
            compStatus1: 'Active',
            compStatus2: 'Armed',
            compStatus3: 'Initialized',

            // Settings
            settingsTitle: '⚙️ Integration Hub',
            sapSectionTitle: 'SAP Business One v10.0',
            sapUrlLabel: 'Service Layer URL',
            sapDbLabel: 'Company Database',
            sapUserLabel: 'SAP Username',
            sapPassLabel: 'SAP Password',
            testConnection: '🤝 Test Handshake',
            sapVersion: 'Targeting',
            sapProtocol: 'Service Layer (REST)',

            // Handshake
            handshakeIdle: 'Idle — Not Connected',
            handshakeSub: 'Configure credentials and test connection',
            handshakeSyncing: 'Syncing — Establishing handshake...',
            handshakeSyncSub: 'Authenticating with SAP Service Layer',
            handshakeConnected: 'Connected — Handshake Complete',
            handshakeConnSub: 'B1SESSION active · Service Layer operational',
            handshakeError: 'Error — Connection Failed',
            handshakeErrorSub: 'Check credentials and server availability',

            // Pipeline UI
            pipelineIngestion: 'Document Ingestion',
            pipelineIngestionSub: 'Upload PDF documents for AI-powered extraction and SAP integration',
            pipelineDropTitle: 'Drop your document here',
            pipelineDropSub: 'Sales Orders, Purchase Orders, and Delivery Notes',
            pipelineBrowse: '📁 Browse Files',
            pipelineSupported: 'Supported: PDF · Max 25MB · Invoices excluded from this phase',
            pipelineStepIngest: 'Ingestion',
            pipelineStepClassify: 'Classification',
            pipelineStepExtract: 'Extraction',
            pipelineStepValidate: 'SAP Ready',
            extractionTitle: 'Extraction Preview',
            extractionSub: 'AI-extracted fields mapped to SAP schema',
            reviewTitle: 'Review Queue',
            reviewSub: 'Items requiring manual verification before SAP posting',
            auditTitle: 'SHA-256 Audit Chain',
            auditSub: 'Tamper-proof record of every document lifecycle event',

            // Success Card
            successDraftCreated: 'Draft Created Successfully',
            successSubtext: 'Your document has been posted to SAP B1 as a draft',
            successDocEntry: 'DocEntry',
            successDraftNum: 'Draft Number',
            successTargetTable: 'Target Table',
            successDocType: 'Document Type',
            successBP: 'Business Partner',
            successLineItems: 'Line Items',
            successTotalValue: 'Total Value',
            successSource: 'Source',
            successLiveSAP: '🟢 Live SAP',
            successSandbox: '🟡 Sandbox',
            successNewDoc: '🚀 Process New Document',
            successAttachLinked: 'PDF attached and linked to draft transaction',

            // SAP Ready
            sapReadyTitle: '📦 SAP B1 Draft Payload',
            sapPostBtn: '📦 Post as Draft to SAP B1',
        },
        ar: {
            // Login
            loginTitle: 'يونيميد',
            loginSubtitle: 'مجموعة وثائق الذكاء الاصطناعي',
            emailLabel: 'البريد الإلكتروني / اسم المستخدم',
            passwordLabel: 'كلمة المرور',
            loginBtn: 'مصادقة',
            domainLock: 'النطاق السيادي',

            // Topbar
            brandName: 'يونيميد',
            domainBadge: 'الرعاية الصحية',

            // Welcome
            welcomeTitle: 'مركز قيادة الذكاء الاصطناعي',
            welcomeDesc: 'معالجة المستندات الذكية، والتكامل التلقائي مع SAP، والتحليلات الفورية — مصمم خصيصاً لعمليات الرعاية الصحية.',

            // Document Queue
            docQueueTitle: '📄 قائمة المستندات',
            docQueueDesc: 'الفواتير وأوامر الشراء وإشعارات التسليم المعلقة في انتظار الاستخراج بالذكاء الاصطناعي والترحيل إلى SAP.',
            badgeAI: 'جاهز للذكاء الاصطناعي',

            // AI Processing
            aiProcessTitle: '🤖 معالجة الذكاء الاصطناعي',
            badgeStandby: 'استعداد',
            aiItem1: 'محرك OCR — خامل',
            aiItem2: 'مصنف NLP — استعداد',
            aiItem3: 'استخراج الحقول — في الانتظار',
            aiTime1: '—',
            aiTime2: '—',
            aiTime3: '—',

            // SAP Status
            sapStatusTitle: '🔷 تكامل SAP B1',
            badgeDisconnected: 'غير متصل',
            sapItem1: 'طبقة الخدمة v10.0',
            sapItem2: 'محول DI API',
            sapItem3: 'ترحيل المستندات',
            sapStatus1: 'غير مهيأ',
            sapStatus2: 'في انتظار الإعداد',
            sapStatus3: 'غير نشط',

            // Compliance
            complianceTitle: '🛡️ محرك الامتثال',
            badgeArmed: 'مسلّح',
            compItem1: 'بوابة هيئة الغذاء والدواء',
            compItem2: 'مطابقة سابر',
            compItem3: 'سلسلة تدقيق SHA-256',
            compStatus1: 'نشط',
            compStatus2: 'مسلّح',
            compStatus3: 'مُهيّأ',

            // Settings
            settingsTitle: '⚙️ مركز التكامل',
            sapSectionTitle: 'SAP Business One v10.0',
            sapUrlLabel: 'رابط طبقة الخدمة',
            sapDbLabel: 'قاعدة بيانات الشركة',
            sapUserLabel: 'اسم مستخدم SAP',
            sapPassLabel: 'كلمة مرور SAP',
            testConnection: '🤝 اختبار الاتصال',
            sapVersion: 'يستهدف',
            sapProtocol: 'طبقة الخدمة (REST)',

            // Handshake
            handshakeIdle: 'خامل — غير متصل',
            handshakeSub: 'قم بتهيئة بيانات الاعتماد واختبار الاتصال',
            handshakeSyncing: 'مزامنة — جارٍ إنشاء الاتصال...',
            handshakeSyncSub: 'المصادقة مع طبقة خدمة SAP',
            handshakeConnected: 'متصل — اكتمل التواصل',
            handshakeConnSub: 'جلسة B1SESSION نشطة · طبقة الخدمة تعمل',
            handshakeError: 'خطأ — فشل الاتصال',
            handshakeErrorSub: 'تحقق من بيانات الاعتماد وتوفر الخادم',

            // Pipeline UI
            pipelineIngestion: 'استقبال المستندات',
            pipelineIngestionSub: 'ارفع مستندات PDF للاستخراج الذكي والتكامل مع SAP',
            pipelineDropTitle: 'أسقط مستندك هنا',
            pipelineDropSub: 'أوامر البيع، أوامر الشراء، وإشعارات التسليم',
            pipelineBrowse: '📁 تصفح الملفات',
            pipelineSupported: 'المدعوم: PDF · الحد 25 ميجابايت · الفواتير مستبعدة من هذه المرحلة',
            pipelineStepIngest: 'الاستقبال',
            pipelineStepClassify: 'التصنيف',
            pipelineStepExtract: 'الاستخراج',
            pipelineStepValidate: 'جاهز لـ SAP',
            extractionTitle: 'معاينة الاستخراج',
            extractionSub: 'الحقول المُستخرَجة بالذكاء الاصطناعي ومُعيَّنة وفق مخطط SAP',
            reviewTitle: 'قائمة المراجعة',
            reviewSub: 'بنود تتطلب التحقق اليدوي قبل الترحيل إلى SAP',
            auditTitle: 'سلسلة تدقيق SHA-256',
            auditSub: 'سجل مقاوم للتلاعب لكل حدث في دورة حياة المستند',

            // Success Card
            successDraftCreated: 'تم إنشاء المسودة بنجاح',
            successSubtext: 'تم ترحيل مستندك إلى SAP B1 كمسودة',
            successDocEntry: 'رقم القيد (DocEntry)',
            successDraftNum: 'رقم المسودة',
            successTargetTable: 'الجدول المستهدف',
            successDocType: 'نوع المستند',
            successBP: 'شريك الأعمال (Business Partner)',
            successLineItems: 'بنود السطور (Line Items)',
            successTotalValue: 'القيمة الإجمالية',
            successSource: 'المصدر',
            successLiveSAP: '🟢 SAP مباشر',
            successSandbox: '🟡 بيئة اختبار',
            successNewDoc: '🚀 معالجة مستند جديد',
            successAttachLinked: 'تم إرفاق PDF وربطه بمعاملة المسودة',

            // SAP Ready
            sapReadyTitle: '📦 حمولة مسودة SAP B1',
            sapPostBtn: '📦 ترحيل كمسودة إلى SAP B1',
        }
    };

    let currentLang = 'en';

    function _applyTranslations() {
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (DICT[currentLang][key]) {
                el.textContent = DICT[currentLang][key];
            }
        });
    }

    function _applyDirection() {
        if (currentLang === 'ar') {
            document.documentElement.setAttribute('dir', 'rtl');
            document.documentElement.setAttribute('lang', 'ar');
        } else {
            document.documentElement.setAttribute('dir', 'ltr');
            document.documentElement.setAttribute('lang', 'en');
        }
    }

    function _applyCurrencySymbols() {
        const symbols = document.querySelectorAll('[data-currency-symbol]');
        symbols.forEach(el => {
            if (currentLang === 'ar') {
                el.textContent = SAR_SYMBOL_AR;
            } else {
                // Premium: Use ﷼ Riyal sign for English display
                el.innerHTML = '<span style="font-size:0.85em;">﷼</span> SAR';
            }
        });
    }

    return {
        init() {
            const stored = localStorage.getItem(STORAGE_KEY);
            currentLang = stored || 'en';
            _applyDirection();
            _applyTranslations();
            _applyCurrencySymbols();
        },

        setLanguage(lang) {
            if (lang !== 'en' && lang !== 'ar') return;
            currentLang = lang;
            localStorage.setItem(STORAGE_KEY, lang);
            _applyDirection();
            _applyTranslations();
            _applyCurrencySymbols();
        },

        toggle() {
            const next = currentLang === 'en' ? 'ar' : 'en';
            this.setLanguage(next);
            return next;
        },

        current() {
            return currentLang;
        },

        /**
         * Format amount in SAR with proper locale
         * EN: ﷼ SAR 12,500.00
         * AR: ١٢٬٥٠٠٫٠٠ ر.س
         */
        formatCurrency(amount) {
            const num = parseFloat(amount) || 0;

            if (currentLang === 'ar') {
                const formatted = num.toLocaleString('ar-SA', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
                return `${formatted} ${SAR_SYMBOL_AR}`;
            }

            const formatted = num.toLocaleString('en-SA', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
            return `﷼ SAR ${formatted}`;
        },

        /**
         * Get translation string by key
         */
        t(key) {
            return DICT[currentLang]?.[key] || DICT['en']?.[key] || key;
        }
    };
})();
