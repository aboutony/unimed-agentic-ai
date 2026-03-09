/* ═══════════════════════════════════════════════════════════
   UNIMED AGENTIC AI — Field Extractor
   Zone-based regex extraction per document type
   Maps raw OCR text → structured SAP-ready JSON
   Targets: ORDR, OPOR, ODLN
   ═══════════════════════════════════════════════════════════ */

const FieldExtractor = (() => {
    'use strict';

    // ═══════════════════════════════════════
    // HEADER FIELD PATTERNS
    // Each pattern group tries multiple regex
    // variants to handle OCR noise/formatting
    // ═══════════════════════════════════════

    const HEADER_PATTERNS = {
        // Document number
        docNumber: [
            /(?:SO|Sales\s*Order)\s*(?:#|No\.?|Number)?\s*[:.]?\s*([A-Z0-9][-A-Z0-9/]+)/i,
            /(?:PO|Purchase\s*Order)\s*(?:#|No\.?|Number)?\s*[:.]?\s*([A-Z0-9][-A-Z0-9/]+)/i,
            /(?:DN|Delivery\s*Note)\s*(?:#|No\.?|Number)?\s*[:.]?\s*([A-Z0-9][-A-Z0-9/]+)/i,
            /(?:Order|Document|Doc)\s*(?:#|No\.?|Number)\s*[:.]?\s*([A-Z0-9][-A-Z0-9/]+)/i,
            /(?:Ref|Reference)\s*(?:#|No\.?|Number)?\s*[:.]?\s*([A-Z0-9][-A-Z0-9/]+)/i,
            /(?:رقم\s*(?:الطلب|الأمر|المستند))\s*[:.]?\s*([A-Z0-9][-A-Z0-9/]+)/i,
        ],

        // Document date
        docDate: [
            /(?:Date|Order\s*Date|Document\s*Date|Doc\.?\s*Date)\s*[:.]?\s*(\d{1,2}[\s./-]\d{1,2}[\s./-]\d{2,4})/i,
            /(?:Date|Order\s*Date|Document\s*Date|Doc\.?\s*Date)\s*[:.]?\s*(\d{4}[\s./-]\d{1,2}[\s./-]\d{1,2})/i,
            /(?:التاريخ|تاريخ\s*الطلب)\s*[:.]?\s*(\d{1,2}[\s./-]\d{1,2}[\s./-]\d{2,4})/i,
            /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i,
        ],

        // Business Partner code
        cardCode: [
            /(?:Customer|Vendor|Supplier|BP)\s*(?:Code|ID|#|No\.?)\s*[:.]?\s*([A-Z]\d{3,8})/i,
            /(?:Customer|Vendor|Supplier|BP)\s*(?:Code|ID|#|No\.?)\s*[:.]?\s*([A-Z][-A-Z0-9]+)/i,
            /(?:رمز\s*(?:العميل|المورد))\s*[:.]?\s*([A-Z][-A-Z0-9]+)/i,
            /(?:Account|Acct)\s*(?:Code|#|No\.?)\s*[:.]?\s*([A-Z][-A-Z0-9]+)/i,
        ],

        // Business Partner name
        cardName: [
            /(?:Customer|Vendor|Supplier|BP)\s*(?:Name)?\s*[:.]?\s*([A-Z][A-Za-z\s&.,'-]{4,60})/,
            /(?:Bill\s*To|Ship\s*To|Sold\s*To|Deliver\s*To)\s*[:.]?\s*([A-Z][A-Za-z\s&.,'-]{4,60})/i,
            /(?:Consignee|Buyer|Purchaser)\s*[:.]?\s*([A-Z][A-Za-z\s&.,'-]{4,60})/i,
            /(?:اسم\s*(?:العميل|المورد))\s*[:.]?\s*(.{4,60})/i,
        ],

        // Currency
        currency: [
            /(?:Currency)\s*[:.]?\s*(SAR|USD|AED|EUR|GBP)/i,
            /(?:العملة)\s*[:.]?\s*(ريال|دولار|درهم)/i,
            /(SAR|ر\.?\s*س)[\s.]/i,
        ],
    };

    // Additional patterns specific to doc types
    const TYPE_SPECIFIC_PATTERNS = {
        PURCHASE_ORDER: {
            paymentTerms: [
                /(?:Payment\s*Terms?)\s*[:.]?\s*(.{3,40})/i,
                /(?:شروط\s*الدفع)\s*[:.]?\s*(.{3,40})/i,
            ],
            expectedDelivery: [
                /(?:Expected|Required|Delivery)\s*Date\s*[:.]?\s*(\d{1,2}[\s./-]\d{1,2}[\s./-]\d{2,4})/i,
            ]
        },
        DELIVERY_NOTE: {
            trackingNumber: [
                /(?:Tracking|Waybill|AWB)\s*(?:#|No\.?|Number)?\s*[:.]?\s*([A-Z0-9]{6,25})/i,
            ],
            carrier: [
                /(?:Carrier|Shipper|Logistics)\s*[:.]?\s*([A-Za-z\s&]{3,40})/i,
            ]
        }
    };

    // ═══════════════════════════════════════
    // LINE ITEM EXTRACTION
    // ═══════════════════════════════════════

    /**
     * Extract line items from raw text
     * Looks for tabular patterns: ItemCode | Description | Qty | Price | Total
     * 
     * Strategy: scan each line for a potential item code pattern followed
     * by numeric values. OCR tables are messy, so we use multiple heuristics.
     */
    function _extractLineItems(text) {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const items = [];

        // Pattern: item code followed by description, numbers
        // MED-SUTURE-3-0  UNICRYL Braided PGA 3-0  500  42.50  21,250.00
        const LINE_PATTERNS = [
            // Pattern A: ItemCode + Description + Qty + Price + Total
            /^([A-Z][A-Z0-9]{2,}[-][A-Z0-9-]+)\s+(.{10,60}?)\s+(\d[\d,]*\.?\d*)\s+(\d[\d,]*\.?\d{2})\s+(\d[\d,]*\.?\d{2})/,
            // Pattern B: Line# + ItemCode + Description + Qty + Price + Total
            /^\d+\s+([A-Z][A-Z0-9]{2,}[-][A-Z0-9-]+)\s+(.{10,60}?)\s+(\d[\d,]*\.?\d*)\s+(\d[\d,]*\.?\d{2})\s+(\d[\d,]*\.?\d{2})/,
            // Pattern C: ItemCode + Description + Qty + Price (no total)
            /^([A-Z][A-Z0-9]{2,}[-][A-Z0-9-]+)\s+(.{10,60}?)\s+(\d[\d,]*\.?\d*)\s+(\d[\d,]*\.?\d{2})/,
            // Pattern D: Numeric item code
            /^(\d{4,10})\s+(.{10,60}?)\s+(\d[\d,]*\.?\d*)\s+(\d[\d,]*\.?\d{2})\s+(\d[\d,]*\.?\d{2})/,
            // Pattern E: Line# + Description + Qty + Price + Total (no item code)
            /^\d+\s+(.{15,60}?)\s+(\d[\d,]*\.?\d*)\s+(\d[\d,]*\.?\d{2})\s+(\d[\d,]*\.?\d{2})/,
        ];

        for (const line of lines) {
            // Skip header/footer lines
            if (/^(item|#|no\.|line|description|qty|quantity|price|amount|total|sub|tax|vat|grand)/i.test(line)) continue;
            if (/^[-=_]{3,}/.test(line)) continue;

            for (const pattern of LINE_PATTERNS) {
                const match = line.match(pattern);
                if (match) {
                    const groups = match.slice(1);
                    let item;

                    if (groups.length === 5) {
                        item = {
                            itemCode: _cleanItemCode(groups[0]),
                            description: groups[1].trim(),
                            quantity: _parseNumber(groups[2]),
                            unitPrice: _parseNumber(groups[3]),
                            total: _parseNumber(groups[4]),
                            status: 'pending'
                        };
                    } else if (groups.length === 4) {
                        const hasItemCode = /^[A-Z]/.test(groups[0]);
                        if (hasItemCode) {
                            item = {
                                itemCode: _cleanItemCode(groups[0]),
                                description: groups[1].trim(),
                                quantity: _parseNumber(groups[2]),
                                unitPrice: _parseNumber(groups[3]),
                                total: _parseNumber(groups[2]) * _parseNumber(groups[3]),
                                status: 'pending'
                            };
                        } else {
                            item = {
                                itemCode: 'UNRESOLVED',
                                description: groups[0].trim(),
                                quantity: _parseNumber(groups[1]),
                                unitPrice: _parseNumber(groups[2]),
                                total: _parseNumber(groups[3]),
                                status: 'pending'
                            };
                        }
                    }

                    if (item && item.quantity > 0) {
                        items.push(item);
                    }
                    break; // Only match first pattern per line
                }
            }
        }

        // ── Fallback: if no items found, try aggressive number scanning ──
        if (items.length === 0) {
            return _fallbackLineExtraction(lines);
        }

        return items;
    }

    /**
     * Fallback extraction for heavily degraded OCR
     * Looks for any line containing 2+ numbers
     */
    function _fallbackLineExtraction(lines) {
        const items = [];
        const numericLinePattern = /(.{5,50}?)\s+(\d[\d,]*\.?\d*)\s+.*?(\d[\d,]*\.?\d{2})/;

        for (const line of lines) {
            if (items.length >= 20) break; // Safety cap
            if (/^(item|#|total|sub|tax|date|page)/i.test(line)) continue;

            const match = line.match(numericLinePattern);
            if (match) {
                const qty = _parseNumber(match[2]);
                const price = _parseNumber(match[3]);
                if (qty > 0 && price > 0) {
                    items.push({
                        itemCode: 'UNRESOLVED',
                        description: match[1].trim(),
                        quantity: qty,
                        unitPrice: price,
                        total: qty * price,
                        status: 'pending'
                    });
                }
            }
        }

        return items;
    }

    // ═══════════════════════════════════════
    // CORE: EXTRACT FIELDS
    // ═══════════════════════════════════════

    /**
     * Extract structured fields from OCR text
     * @param {string} text - Full OCR text
     * @param {string} docType - Classified document type
     * @returns {object} Structured extraction result
     */
    function extract(text, docType) {
        const startTime = performance.now();

        // ── 1. Extract header fields ──
        const headers = {};
        for (const [field, patterns] of Object.entries(HEADER_PATTERNS)) {
            headers[field] = _matchFirst(text, patterns);
        }

        // ── 2. Type-specific fields ──
        const typeFields = {};
        const specificPatterns = TYPE_SPECIFIC_PATTERNS[docType] || {};
        for (const [field, patterns] of Object.entries(specificPatterns)) {
            typeFields[field] = _matchFirst(text, patterns);
        }

        // ── 3. Extract line items ──
        const lines = _extractLineItems(text);

        // ── 4. Normalize date ──
        if (headers.docDate) {
            headers.docDate = _normalizeDate(headers.docDate);
        }

        // ── 5. Detect currency if not explicit ──
        if (!headers.currency) {
            if (/SAR|ريال|ر\.\s*س/i.test(text)) headers.currency = 'SAR';
            else if (/USD|\$/i.test(text)) headers.currency = 'USD';
            else if (/AED|درهم/i.test(text)) headers.currency = 'AED';
            else headers.currency = 'SAR'; // Default for UNIMED
        }

        // ── 6. Compute totals ──
        const computedTotal = lines.reduce((sum, l) => sum + (l.total || 0), 0);

        const elapsed = Math.round(performance.now() - startTime);

        const result = {
            docType,
            docNumber: headers.docNumber || null,
            docDate: headers.docDate || null,
            cardCode: headers.cardCode || null,
            cardName: headers.cardName || null,
            currency: headers.currency,
            lines,
            computedTotal,
            lineCount: lines.length,
            typeSpecific: typeFields,
            extractionTimeMs: elapsed,
            hasUnresolvedItems: lines.some(l => l.itemCode === 'UNRESOLVED'),
            missingFields: _findMissingFields(headers)
        };

        console.log(`[FieldExtractor] Extracted: ${result.lineCount} lines, total=${result.computedTotal}, missing=[${result.missingFields.join(', ')}], ${elapsed}ms`);

        return result;
    }

    // ═══════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════

    /**
     * Try multiple patterns, return first match group 1
     */
    function _matchFirst(text, patterns) {
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }
        return null;
    }

    /**
     * Parse a number from OCR text (handles commas, spaces)
     */
    function _parseNumber(str) {
        if (!str) return 0;
        const cleaned = str.replace(/[,\s]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
    }

    /**
     * Clean an item code from OCR artifacts
     */
    function _cleanItemCode(code) {
        if (!code) return 'UNRESOLVED';
        return code.replace(/[|\\]/g, '').replace(/\s+/g, '-').toUpperCase();
    }

    /**
     * Normalize various date formats to YYYY-MM-DD
     */
    function _normalizeDate(dateStr) {
        if (!dateStr) return null;

        // Try ISO-ish: 2026-03-09
        const isoMatch = dateStr.match(/(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})/);
        if (isoMatch) {
            return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
        }

        // Try DD/MM/YYYY or DD-MM-YYYY
        const dmyMatch = dateStr.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
        if (dmyMatch) {
            return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
        }

        // Try "09 March 2026"
        const monthNames = {
            jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
            jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
        };
        const longMatch = dateStr.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
        if (longMatch) {
            const monthKey = longMatch[2].substring(0, 3).toLowerCase();
            const month = monthNames[monthKey];
            if (month) {
                return `${longMatch[3]}-${month}-${longMatch[1].padStart(2, '0')}`;
            }
        }

        return dateStr; // Return as-is if unparseable
    }

    /**
     * Identify missing critical fields
     */
    function _findMissingFields(headers) {
        const required = ['docNumber', 'docDate', 'cardCode'];
        return required.filter(f => !headers[f]);
    }

    function init() {
        console.log('[FieldExtractor] ✅ Initialized — SAP field mapping ready');
    }

    return {
        init,
        extract
    };
})();
