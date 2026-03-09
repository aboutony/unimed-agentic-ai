/* ═══════════════════════════════════════════════════════════
   UNIMED AGENTIC AI — Extraction Engine
   Orchestrates: PDF.js rendering → Tesseract.js OCR → raw text
   Handles both PDF and image inputs client-side
   ═══════════════════════════════════════════════════════════ */

const ExtractionEngine = (() => {
    'use strict';

    let _worker = null;
    let _isReady = false;
    let _onProgress = null;

    // ═══════════════════════════════════════
    // TESSERACT.JS WORKER SETUP
    // ═══════════════════════════════════════

    /**
     * Initialize Tesseract.js worker (lazy, first-use)
     * Uses CDN-hosted worker + language data
     */
    async function _ensureWorker() {
        if (_worker && _isReady) return _worker;

        _reportProgress('ocr_init', 'Initializing Tesseract.js OCR engine...');

        _worker = await Tesseract.createWorker('eng+ara', 1, {
            logger: (info) => {
                if (info.status === 'recognizing text') {
                    const pct = Math.round((info.progress || 0) * 100);
                    _reportProgress('ocr_progress', `OCR processing... ${pct}%`, pct);
                }
            }
        });

        _isReady = true;
        _reportProgress('ocr_ready', 'Tesseract.js engine ready');
        console.log('[ExtractionEngine] Tesseract.js worker initialized');
        return _worker;
    }

    // ═══════════════════════════════════════
    // PDF.JS RENDERING
    // ═══════════════════════════════════════

    /**
     * Render a PDF file to an array of canvas ImageData
     * Uses PDF.js to rasterize each page at 2x DPI for OCR quality
     * @param {ArrayBuffer} pdfBuffer - Raw PDF bytes
     * @returns {Promise<HTMLCanvasElement[]>} Array of rendered canvases
     */
    async function _renderPDFPages(pdfBuffer) {
        _reportProgress('pdf_render', 'Rendering PDF pages...');

        const pdf = await pdfjsLib.getDocument({ data: pdfBuffer }).promise;
        const pageCount = pdf.numPages;
        const canvases = [];

        console.log(`[ExtractionEngine] PDF loaded: ${pageCount} page(s)`);

        for (let i = 1; i <= Math.min(pageCount, 5); i++) {
            _reportProgress('pdf_render', `Rendering page ${i}/${Math.min(pageCount, 5)}...`);

            const page = await pdf.getPage(i);
            // Render at 2x scale for better OCR accuracy
            const scale = 2.0;
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');

            await page.render({ canvasContext: ctx, viewport }).promise;
            canvases.push(canvas);
        }

        _reportProgress('pdf_render_done', `Rendered ${canvases.length} page(s)`);
        return canvases;
    }

    // ═══════════════════════════════════════
    // IMAGE HANDLING
    // ═══════════════════════════════════════

    /**
     * Load an image file into a canvas for OCR
     * @param {File} imageFile
     * @returns {Promise<HTMLCanvasElement[]>}
     */
    async function _loadImage(imageFile) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(imageFile);

            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                URL.revokeObjectURL(url);
                resolve([canvas]);
            };

            img.onerror = (e) => {
                URL.revokeObjectURL(url);
                reject(new Error('Failed to load image file'));
            };

            img.src = url;
        });
    }

    // ═══════════════════════════════════════
    // CORE: EXTRACT TEXT FROM FILE
    // ═══════════════════════════════════════

    /**
     * Extract raw text from a file (PDF or image)
     * @param {File} file - The uploaded file
     * @returns {Promise<{text: string, pages: string[], confidence: number}>}
     */
    async function extractText(file) {
        const startTime = performance.now();
        let canvases = [];

        // ── Step 1: Convert file to canvas(es) ──
        const isPDF = file.type === 'application/pdf' || file.name.endsWith('.pdf');
        const isImage = file.type.startsWith('image/');

        if (isPDF) {
            const buffer = await file.arrayBuffer();
            canvases = await _renderPDFPages(buffer);
        } else if (isImage) {
            canvases = await _loadImage(file);
        } else {
            throw new Error(`Unsupported file type: ${file.type}`);
        }

        // ── Step 2: OCR each canvas ──
        await _ensureWorker();
        const pages = [];
        let totalConfidence = 0;

        for (let i = 0; i < canvases.length; i++) {
            _reportProgress('ocr_page', `OCR scanning page ${i + 1}/${canvases.length}...`);

            const result = await _worker.recognize(canvases[i]);
            const pageText = result.data.text || '';
            const pageConf = result.data.confidence || 0;

            pages.push(pageText);
            totalConfidence += pageConf;

            console.log(`[ExtractionEngine] Page ${i + 1}: ${pageText.length} chars, ${pageConf}% confidence`);
        }

        const fullText = pages.join('\n\n--- PAGE BREAK ---\n\n');
        const avgConfidence = pages.length > 0 ? Math.round(totalConfidence / pages.length) : 0;

        const elapsed = Math.round(performance.now() - startTime);
        _reportProgress('ocr_complete', `OCR complete in ${elapsed}ms`);

        console.log(`[ExtractionEngine] Total extraction: ${fullText.length} chars, ${avgConfidence}% avg confidence, ${elapsed}ms`);

        return {
            text: fullText,
            pages,
            confidence: avgConfidence,
            pageCount: pages.length,
            elapsedMs: elapsed
        };
    }

    // ═══════════════════════════════════════
    // PROGRESS REPORTING
    // ═══════════════════════════════════════

    function _reportProgress(stage, message, percent) {
        if (_onProgress) _onProgress({ stage, message, percent });
    }

    function onProgress(callback) {
        _onProgress = callback;
    }

    // ═══════════════════════════════════════
    // LIFECYCLE
    // ═══════════════════════════════════════

    async function terminate() {
        if (_worker) {
            await _worker.terminate();
            _worker = null;
            _isReady = false;
            console.log('[ExtractionEngine] Worker terminated');
        }
    }

    function init() {
        console.log('[ExtractionEngine] ✅ Initialized — PDF.js + Tesseract.js ready');
    }

    return {
        init,
        extractText,
        onProgress,
        terminate
    };
})();
