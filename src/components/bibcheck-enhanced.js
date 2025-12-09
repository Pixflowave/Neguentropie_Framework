// Bibcheck Enhanced - Advanced bibliography verification
// Extends bibliography-verifier.js with Bibcheck-inspired features

import { calculateSimilarity, cleanTitle, extractLastName } from './bibliography-verifier.js';

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

/**
 * Check if an article has been retracted
 * Uses CrossRef API to detect retraction notices (includes Retraction Watch data since 2023)
 */
export async function checkRetraction(doi, title, author) {
    const checks = [];

    // Clean DOI before lookup
    const cleanedDOI = cleanDOI(doi);

    // Method 1: CrossRef API (if DOI available) - Now includes Retraction Watch Database!
    if (cleanedDOI) {
        try {
            const response = await fetch(`https://api.crossref.org/works/${cleanedDOI}`);

            if (response.ok) {
                const data = await response.json();
                const work = data.message;

                // Check for retraction notice (update-to field)
                if (work['update-to']) {
                    const updateInfo = work['update-to'][0];
                    const source = updateInfo?.source || 'publisher';
                    const isRetractionWatch = source === 'retraction-watch';

                    return {
                        retracted: true,
                        confidence: isRetractionWatch ? 100 : 95,
                        method: isRetractionWatch ? 'Retraction Watch Database' : 'Publisher Notice',
                        source: source,
                        retractionDOI: updateInfo?.DOI,
                        details: isRetractionWatch
                            ? '🔴 Article signalé par Retraction Watch Database (via CrossRef)'
                            : 'Article rétracté par l\'éditeur (via CrossRef)',
                        badge: isRetractionWatch ? 'retraction-watch' : 'publisher'
                    };
                }

                // Check if this IS a retraction notice
                if (work.type === 'retraction') {
                    return {
                        retracted: true,
                        confidence: 100,
                        method: 'CrossRef type',
                        source: 'crossref',
                        details: 'Cette entrée est elle-même un avis de rétractation',
                        badge: 'retraction-notice'
                    };
                }

                // Check if CrossRef title starts with "RETRACTED:" 
                // (common format for retracted articles in CrossRef)
                const crossrefTitle = work.title?.[0] || '';
                if (crossrefTitle.toUpperCase().startsWith('RETRACTED:') ||
                    crossrefTitle.toUpperCase().includes('[RETRACTED]')) {
                    return {
                        retracted: true,
                        confidence: 95,
                        method: 'CrossRef title',
                        source: 'crossref',
                        details: '🔴 Article marqué RETRACTED dans CrossRef',
                        badge: 'crossref-retracted',
                        crossrefTitle: crossrefTitle
                    };
                }
            }
        } catch (error) {
            // Silently handle CrossRef errors
        }
    }

    // Method 2: Title analysis
    if (title) {
        const retractionKeywords = [
            'retraction',
            'retracted',
            'withdrawn',
            'correction',
            'erratum',
            'expression of concern'
        ];

        const lowerTitle = title.toLowerCase();
        const foundKeyword = retractionKeywords.find(kw => lowerTitle.includes(kw));

        if (foundKeyword) {
            return {
                retracted: true,
                confidence: 70,
                method: 'Title analysis',
                keyword: foundKeyword,
                details: `Title contains retraction keyword: "${foundKeyword}"`
            };
        }
    }

    // Method 3: Search for retraction notices (if we have author and title)
    if (title && author) {
        try {
            const searchQuery = `${cleanTitle(title)} retraction ${extractLastName(author)}`;
            const response = await fetch(
                `https://api.crossref.org/works?query=${encodeURIComponent(searchQuery)}&rows=3`
            );

            if (response.ok) {
                const data = await response.json();
                const retractionNotice = data.message?.items?.find(item =>
                    item.type === 'retraction' &&
                    calculateSimilarity(item.title?.[0] || '', title) > 60
                );

                if (retractionNotice) {
                    return {
                        retracted: true,
                        confidence: 80,
                        method: 'Retraction notice search',
                        retractionDOI: retractionNotice.DOI,
                        details: 'Found a retraction notice for this article'
                    };
                }
            }
        } catch (error) {
            console.warn('Retraction notice search failed:', error);
        }
    }

    return {
        retracted: false,
        confidence: 0,
        method: 'No retraction detected',
        details: 'No evidence of retraction found'
    };
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
            const retractionCheck = await checkRetraction(
                result.verified.doi,
                result.verified.title,
                result.verified.author
            );

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
