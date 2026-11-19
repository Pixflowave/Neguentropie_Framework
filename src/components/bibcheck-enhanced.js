// Bibcheck Enhanced - Advanced bibliography verification
// Extends bibliography-verifier.js with Bibcheck-inspired features

import { calculateSimilarity, cleanTitle } from './bibliography-verifier.js';

/**
 * Clean and normalize a DOI string
 * Removes common formatting errors like trailing punctuation, spaces, URLs
 */
export function cleanDOI(doi) {
    if (!doi) return null;

    let cleaned = doi.trim();

    // Remove common URL prefixes
    cleaned = cleaned.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
    cleaned = cleaned.replace(/^doi:\s*/i, '');

    // Remove trailing punctuation that shouldn't be part of DOI
    // DOIs can contain parentheses, but trailing )., .) etc are errors
    cleaned = cleaned.replace(/[\.\,\;\:\)\]]+$/, '');

    // Handle cases like "10.1016/S0140-6736(97)11096-0)." -> remove trailing )
    // But preserve closing parens that are part of the DOI structure
    if (cleaned.endsWith(')') && (cleaned.match(/\(/g) || []).length < (cleaned.match(/\)/g) || []).length) {
        cleaned = cleaned.slice(0, -1);
    }

    return cleaned || null;
}

// =====================================================
// INIST-style Verification (Port from Python algorithm)
// =====================================================

/**
 * Remove accents and normalize text for comparison
 * Equivalent to INIST's uniformize() function
 */
function uniformize(text) {
    if (!text || typeof text !== 'string') return '';

    // Normalize unicode and remove accents
    const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Remove punctuation, keep only letters and spaces
    const cleaned = normalized.replace(/[^\p{L}\s]/gu, ' ');

    return cleaned.toLowerCase().split(/\s+/).filter(Boolean).join(' ');
}

/**
 * Simplified fuzzy matching similar to fuzz.partial_ratio
 * Uses Levenshtein-based similarity for partial string matching
 */
function partialRatio(str1, str2) {
    if (!str1 || !str2) return 0;

    const s1 = uniformize(str1);
    const s2 = uniformize(str2);

    if (!s1 || !s2) return 0;

    // Check if shorter string is contained in longer
    const shorter = s1.length < s2.length ? s1 : s2;
    const longer = s1.length >= s2.length ? s1 : s2;

    if (longer.includes(shorter)) {
        return 1.0;
    }

    // Use word overlap for partial matching
    const words1 = s1.split(' ');
    const words2 = s2.split(' ');

    const commonWords = words1.filter(w => words2.includes(w));
    const minWords = Math.min(words1.length, words2.length);

    if (minWords === 0) return 0;

    return commonWords.length / minWords;
}

/**
 * Build a reference string from CSL entry for matching
 */
function buildRefString(entry) {
    const parts = [];

    // Authors - ensure it's an array before mapping
    if (entry.author && Array.isArray(entry.author)) {
        const authorStr = entry.author.map(a =>
            [a.family, a.given].filter(Boolean).join(' ')
        ).join(', ');
        if (authorStr) parts.push(authorStr);
    } else if (entry.author && typeof entry.author === 'string') {
        parts.push(entry.author);
    }

    // Year
    if (entry.issued?.['date-parts']?.[0]?.[0]) {
        parts.push(String(entry.issued['date-parts'][0][0]));
    }

    // Title
    if (entry.title) parts.push(entry.title);

    // Container/Journal
    if (entry['container-title']) parts.push(entry['container-title']);

    // Publisher
    if (entry.publisher) parts.push(entry.publisher);

    return parts.join(' ');
}

/**
 * Extract DOI from text using regex (INIST-style)
 */
function findDOI(text) {
    if (!text) return null;

    // Remove line breaks for DOI detection
    const cleanedText = text.replace(/\s+/g, '');

    const doiRegex = /10\.\d{4,}\/[^\s,]+/;
    const match = cleanedText.match(doiRegex);

    if (match) {
        let doi = match[0].toLowerCase();
        // Clean trailing punctuation
        doi = doi.replace(/[.,;:)\]]+$/, '');
        return doi;
    }

    return null;
}

