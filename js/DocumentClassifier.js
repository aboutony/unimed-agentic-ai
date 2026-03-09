/* ═══════════════════════════════════════════════════════════
   UNIMED AGENTIC AI — Document Classifier
   Agentic classification using weighted keyword scoring
   + structural layout heuristics
   Target types: SALES_ORDER | PURCHASE_ORDER | DELIVERY_NOTE
   ═══════════════════════════════════════════════════════════ */

const DocumentClassifier = (() => {
    'use strict';

    // ═══════════════════════════════════════
    // KEYWORD DICTIONARIES (EN + AR)
    // Weighted by specificity:
    //   3 = definitive marker
    //   2 = strong indicator
    //   1 = weak/generic signal
    // ═══════════════════════════════════════

    const KEYWORDS = {
        SALES_ORDER: [
            // English — definitive
            { pattern: /sales\s*order/i, weight: 3 },
            { pattern: /\bSO[-#\s]?\d/i, weight: 3 },
            { pattern: /customer\s*order/i, weight: 3 },
            { pattern: /order\s*confirmation/i, weight: 3 },
            // Arabic — definitive
            { pattern: /أمر\s*بيع/i, weight: 3 },
            { pattern: /طلب\s*عميل/i, weight: 3 },
            { pattern: /تأكيد\s*الطلب/i, weight: 3 },
            // English — strong
            { pattern: /customer\s*(code|name|id)/i, weight: 2 },
            { pattern: /ship\s*to\s*(party|address)/i, weight: 2 },
            { pattern: /bill\s*to/i, weight: 2 },
            { pattern: /sold\s*to/i, weight: 2 },
            { pattern: /order\s*date/i, weight: 2 },
            { pattern: /delivery\s*date/i, weight: 1 },
            // UNIMED-specific
            { pattern: /unimed/i, weight: 1 },
            { pattern: /united\s*medical/i, weight: 1 },
            { pattern: /UNICRYL/i, weight: 1 },
            // Generic order
            { pattern: /\border\b/i, weight: 1 },
            { pattern: /quantity\s*ordered/i, weight: 1 },
        ],

        PURCHASE_ORDER: [
            // English — definitive
            { pattern: /purchase\s*order/i, weight: 3 },
            { pattern: /\bPO[-#\s]?\d/i, weight: 3 },
            { pattern: /procurement\s*order/i, weight: 3 },
            // NUPCO — definitive
            { pattern: /NUPCO\s*PO/i, weight: 3 },
            { pattern: /NUPCO/i, weight: 2 },
            { pattern: /National\s*Unified\s*Procurement/i, weight: 3 },
            { pattern: /Cust\.?\s*PO\s*\/\s*Tender/i, weight: 3 },
            { pattern: /نوبكو/i, weight: 3 },
            // Arabic — definitive
            { pattern: /أمر\s*شراء/i, weight: 3 },
            { pattern: /طلب\s*شراء/i, weight: 3 },
            { pattern: /أمر\s*توريد/i, weight: 3 },
            // English — strong
            { pattern: /vendor\s*(code|name|id|number)/i, weight: 2 },
            { pattern: /supplier\s*(code|name|id|number)/i, weight: 2 },
            { pattern: /procurement/i, weight: 2 },
            { pattern: /purchase\s*requisition/i, weight: 2 },
            { pattern: /buyer/i, weight: 1 },
            { pattern: /purchasing\s*department/i, weight: 2 },
            // Procurement signals
            { pattern: /payment\s*terms/i, weight: 1 },
            { pattern: /incoterms/i, weight: 1 },
            { pattern: /lead\s*time/i, weight: 1 },
            { pattern: /expected\s*delivery/i, weight: 1 },
            { pattern: /raw\s*material/i, weight: 1 },
            { pattern: /contract\s*number/i, weight: 1 },
            { pattern: /supplier\s*vat/i, weight: 1 },
        ],

        DELIVERY_NOTE: [
            // English — definitive
            { pattern: /delivery\s*note/i, weight: 3 },
            { pattern: /\bDN[-#\s]?\d/i, weight: 3 },
            { pattern: /packing\s*list/i, weight: 3 },
            { pattern: /dispatch\s*note/i, weight: 3 },
            { pattern: /goods\s*issue/i, weight: 3 },
            // Arabic — definitive
            { pattern: /إشعار\s*تسليم/i, weight: 3 },
            { pattern: /مذكرة\s*تسليم/i, weight: 3 },
            { pattern: /بوليصة\s*شحن/i, weight: 3 },
            // English — strong
            { pattern: /shipped\s*(qty|quantity)/i, weight: 2 },
            { pattern: /delivered\s*(qty|quantity)/i, weight: 2 },
            { pattern: /fulfilled/i, weight: 2 },
            { pattern: /shipping\s*address/i, weight: 2 },
            { pattern: /consignee/i, weight: 2 },
            { pattern: /carrier/i, weight: 2 },
            { pattern: /tracking\s*number/i, weight: 2 },
            { pattern: /waybill/i, weight: 2 },
            { pattern: /bill\s*of\s*lading/i, weight: 2 },
            // Shipping signals
            { pattern: /weight\s*(kg|net|gross)/i, weight: 1 },
            { pattern: /packages?\s*\d/i, weight: 1 },
            { pattern: /cartons?/i, weight: 1 },
            { pattern: /pallets?/i, weight: 1 },
        ]
    };

    // ═══════════════════════════════════════
    // STRUCTURAL HEURISTICS
    // Column headers and table layout analysis
    // ═══════════════════════════════════════

    const STRUCTURAL_SIGNALS = {
        SALES_ORDER: [
            { pattern: /item\s*code.*qty.*price/i, weight: 2 },
            { pattern: /unit\s*price.*amount/i, weight: 2 },
            { pattern: /sub\s*total/i, weight: 1 },
            { pattern: /tax.*total/i, weight: 1 },
            { pattern: /grand\s*total/i, weight: 1 },
        ],
        PURCHASE_ORDER: [
            { pattern: /item.*description.*qty.*unit\s*price/i, weight: 2 },
            { pattern: /material\s*(code|number)/i, weight: 2 },
            { pattern: /net\s*value/i, weight: 1 },
            { pattern: /terms\s*(of|and)\s*conditions/i, weight: 1 },
        ],
        DELIVERY_NOTE: [
            { pattern: /item.*description.*ordered.*delivered/i, weight: 2 },
            { pattern: /batch\s*(no|number|#)/i, weight: 2 },
            { pattern: /expiry/i, weight: 2 },
            { pattern: /lot\s*(no|number|#)/i, weight: 2 },
            { pattern: /received\s*by/i, weight: 1 },
        ]
    };

    // ═══════════════════════════════════════
    // CLASSIFICATION ENGINE
    // ═══════════════════════════════════════

    /**
     * Classify a document based on its extracted text
     * @param {string} text - Full OCR text
     * @returns {{
     *   docType: string,
     *   confidence: number,
     *   scores: object,
     *   matchedKeywords: object,
     *   isLowConfidence: boolean
     * }}
     */
    function classify(text) {
        if (!text || text.trim().length === 0) {
            return {
                docType: 'UNKNOWN',
                confidence: 0,
                scores: {},
                matchedKeywords: {},
                isLowConfidence: true
            };
        }

        const scores = {};
        const matchedKeywords = {};

        // ── Score each doc type ──
        for (const [docType, keywords] of Object.entries(KEYWORDS)) {
            let score = 0;
            const matched = [];

            // Keyword scoring
            for (const kw of keywords) {
                const matches = text.match(new RegExp(kw.pattern, 'gi'));
                if (matches) {
                    // Weight × occurrence count (capped at 3 to prevent flooding)
                    const count = Math.min(matches.length, 3);
                    score += kw.weight * count;
                    matched.push({
                        pattern: kw.pattern.source,
                        weight: kw.weight,
                        count: matches.length
                    });
                }
            }

            // Structural scoring
            const structural = STRUCTURAL_SIGNALS[docType] || [];
            for (const sig of structural) {
                if (sig.pattern.test(text)) {
                    score += sig.weight;
                    matched.push({
                        pattern: sig.pattern.source,
                        weight: sig.weight,
                        count: 1,
                        type: 'structural'
                    });
                }
            }

            scores[docType] = score;
            matchedKeywords[docType] = matched;
        }

        // ── Determine winner ──
        const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        const winner = sorted[0];
        const runnerUp = sorted[1] || ['NONE', 0];

        // ── Confidence calculation ──
        // Factors: absolute score, margin over runner-up, keyword diversity
        const totalScore = Object.values(scores).reduce((s, v) => s + v, 0);
        let confidence = 0;

        if (totalScore > 0) {
            // Base: winner's share of total score
            const shareConfidence = (winner[1] / totalScore) * 100;

            // Margin bonus: bigger gap = higher confidence
            const margin = winner[1] - runnerUp[1];
            const marginBonus = Math.min(margin * 2, 20);

            // Diversity: more unique keyword matches = higher confidence
            const diversityBonus = Math.min(matchedKeywords[winner[0]].length * 2, 15);

            // Definitive keyword bonus: finding a weight-3 keyword is very strong
            const hasDefinitive = matchedKeywords[winner[0]].some(m => m.weight === 3);
            const definitiveBonus = hasDefinitive ? 15 : 0;

            confidence = Math.min(Math.round(shareConfidence + marginBonus + diversityBonus + definitiveBonus), 99);
        }

        // ── Low confidence threshold ──
        const isLowConfidence = confidence < 60 || winner[1] < 4;

        const result = {
            docType: winner[1] > 0 ? winner[0] : 'UNKNOWN',
            confidence,
            scores,
            matchedKeywords,
            isLowConfidence,
            margin: winner[1] - runnerUp[1]
        };

        console.log(`[DocumentClassifier] Result: ${result.docType} @ ${result.confidence}% (scores: SO=${scores.SALES_ORDER}, PO=${scores.PURCHASE_ORDER}, DN=${scores.DELIVERY_NOTE})`);

        return result;
    }

    /**
     * Get a human-readable label for a doc type
     */
    function getLabel(docType) {
        const labels = {
            'SALES_ORDER': 'Sales Order',
            'PURCHASE_ORDER': 'Purchase Order',
            'DELIVERY_NOTE': 'Delivery Note',
            'UNKNOWN': 'Unclassified'
        };
        return labels[docType] || docType;
    }

    /**
     * Get the SAP table code for a doc type
     */
    function getSAPTable(docType) {
        const tables = {
            'SALES_ORDER': 'ORDR',
            'PURCHASE_ORDER': 'OPOR',
            'DELIVERY_NOTE': 'ODLN'
        };
        return tables[docType] || null;
    }

    function init() {
        console.log('[DocumentClassifier] ✅ Initialized — Agentic classification ready');
    }

    return {
        init,
        classify,
        getLabel,
        getSAPTable
    };
})();
