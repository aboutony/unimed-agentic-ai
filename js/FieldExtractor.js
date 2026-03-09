/* ═══════════════════════════════════════════════════════════
   UNIMED AGENTIC AI — Field Extractor
   Zone-based regex extraction per document type
   Maps raw OCR text → structured SAP-ready JSON
   Targets: ORDR, OPOR, ODLN
   + NUPCO Template Parser (Phase 5 Hypercare)
   ═══════════════════════════════════════════════════════════ */

const FieldExtractor = (() => {
    'use strict';

    // ═══════════════════════════════════════
    // HEADER FIELD PATTERNS
    // ═══════════════════════════════════════

    const HEADER_PATTERNS = {
        docNumber: [
            /(?:SO|Sales\s*Order)\s*(?:#|No\.?|Number)?\s*[:.]?\s*([A-Z0-9][-A-Z0-9/]+)/i,
            /(?:PO|Purchase\s*Order)\s*(?:#|No\.?|Number)?\s*[:.]?\s*([A-Z0-9][-A-Z0-9/]+)/i,
            /(?:DN|Delivery\s*Note)\s*(?:#|No\.?|Number)?\s*[:.]?\s*([A-Z0-9][-A-Z0-9/]+)/i,
            /(?:Order|Document|Doc)\s*(?:#|No\.?|Number)\s*[:.]?\s*([A-Z0-9][-A-Z0-9/]+)/i,
            /(?:Ref|Reference)\s*(?:#|No\.?|Number)?\s*[:.]?\s*([A-Z0-9][-A-Z0-9/]+)/i,
            /(?:رقم\s*(?:الطلب|الأمر|المستند))\s*[:.]?\s*([A-Z0-9][-A-Z0-9/]+)/i,
        ],
        docDate: [
            /(?:Date|Order\s*Date|Document\s*Date|Doc\.?\s*Date)\s*[:.]?\s*(\d{1,2}[\s./-]\d{1,2}[\s./-]\d{2,4})/i,
            /(?:Date|Order\s*Date|Document\s*Date|Doc\.?\s*Date)\s*[:.]?\s*(\d{4}[\s./-]\d{1,2}[\s./-]\d{1,2})/i,
            /(?:التاريخ|تاريخ\s*الطلب)\s*[:.]?\s*(\d{1,2}[\s./-]\d{1,2}[\s./-]\d{2,4})/i,
            /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i,
        ],
        cardCode: [
            /(?:Customer|Vendor|Supplier|BP)\s*(?:Code|ID|#|No\.?)\s*[:.]?\s*([A-Z]\d{3,8})/i,
            /(?:Customer|Vendor|Supplier|BP)\s*(?:Code|ID|#|No\.?)\s*[:.]?\s*([A-Z][-A-Z0-9]+)/i,
            /(?:رمز\s*(?:العميل|المورد))\s*[:.]?\s*([A-Z][-A-Z0-9]+)/i,
            /(?:Account|Acct)\s*(?:Code|#|No\.?)\s*[:.]?\s*([A-Z][-A-Z0-9]+)/i,
        ],
        cardName: [
            /(?:Customer|Vendor|Supplier|BP)\s*(?:Name)?\s*[:.]?\s*([A-Z][A-Za-z\s&.,'-]{4,60})/,
            /(?:Bill\s*To|Ship\s*To|Sold\s*To|Deliver\s*To)\s*[:.]?\s*([A-Z][A-Za-z\s&.,'-]{4,60})/i,
            /(?:Consignee|Buyer|Purchaser)\s*[:.]?\s*([A-Z][A-Za-z\s&.,'-]{4,60})/i,
            /(?:اسم\s*(?:العميل|المورد))\s*[:.]?\s*(.{4,60})/i,
        ],
        currency: [
            /(?:Currency)\s*[:.]?\s*(SAR|USD|AED|EUR|GBP)/i,
            /(?:العملة)\s*[:.]?\s*(ريال|دولار|درهم)/i,
            /(SAR|ر\.?\s*س)[\s.]/i,
        ],
    };

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
    // NUPCO TEMPLATE PARSER (Phase 5)
    // Handles grid-layout POs from NUPCO
    // ═══════════════════════════════════════

    function _isNUPCO(text) {
        const markers = [/NUPCO/i, /National\s*Unified\s*Procurement/i, /نوبكو/, /NUPCO\s*PO/i, /Cust\.?\s*PO\s*\/?\s*Tender/i];
        return markers.some(m => m.test(text));
    }

    function _deduplicateOCR(text) {
        const pages = text.split(/---\s*PAGE\s*BREAK\s*---/i);
        if (pages.length <= 1) return text;
        const unique = [pages[0]];
        for (let i = 1; i < pages.length; i++) {
            const curr = pages[i].trim();
            if (curr.length < 30) continue;
            const sample = curr.substring(0, Math.min(120, curr.length)).trim();
            if (!unique.some(u => u.includes(sample))) unique.push(curr);
        }
        return unique.join('\n\n');
    }

    function _extractNUPCO(text) {
        const startTime = performance.now();
        const clean = _deduplicateOCR(text);
        const h = _extractNUPCOHeaders(clean);
        const lines = _extractNUPCOLines(clean, h);
        const elapsed = Math.round(performance.now() - startTime);

        console.log(`[FieldExtractor] NUPCO template — PO: ${h.poNumber}, Supplier: ${h.supplierNumber}, Lines: ${lines.length}, ${elapsed}ms`);

        return {
            docType: 'PURCHASE_ORDER',
            docNumber: h.poNumber || null,
            docDate: h.date ? _normalizeDate(h.date) : null,
            cardCode: h.supplierNumber || null,
            cardName: h.supplierName || null,
            currency: 'SAR',
            lines,
            computedTotal: lines.reduce((s, l) => s + (l.total || 0), 0),
            lineCount: lines.length,
            typeSpecific: { contractNumber: h.contractNumber, supplierVAT: h.supplierVAT, poValue: h.poValue, nupcoTemplate: true },
            hasUnresolvedItems: lines.some(l => l.itemCode === 'UNRESOLVED'),
            missingFields: _findMissingFields({ docNumber: h.poNumber, docDate: h.date, cardCode: h.supplierNumber }),
            extractionTimeMs: elapsed
        };
    }

    function _extractNUPCOHeaders(text) {
        const h = {};
        const kv = (patterns) => {
            for (const p of patterns) { const m = text.match(p); if (m && m[1]) return m[1].trim(); }
            return null;
        };
        h.poNumber = kv([/NUPCO\s*PO[^0-9]*(\d{8,13})/i, /(?:PO\s*(?:No|Number|#))[^0-9]*(\d{8,13})/i, /\b(4\d{9})\b/]);
        // PO Number fallback: OCR may read '4100000309' as '+100000309' (4→+)
        if (!h.poNumber || h.poNumber.length < 10) {
            const fullMatch = text.match(/\b(4[1-6]\d{8})\b/);
            if (fullMatch) {
                h.poNumber = fullMatch[1];
            } else if (h.poNumber && h.poNumber.length === 9 && /^[01]/.test(h.poNumber)) {
                // OCR dropped leading '4' — prepend it
                h.poNumber = '4' + h.poNumber;
                console.log(`[FieldExtractor] NUPCO PO# prefix fix: prepended 4 → ${h.poNumber}`);
            }
        }
        // DEBUG: show what's near NUPCO PO
        const poIdx = text.search(/NUPCO\s*PO/i);
        if (poIdx >= 0) console.log(`[FieldExtractor] DEBUG PO# area: "${text.substring(poIdx, poIdx + 60).replace(/\n/g, '↵')}"`);
        h.date = kv([/Date\s*\(?\s*Gregorian\s*\)?[^0-9]*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i, /التاريخ\s*الميلادي[^0-9]*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i]);
        h.supplierNumber = kv([/Supplier\s*Number[^0-9]*(\d{4,8})/i, /رقم\s*المورد[^0-9]*(\d{4,8})/i]);
        h.supplierVAT = kv([/Supplier\s*VAT\s*(?:No|Number)?[^0-9]*(\d{10,15})/i, /الرقم\s*الضريبي[^0-9]*(\d{10,15})/i]);
        h.contractNumber = kv([/Contract\s*Number[^0-9]*(\d{8,13})/i, /رقم\s*العقد[^0-9]*(\d{8,13})/i]);
        // PO Value: OCR may produce double-decimal (1,053,000.00 → 1050.00.00) or no decimal (7,312.50 → 731250)
        h.poValue = kv([
            /PO\s*Value[\s\S]{0,150}?(\d{1,3}(?:,\d{3})*\.\d{2})\s*SAR/i,
            /PO\s*Value[\s\S]{0,150}?(\d{3}[\d.,]+)\s*SAR/i,
            /PO\s*Value[\s\S]{0,50}?(\d{3}[\d,]+)\s*SAR/i,
        ]);
        // Clean PO value: handle double-decimal OCR artifacts (1050.00.00 → 1050.0000 → 105000.00)
        if (h.poValue) {
            let cleaned = h.poValue.replace(/,/g, '');
            // Count decimal points
            const dots = (cleaned.match(/\./g) || []).length;
            if (dots > 1) {
                // Multiple decimals: remove all dots, divide by 100
                const raw = parseInt(cleaned.replace(/\./g, ''));
                cleaned = (raw / 100).toFixed(2);
                console.log(`[FieldExtractor] NUPCO PO Value multi-decimal fix: ${h.poValue} → ${cleaned}`);
            } else if (dots === 0 && cleaned.length > 3) {
                // No decimal: divide by 100
                const raw = parseInt(cleaned);
                cleaned = (raw / 100).toFixed(2);
                console.log(`[FieldExtractor] NUPCO PO Value decimal fix: ${h.poValue} → ${cleaned}`);
            }
            h.poValue = cleaned;
        }
        // Reject obviously wrong values (00.00, 0.00)
        if (h.poValue && parseFloat(h.poValue) < 1) h.poValue = null;
        // DIAGNOSTIC: dump OCR text near PO Value for debugging
        const pvIdx = text.search(/PO\s*Value/i);
        if (pvIdx >= 0) {
            console.log(`[FieldExtractor] DEBUG PO Value area: "${text.substring(pvIdx, pvIdx + 200).replace(/\n/g, '↵')}"`);
        }
        console.log(`[FieldExtractor] NUPCO headers: PO=${h.poNumber}, Date=${h.date}, Supplier=${h.supplierNumber}, Value=${h.poValue}`);
        h.supplierName = kv([/Company\s*\n?\s*([A-Z][A-Z\s&.,]+(?:CO\.?\s*LTD\.?|LLC|INC)\.?)/im, /Supplier\s*Name[^A-Z]*([A-Z][A-Z\s&.,'-]{5,80})/im]);
        if (!h.supplierName) { const m = text.match(/UNITED\s*MEDICAL\s*INDUSTRIES?\s*CO\.?\s*LTD\.?/i); if (m) h.supplierName = m[0].trim(); }
        // Clean trailing label noise from supplier name
        if (h.supplierName) {
            h.supplierName = h.supplierName
                .replace(/\s*(Supplier\s*Name|اسم\s*المورد|Company|الشركة)\s*$/i, '')
                .replace(/\s{2,}/g, ' ')
                .trim();
        }
        return h;
    }

    function _extractNUPCOLines(text, headers) {
        const items = [];
        // Try structured table: LineNo MaterialCode Description Qty UOM UnitPrice Total
        const patterns = [
            /(?:^|\n)\s*(\d{1,5})\s+(\d{5,15})\s+(.{10,80}?)\s+(\d[\d,]*\.?\d*)\s+(\w+)\s+([\d,]+\.?\d{2})\s+([\d,]+\.?\d{2})/gm,
            /(?:^|\n)\s*(\d{1,5})\s+(\d{5,15})\s+(.{10,60}?)\s+(\d[\d,]*\.?\d*)\s+([\d,]+\.?\d{2})/gm,
        ];

        for (const p of patterns) {
            let m;
            while ((m = p.exec(text)) !== null) {
                const g = m.slice(1);
                const qty = _parseNumber(g[3]);
                const price = _parseNumber(g.length >= 7 ? g[5] : g[4]);
                const total = g.length >= 7 ? _parseNumber(g[6]) : qty * price;
                if (qty > 0 && qty < 1000000 && price > 0 && price < 10000000) {
                    items.push({ itemCode: g[1], description: g[2].trim(), quantity: qty, unitPrice: price, total, status: 'pending' });
                }
            }
            if (items.length > 0) break;
        }

        // Fallback: create placeholder lines from header info
        if (items.length === 0) {
            // Extract item count: OCR puts "No of Items" and "No of SKUs" on same line
            // with values on the NEXT line as "4 2" — we need the FIRST number
            let expectedCount = 0;

            // Strategy: find "No of Items" then scan for the first standalone digit
            // but STOP before "Supplier" or "Incoterms" (next section)
            const itemSection = text.match(/No\s*of\s*Items[\s\S]{0,100}?(?=Incoterms|Supplier|Contract|$)/i);
            if (itemSection) {
                // Find ALL numbers in this section
                const nums = itemSection[0].match(/\b(\d+)\b/g);
                if (nums) {
                    // Take the MAX number (item count >= SKU count, avoids OCR ordering issues)
                    for (const n of nums) {
                        const val = parseInt(n);
                        if (val > 0 && val <= 100 && val > expectedCount) {
                            expectedCount = val;
                        }
                    }
                }
            }

            // Fallback: Arabic label
            if (expectedCount === 0) {
                const arabicMatch = text.match(/عدد\s*البنود\s*(\d+)/);
                if (arabicMatch) expectedCount = parseInt(arabicMatch[1]);
            }

            console.log(`[FieldExtractor] NUPCO item count: ${expectedCount}`);

            const poValue = headers.poValue ? _parseNumber(headers.poValue) : 0;

            if (expectedCount > 0) {
                const perLine = poValue / expectedCount;
                for (let i = 0; i < expectedCount; i++) {
                    items.push({
                        itemCode: 'UNRESOLVED',
                        description: `NUPCO PO Line ${i + 1} — item details on inner pages`,
                        quantity: 0,
                        unitPrice: 0,
                        total: perLine,
                        status: 'pending'
                    });
                }
                console.log(`[FieldExtractor] NUPCO fallback: ${expectedCount} lines, total SAR ${poValue}`);
            }
        }

        // Deduplicate (use description in key to preserve distinct placeholders)
        const seen = new Set();
        return items.filter(item => {
            const key = `${item.itemCode}-${item.description}-${item.quantity}-${item.unitPrice}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    // ═══════════════════════════════════════
    // LINE ITEM EXTRACTION (Generic)
    // ═══════════════════════════════════════

    function _extractLineItems(text) {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const items = [];

        const LINE_PATTERNS = [
            /^([A-Z][A-Z0-9]{2,}[-][A-Z0-9-]+)\s+(.{10,60}?)\s+(\d[\d,]*\.?\d*)\s+(\d[\d,]*\.?\d{2})\s+(\d[\d,]*\.?\d{2})/,
            /^\d+\s+([A-Z][A-Z0-9]{2,}[-][A-Z0-9-]+)\s+(.{10,60}?)\s+(\d[\d,]*\.?\d*)\s+(\d[\d,]*\.?\d{2})\s+(\d[\d,]*\.?\d{2})/,
            /^([A-Z][A-Z0-9]{2,}[-][A-Z0-9-]+)\s+(.{10,60}?)\s+(\d[\d,]*\.?\d*)\s+(\d[\d,]*\.?\d{2})/,
            /^(\d{4,10})\s+(.{10,60}?)\s+(\d[\d,]*\.?\d*)\s+(\d[\d,]*\.?\d{2})\s+(\d[\d,]*\.?\d{2})/,
            /^\d+\s+(.{15,60}?)\s+(\d[\d,]*\.?\d*)\s+(\d[\d,]*\.?\d{2})\s+(\d[\d,]*\.?\d{2})/,
        ];

        for (const line of lines) {
            if (/^(item|#|no\.|line|description|qty|quantity|price|amount|total|sub|tax|vat|grand)/i.test(line)) continue;
            if (/^[-=_]{3,}/.test(line)) continue;

            for (const pattern of LINE_PATTERNS) {
                const match = line.match(pattern);
                if (match) {
                    const groups = match.slice(1);
                    let item;
                    if (groups.length === 5) {
                        item = { itemCode: _cleanItemCode(groups[0]), description: groups[1].trim(), quantity: _parseNumber(groups[2]), unitPrice: _parseNumber(groups[3]), total: _parseNumber(groups[4]), status: 'pending' };
                    } else if (groups.length === 4) {
                        const hasItemCode = /^[A-Z]/.test(groups[0]);
                        if (hasItemCode) {
                            item = { itemCode: _cleanItemCode(groups[0]), description: groups[1].trim(), quantity: _parseNumber(groups[2]), unitPrice: _parseNumber(groups[3]), total: _parseNumber(groups[2]) * _parseNumber(groups[3]), status: 'pending' };
                        } else {
                            item = { itemCode: 'UNRESOLVED', description: groups[0].trim(), quantity: _parseNumber(groups[1]), unitPrice: _parseNumber(groups[2]), total: _parseNumber(groups[3]), status: 'pending' };
                        }
                    }
                    if (item && item.quantity > 0) items.push(item);
                    break;
                }
            }
        }

        if (items.length === 0) return _fallbackLineExtraction(lines);
        return items;
    }

    function _fallbackLineExtraction(lines) {
        const items = [];
        const numericLinePattern = /(.{5,50}?)\s+(\d[\d,]*\.?\d*)\s+.*?(\d[\d,]*\.?\d{2})/;
        for (const line of lines) {
            if (items.length >= 20) break;
            if (/^(item|#|total|sub|tax|date|page)/i.test(line)) continue;
            const match = line.match(numericLinePattern);
            if (match) {
                const qty = _parseNumber(match[2]);
                const price = _parseNumber(match[3]);
                if (qty > 0 && price > 0) {
                    items.push({ itemCode: 'UNRESOLVED', description: match[1].trim(), quantity: qty, unitPrice: price, total: qty * price, status: 'pending' });
                }
            }
        }
        return items;
    }

    // ═══════════════════════════════════════
    // CORE: EXTRACT FIELDS
    // ═══════════════════════════════════════

    function extract(text, docType) {
        const startTime = performance.now();

        // ── NUPCO Template Detection ──
        if (_isNUPCO(text)) {
            console.log('[FieldExtractor] 🏥 NUPCO template detected — using specialized parser');
            return _extractNUPCO(text);
        }

        // ── Generic extraction ──
        const headers = {};
        for (const [field, patterns] of Object.entries(HEADER_PATTERNS)) {
            headers[field] = _matchFirst(text, patterns);
        }

        const typeFields = {};
        const specificPatterns = TYPE_SPECIFIC_PATTERNS[docType] || {};
        for (const [field, patterns] of Object.entries(specificPatterns)) {
            typeFields[field] = _matchFirst(text, patterns);
        }

        const lines = _extractLineItems(text);

        if (headers.docDate) headers.docDate = _normalizeDate(headers.docDate);

        if (!headers.currency) {
            if (/SAR|ريال|ر\.\s*س/i.test(text)) headers.currency = 'SAR';
            else if (/USD|\$/i.test(text)) headers.currency = 'USD';
            else if (/AED|درهم/i.test(text)) headers.currency = 'AED';
            else headers.currency = 'SAR';
        }

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

    function _matchFirst(text, patterns) {
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) return match[1].trim();
        }
        return null;
    }

    function _parseNumber(str) {
        if (!str) return 0;
        const cleaned = str.replace(/[,\s]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
    }

    function _cleanItemCode(code) {
        if (!code) return 'UNRESOLVED';
        return code.replace(/[|\\]/g, '').replace(/\s+/g, '-').toUpperCase();
    }

    function _normalizeDate(dateStr) {
        if (!dateStr) return null;
        const isoMatch = dateStr.match(/(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})/);
        if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
        const dmyMatch = dateStr.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
        if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
        const monthNames = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
        const longMatch = dateStr.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
        if (longMatch) { const mk = longMatch[2].substring(0, 3).toLowerCase(); if (monthNames[mk]) return `${longMatch[3]}-${monthNames[mk]}-${longMatch[1].padStart(2, '0')}`; }
        return dateStr;
    }

    function _findMissingFields(headers) {
        const required = ['docNumber', 'docDate', 'cardCode'];
        return required.filter(f => !headers[f]);
    }

    function init() {
        console.log('[FieldExtractor] ✅ Initialized — SAP field mapping ready (NUPCO template enabled)');
    }

    return {
        init,
        extract
    };
})();