/**
 * Match criteria scoring (INIST algorithm)
 * Compares CrossRef result with original reference
 * Returns score (0-4) and title similarity
 */
function matchCriteria(crossrefData, refBiblio) {
    let score = 0;
    const refNorm = uniformize(refBiblio);

    // 1. Title matching (> 0.8 = +1)
    const titleScore = partialRatio(crossrefData.title || '', refBiblio);
    if (titleScore > 0.8) score++;

    // 2. First author matching
    if (crossrefData.firstAuthor && refNorm.includes(uniformize(crossrefData.firstAuthor))) {
        score++;
    }

    // 3. Date matching
    if (crossrefData.year && refNorm.includes(String(crossrefData.year))) {
        score++;
    }

    // 4. Source/journal matching (> 0.8 = +1)
    if (crossrefData.journal) {
        const journalScore = partialRatio(crossrefData.journal, refBiblio);
        if (journalScore > 0.8) score++;
    }

    return { score, titleScore };
}

/**
 * Extract key info from CrossRef response
 */
function extractCrossRefInfo(message) {
    return {
        doi: message.DOI || '',
        title: message.title?.[0] || '',
        firstAuthor: message.author?.[0]?.family || '',
        firstAuthorGiven: message.author?.[0]?.given || '',
        year: message.issued?.['date-parts']?.[0]?.[0] ||
            message['published-print']?.['date-parts']?.[0]?.[0] || '',
        journal: message['container-title']?.[0] || message['short-container-title']?.[0] || '',
        type: message.type || ''
    };
}

/**
 * Search CrossRef without DOI (bibliographic query)
 */
async function searchCrossRefBibliographic(refString) {
    try {
        const query = encodeURIComponent(refString.substring(0, 500)); // Limit query length
        const response = await fetch(
            `https://api.crossref.org/works?query.bibliographic=${query}&rows=5`
        );

        if (!response.ok) {
            return { status: 'error_service', doi: '', confidence: 0 };
        }

        const data = await response.json();
        const items = data.message?.items || [];

        let hallucinated = false;
        let bestMatch = null;

        for (const item of items) {
            const itemInfo = extractCrossRefInfo(item);
            const { score, titleScore } = matchCriteria(itemInfo, refString);

            // 3+ criteria matched = found
            if (score >= 3) {
                return {
                    status: 'found',
                    doi: itemInfo.doi,
                    confidence: 95,
                    crossrefData: itemInfo,
                    matchScore: score
                };
            }

            // Title very similar but low overall score = potential hallucination
            if (titleScore > 0.9 && score < 2) {
                hallucinated = true;
                bestMatch = itemInfo;
            }

            // 2 criteria + high title score
            if (score === 2 && titleScore > 0.98) {
                return {
                    status: 'found',
                    doi: itemInfo.doi,
                    confidence: 85,
                    crossrefData: itemInfo,
                    matchScore: score
                };
            }

            // 2 criteria + moderate title
            if (score === 2 && titleScore > 0.6) {
                return {
                    status: 'found',
                    doi: itemInfo.doi,
                    confidence: 75,
                    crossrefData: itemInfo,
                    matchScore: score
                };
            }
        }

        if (hallucinated && bestMatch) {
            return {
                status: 'to_be_verified',
                doi: '',
                confidence: 40,
                crossrefData: bestMatch,
                reason: 'Titre similaire mais métadonnées discordantes (hallucination probable)'
            };
        }

        return { status: 'not_found', doi: '', confidence: 0 };

    } catch (error) {
        return { status: 'error_service', doi: '', confidence: 0 };
    }
}

/**
 * Main INIST-style verification function
 * Implements the full biblio-ref algorithm in JavaScript
 */


// Types de mise à jour Crossref (champ `type` de `updated-by` / `update-to`).
// Seuls ceux-ci retirent l'article ; une correction ou un erratum non.
const TYPES_RETRAIT = new Set(["retraction", "partial_retraction", "withdrawal", "removal"]);
const TYPES_ALERTE = new Set(["expression_of_concern"]);
const LIBELLES = {
    retraction: "rétractation",
    partial_retraction: "rétractation partielle",
    withdrawal: "retrait",
    removal: "suppression",
    expression_of_concern: "avis de préoccupation"
};

/**
 * Lit, dans une notice Crossref, si l'article a été rétracté.
 * - `updated-by` : notices publiées contre cet article (rétractation,
 *   correction…), y compris celles de Retraction Watch (source
 *   « retraction-watch ») ;
 * - `update-to` : cet enregistrement est lui-même un avis portant sur un autre.
 * Exportée pour les tests.
 */
export function lireRetraction(work) {
    const pasDeRetraction = {retracted: false, concern: false, method: 'Crossref', details: 'Aucune rétractation connue'};
    if (!work) return pasDeRetraction;

    const avis = (work['updated-by'] || []).filter((u) => TYPES_RETRAIT.has(u.type));
    if (avis.length) {
        const u = avis[avis.length - 1];
        const rw = u.source === 'retraction-watch';
        const annee = u.updated?.['date-parts']?.[0]?.[0];
        return {
            retracted: true,
            concern: false,
            method: rw ? 'Retraction Watch Database' : 'Publisher Notice',
            source: u.source || 'publisher',
            retractionDOI: u.DOI,
            details: `${LIBELLES[u.type] || u.type}${annee ? ` (${annee})` : ''}, signalée par ${rw ? 'Retraction Watch' : "l'éditeur"} via Crossref`
        };
    }

    const notice = (work['update-to'] || []).find((u) => TYPES_RETRAIT.has(u.type));
    if (notice) {
        return {
            retracted: true,
            concern: false,
            method: 'Avis de rétractation',
            source: 'crossref',
            retractionDOI: notice.DOI,
            details: `Cette référence est elle-même un avis de ${LIBELLES[notice.type] || notice.type} (portant sur ${notice.DOI})`
        };
    }

    const titre = work.title?.[0] || '';
    if (/^\s*(RETRACTED|WITHDRAWN)\b|\[RETRACTED\]/i.test(titre)) {
        return {retracted: true, concern: false, method: 'Titre Crossref', source: 'crossref', details: `Titre marqué « ${titre.slice(0, 60)}… » dans Crossref`};
    }

    const alerte = (work['updated-by'] || []).find((u) => TYPES_ALERTE.has(u.type));
    if (alerte) {
        return {retracted: false, concern: true, method: 'Crossref', retractionDOI: alerte.DOI, details: `${LIBELLES[alerte.type]} publié (${alerte.DOI})`};
    }
    return pasDeRetraction;
}

/**
 * L'article a-t-il été rétracté ? Interroge Crossref par DOI seulement :
 * sans DOI (livres, pages web), on ne peut rien dire, et on ne devine pas.
 * Les données de Retraction Watch sont intégrées à Crossref depuis 2023.
 */
export async function checkRetraction(doi) {
    const cleanedDOI = cleanDOI(doi);
    if (!cleanedDOI) {
        return {retracted: false, concern: false, checked: false, method: 'Pas de DOI', details: 'Pas de DOI : rétractation non vérifiable'};
    }
    try {
        const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(cleanedDOI)}`);
        if (!response.ok) {
            return {retracted: false, concern: false, checked: false, method: 'Crossref', details: `DOI inconnu de Crossref (${response.status})`};
        }
        const data = await response.json();
        return {...lireRetraction(data.message), checked: true};
    } catch (error) {
        return {retracted: false, concern: false, checked: false, method: 'Crossref', details: 'Crossref injoignable'};
    }
}

/**
 * Detect potentially hallucinated (AI-generated fake) references
 * Returns a risk assessment
 */
export function detectHallucinationRisk(entry, verificationResult) {
    let riskScore = 0;
    const warnings = [];

    // 1. Not found in any database (50 points)
    if (!verificationResult || verificationResult.status === 'not_found') {
        riskScore += 50;
        warnings.push('Référence introuvable dans les bases de données');
    }

    // 2. Very low confidence even with a result (30 points)
    if (verificationResult?.verified?.confidence < 40) {
        riskScore += 30;
        warnings.push(`Confiance très faible: ${verificationResult.verified.confidence}%`);
    }

    // 3. Suspicious title patterns (20 points)
    const suspiciousPatterns = [
        { pattern: /^(A|An|The)\s+Study\s+of/i, desc: 'Titre générique "A Study of..."' },
        { pattern: /^On\s+the\s+/i, desc: 'Titre générique "On the..."' },
        { pattern: /:\s+A\s+(Comprehensive|Systematic)\s+Review$/i, desc: 'Sous-titre générique' },
        { pattern: /^Introduction\s+to/i, desc: 'Titre générique "Introduction to..."' }
    ];

    const matchedPattern = suspiciousPatterns.find(p => p.pattern.test(entry.title));
    if (matchedPattern) {
        riskScore += 20;
        warnings.push(matchedPattern.desc);
    }

    // 4. Future year or impossibly old for modern topic (40 points)
    const year = entry.year || verificationResult?.verified?.year;
    const currentYear = new Date().getFullYear();
    if (year) {
        if (year > currentYear) {
            riskScore += 40;
            warnings.push(`Année future: ${year}`);
        } else if (year < 1900 && entry.title?.toLowerCase().includes('digital')) {
            riskScore += 30;
            warnings.push('Année ancienne pour un sujet moderne');
        }
    }

    // 5. Author with only initials (easier to fake) (10 points)
    const authorStr = extractAuthorString(entry);
    if (authorStr && /^[A-Z]\.\s*[A-Z]\.$/.test(authorStr)) {
        riskScore += 10;
        warnings.push('Auteur avec initiales uniquement');
    }

    // 6. Missing essential metadata (15 points)
    if (!entry.author || (Array.isArray(entry.author) && entry.author.length === 0)) {
        riskScore += 15;
        warnings.push('Auteur manquant');
    }

    // 7. Suspicious publisher or journal names (20 points)
    const suspiciousPublishers = [
        /international\s+journal\s+of\s+advanced\s+research/i,
        /journal\s+of\s+universal/i,
        /global\s+journal/i
    ];

    const publisher = entry.publisher || entry['container-title'];
    if (publisher && suspiciousPublishers.some(p => p.test(publisher))) {
        riskScore += 20;
        warnings.push('Éditeur/journal suspect');
    }

    // Calculate final risk level
    const level = riskScore >= 70 ? 'high' : riskScore >= 40 ? 'medium' : 'low';

    return {
        riskScore: Math.min(riskScore, 100),
        level,
        warnings,
        recommendation: level === 'high'
            ? '🚨 Vérification manuelle fortement recommandée'
            : level === 'medium'
                ? '⚠️ Vérification manuelle conseillée'
                : '✅ Risque faible'
    };
}

/**
 * Helper to extract author string from CSL entry
 */
function extractAuthorString(entry) {
    if (!entry.author) return '';

    if (typeof entry.author === 'string') {
        return entry.author;
    }

    if (Array.isArray(entry.author) && entry.author.length > 0) {
        const firstAuthor = entry.author[0];
        if (firstAuthor.literal) return firstAuthor.literal;
        if (firstAuthor.family) {
            return firstAuthor.given
                ? `${firstAuthor.given} ${firstAuthor.family}`
                : firstAuthor.family;
        }
    }

    return '';
}

/**
 * Helper to extract year from CSL entry
 */
function extractYear(entry) {
    if (entry.year) return entry.year;
    if (entry.issued?.['date-parts']?.[0]?.[0]) {
        return entry.issued['date-parts'][0][0];
    }
    return null;
}

/**
 * Validate CSL-JSON structure and detect common formatting issues
 */
export function validateCSLFormat(cslData) {
    const issues = [];

    if (!Array.isArray(cslData)) {
        return {
            valid: false,
            issues: [{
                index: -1,
                severity: 'error',
                message: 'CSL data must be an array',
                field: 'root'
            }],
            stats: { errors: 1, warnings: 0 }
        };
    }

    cslData.forEach((entry, index) => {
        // Required field: title
        if (!entry.title || entry.title.trim() === '') {
            issues.push({
                index,
                severity: 'error',
                message: 'Titre manquant ou vide',
                field: 'title',
                entry: entry
            });
        }

        // Author validation
        if (!entry.author || (Array.isArray(entry.author) && entry.author.length === 0)) {
            issues.push({
                index,
                severity: 'warning',
                message: 'Auteur manquant',
                field: 'author',
                entry: entry
            });
        } else if (Array.isArray(entry.author)) {
            entry.author.forEach((author, aIndex) => {
                if (!author.family && !author.literal) {
                    issues.push({
                        index,
                        severity: 'warning',
                        message: `Auteur ${aIndex + 1}: nom de famille ou nom littéral manquant`,
                        field: `author[${aIndex}]`,
                        entry: entry
                    });
                }
            });
        }

        // Date validation
        if (entry.issued?.['date-parts']) {
            const year = entry.issued['date-parts'][0]?.[0];
            const currentYear = new Date().getFullYear();

            if (year && (year < 1000 || year > currentYear + 5)) {
                issues.push({
                    index,
                    severity: 'warning',
                    message: `Année suspecte: ${year}`,
                    field: 'issued',
                    entry: entry
                });
            }
        }

        // DOI validation
        if (entry.DOI && !/^10\.\d{4,}\/\S+$/.test(entry.DOI)) {
            issues.push({
                index,
                severity: 'warning',
                message: `Format DOI invalide: ${entry.DOI}`,
                field: 'DOI',
                entry: entry
            });
        }

        // URL validation
        if (entry.URL) {
            try {
                new URL(entry.URL);
            } catch (e) {
                issues.push({
                    index,
                    severity: 'warning',
                    message: `URL invalide: ${entry.URL}`,
                    field: 'URL',
                    entry: entry
                });
            }
        }

        // Type validation
        const validTypes = [
            'article', 'article-journal', 'article-magazine', 'article-newspaper',
            'book', 'chapter', 'paper-conference', 'report', 'thesis',
            'webpage', 'post-weblog'
        ];

        if (entry.type && !validTypes.includes(entry.type)) {
            issues.push({
                index,
                severity: 'info',
                message: `Type non standard: ${entry.type}`,
                field: 'type',
                entry: entry
            });
        }
    });

    const stats = {
        errors: issues.filter(i => i.severity === 'error').length,
        warnings: issues.filter(i => i.severity === 'warning').length,
        info: issues.filter(i => i.severity === 'info').length
    };

    return {
        valid: stats.errors === 0,
        issues,
        stats
    };
}

/**
 * Advanced duplicate detection
 */
export function detectDuplicates(entries) {
    const duplicates = [];

    for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
            const entry1 = entries[i];
            const entry2 = entries[j];

            // Title similarity
            const titleSim = calculateSimilarity(
                cleanTitle(entry1.title || ''),
                cleanTitle(entry2.title || '')
            );

            // Author similarity
            const author1 = extractAuthorString(entry1);
            const author2 = extractAuthorString(entry2);
            const authorSim = calculateSimilarity(author1, author2);

            // Year match
            const year1 = extractYear(entry1);
            const year2 = extractYear(entry2);
            const yearMatch = year1 && year2 && year1 === year2;

            // DOI match (if both have DOI, it's definitive)
            const doiMatch = entry1.DOI && entry2.DOI && entry1.DOI === entry2.DOI;

            // Composite score
            let duplicateScore = (titleSim * 0.6) + (authorSim * 0.3);
            if (yearMatch) duplicateScore += 10;
            if (doiMatch) duplicateScore = 100; // DOI match is definitive

            if (duplicateScore > 75) {
                duplicates.push({
                    indices: [i, j],
                    entries: [entry1, entry2],
                    score: Math.round(duplicateScore),
                    titleSimilarity: titleSim,
                    authorSimilarity: authorSim,
                    yearMatch,
                    doiMatch,
                    recommendation: doiMatch
                        ? 'Doublons certains (même DOI)'
                        : duplicateScore > 90
                            ? 'Doublons très probables'
                            : 'Doublons possibles'
                });
            }
        }
    }

    return duplicates;
}

/**
 * Generate comprehensive quality report
 */
export async function generateQualityReport(entries, verificationResults) {
    const report = {
        totalEntries: entries.length,
        timestamp: new Date().toISOString(),
        verification: {
            verified: 0,
            uncertain: 0,
            notFound: 0
        },
        integrity: {
            retracted: 0,
            retractionDetails: []
        },
        hallucinationRisk: {
            high: 0,
            medium: 0,
            low: 0,
            details: []
        },
        format: {
            errors: 0,
            warnings: 0,
            info: 0,
            issues: []
        },
        duplicates: {
            count: 0,
            pairs: []
        },
        sources: {
            'BnF (SPARQL)': 0,
            'BnF (SRU)': 0,
            'HAL': 0,
            'OpenLibrary': 0,
            'CrossRef': 0,
            'None': 0
        }
    };

    // Process verification results
    for (let i = 0; i < verificationResults.length; i++) {
        const result = verificationResults[i];
        const entry = entries[i];

        // Verification status
        report.verification[result.status]++;

        // Source
        const source = result.verified?.source || 'None';
        if (report.sources[source] !== undefined) {
            report.sources[source]++;
        } else {
            report.sources['None']++;
        }

        // Retraction check (only for verified entries with DOI or good confidence)
        if (result.verified && (result.verified.doi || result.verified.confidence > 70)) {
            const retractionCheck = await checkRetraction(result.verified.doi);

            if (retractionCheck.retracted) {
                report.integrity.retracted++;
                report.integrity.retractionDetails.push({
                    index: i,
                    title: entry.title,
                    ...retractionCheck
                });
            }
        }

        // Hallucination risk
        const hallRisk = detectHallucinationRisk(entry, result);
        report.hallucinationRisk[hallRisk.level]++;

        if (hallRisk.level !== 'low') {
            report.hallucinationRisk.details.push({
                index: i,
                title: entry.title,
                ...hallRisk
            });
        }
    }

    // Format validation
    const formatValidation = validateCSLFormat(entries);
    report.format = {
        ...formatValidation.stats,
        issues: formatValidation.issues
    };

    // Duplicate detection
    const duplicates = detectDuplicates(entries);
    report.duplicates = {
        count: duplicates.length,
        pairs: duplicates
    };

    // Calculate overall quality score (0-100)
    const qualityScore = calculateQualityScore(report);
    report.qualityScore = qualityScore;

    return report;
}

/**
 * Calculate overall quality score
 */
function calculateQualityScore(report) {
    let score = 100;

    // Penalize for unverified entries
    const verificationRate = report.verification.verified / report.totalEntries;
    score -= (1 - verificationRate) * 30;

    // Heavy penalty for retracted articles
    score -= report.integrity.retracted * 10;

    // Penalty for hallucination risk
    score -= report.hallucinationRisk.high * 8;
    score -= report.hallucinationRisk.medium * 3;

    // Penalty for format errors
    score -= report.format.errors * 5;
    score -= report.format.warnings * 1;

    // Penalty for duplicates
    score -= report.duplicates.count * 3;

    return Math.max(0, Math.round(score));
}
