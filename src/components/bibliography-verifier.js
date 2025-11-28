// Bibliography Verifier - Simplified Version
// Uses OpenLibrary API to verify and enrich bibliography data

/**
 * Calculate similarity between two strings using Levenshtein distance
 */
export function calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;

    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 100;

    // Levenshtein distance
    const matrix = [];
    for (let i = 0; i <= s2.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= s1.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= s2.length; i++) {
        for (let j = 1; j <= s1.length; j++) {
            if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    const distance = matrix[s2.length][s1.length];
    const maxLen = Math.max(s1.length, s2.length);
    return Math.round((1 - distance / maxLen) * 100);
}

/**
 * Extract the last name of the first author for better search results
 */
export function extractLastName(authorString) {
    if (!authorString) return '';

    // Take only the first author if multiple
    let firstAuthor = authorString.split(/,| et |&| and /)[0].trim();

    // Remove initials if present (e.g. "H. Arendt" -> "Arendt")
    // This regex looks for "X. " or "X " at the start
    firstAuthor = firstAuthor.replace(/^[A-Z]\.?\s+/, '');

    // Handle "Lastname F." format (remove single letter initials at the end)
    firstAuthor = firstAuthor.replace(/\s+[A-Z]\.?$/, '');

    // Handle particles (de, van, von, etc.)
    // We want to keep them if they are part of the last name in common usage,
    // but often APIs index by the main part.
    // Let's try to keep the particle if it's lowercase, but ensure we don't just get the particle.

    // If it's "Lastname Firstname" format (no comma, but we want to be safe)
    // usually bibliography is "Author, Title" so author string is just the name

    // Check for common particles
    const particles = ['de', 'du', 'des', 'le', 'la', 'les', 'van', 'von', 'den', 'der'];
    const parts = firstAuthor.split(/\s+/);

    if (parts.length > 1) {
        // Check if the second to last part is a particle
        const secondToLast = parts[parts.length - 2].toLowerCase();
        if (particles.includes(secondToLast)) {
            // Return "Particle Lastname"
            return parts.slice(parts.length - 2).join(' ');
        }
    }

    // Just in case, take the last word if there are still spaces
    return parts[parts.length - 1];
}

/**
 * Clean title by removing subtitles and punctuation that might confuse search
 */
export function cleanTitle(title) {
    if (!title) return '';

    // Remove subtitle (text after : or . or - if surrounded by spaces)
    let cleaned = title.split(':')[0];

    // Split by " - " (dash with spaces)
    cleaned = cleaned.split(' - ')[0];

    // Remove text in parentheses
    cleaned = cleaned.replace(/\([^)]*\)/g, '');

    // Remove text in brackets
    cleaned = cleaned.replace(/\[[^\]]*\]/g, '');

    // Remove common volume/edition abbreviations
    cleaned = cleaned.replace(/\b(Vol\.|Tome|Ed\.|Éd\.)\s*\d+/gi, '');

    // Remove trailing punctuation
    cleaned = cleaned.replace(/[.,;]+$/, '');

    return cleaned.trim();
}

/**
 * Search OpenLibrary for a book
 */
export async function searchOpenLibrary(title, author) {
    try {
        // Build query - use last name and cleaned title for better matching
        const cleanedTitle = cleanTitle(title);
        let query = `title:${cleanedTitle}`;
        if (author) {
            const lastName = extractLastName(author);
            query += ` author:${lastName}`;
        }

        const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=3`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (!data.docs || data.docs.length === 0) {
            return null;
        }

        // Get best match
        const bestMatch = data.docs[0];
        const similarity = calculateSimilarity(title, bestMatch.title || '');

        return {
            title: bestMatch.title,
            author: bestMatch.author_name?.[0] || author,
            year: bestMatch.first_publish_year,
            isbn: bestMatch.isbn?.[0],
            publisher: bestMatch.publisher?.[0],
            url: bestMatch.key ? `https://openlibrary.org${bestMatch.key}` : '',
            confidence: similarity,
            source: 'OpenLibrary',
            found: true
        };
    } catch (error) {
        console.error('OpenLibrary search error:', error);
        return null;
    }
}

/**
 * Search CrossRef for academic articles
 */
export async function searchCrossRef(title, author) {
    try {
        // Build query
        const cleanedTitle = cleanTitle(title);
        let query = cleanedTitle;
        if (author) {
            const lastName = extractLastName(author);
            query += ` ${lastName}`;
        }

        const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=3`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'BibliographyConverter/1.0 (mailto:contact@example.com)'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (!data.message?.items || data.message.items.length === 0) {
            return null;
        }

        // Get best match
        const bestMatch = data.message.items[0];
        const matchTitle = bestMatch.title?.[0] || '';
        const similarity = calculateSimilarity(title, matchTitle);

        // Extract author
        const authorName = bestMatch.author?.[0]
            ? `${bestMatch.author[0].given || ''} ${bestMatch.author[0].family || ''}`.trim()
            : author;

        return {
            title: matchTitle,
            author: authorName,
            year: bestMatch.published?.['date-parts']?.[0]?.[0],
            doi: bestMatch.DOI,
            publisher: bestMatch.publisher,
            url: bestMatch.URL || (bestMatch.DOI ? `https://doi.org/${bestMatch.DOI}` : ''),
            confidence: similarity,
            source: 'CrossRef',
            found: true
        };
    } catch (error) {
        console.error('CrossRef search error:', error);
        return null;
    }
}

/**
 * Search HAL (Hyper Articles en Ligne) for French academic publications
 */
export async function searchHAL(title, author) {
    try {
        // Build query - HAL uses a different query syntax
        const cleanedTitle = cleanTitle(title);
        let query = `title_t:"${cleanedTitle}"`;
        if (author) {
            // Extract last name for better matching using our robust helper
            const lastName = extractLastName(author);
            query += ` AND authFullName_t:${lastName}`;
        }

        const url = `https://api.archives-ouvertes.fr/search/?q=${encodeURIComponent(query)}&rows=3&wt=json`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (!data.response?.docs || data.response.docs.length === 0) {
            return null;
        }

        // Get best match
        const bestMatch = data.response.docs[0];
        const matchTitle = bestMatch.title_s?.[0] || bestMatch.en_title_s?.[0] || '';
        const similarity = calculateSimilarity(title, matchTitle);

        // Extract author name
        const authorName = bestMatch.authFullName_s?.[0] || author;

        return {
            title: matchTitle,
            author: authorName,
            year: bestMatch.publicationDateY_i || bestMatch.producedDateY_i,
            halId: bestMatch.halId_s,
            publisher: bestMatch.publisher_s?.[0],
            url: bestMatch.uri_s || (bestMatch.halId_s ? `https://hal.science/${bestMatch.halId_s}` : ''),
            confidence: similarity,
            source: 'HAL',
            found: true
        };
    } catch (error) {
        console.error('HAL search error:', error);
        return null;
    }
}

/**
 * Verify and enrich a list of bibliography entries
 */
export async function verifyBibliography(entries) {
    const results = [];

    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];

        // Add delay to respect API rate limits
        if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        let bestResult = null;

        // Try HAL first (best for French academic publications)
        const halResult = await searchHAL(entry.title, entry.author);
        if (halResult && halResult.confidence >= 60) {
            bestResult = halResult;
        }

        // If HAL didn't find a good match, try OpenLibrary (for books)
        if (!bestResult || bestResult.confidence < 70) {
            await new Promise(resolve => setTimeout(resolve, 200));
            const openLibResult = await searchOpenLibrary(entry.title, entry.author);

            if (openLibResult && (!bestResult || openLibResult.confidence > bestResult.confidence)) {
                bestResult = openLibResult;
            }
        }

        // If still no good match, try CrossRef (for articles)
        if (!bestResult || bestResult.confidence < 70) {
            await new Promise(resolve => setTimeout(resolve, 200));
            const crossRefResult = await searchCrossRef(entry.title, entry.author);

            if (crossRefResult && (!bestResult || crossRefResult.confidence > bestResult.confidence)) {
                bestResult = crossRefResult;
            }
        }

        results.push({
            original: entry,
            verified: bestResult,
            status: bestResult ? (bestResult.confidence >= 70 ? 'verified' : 'uncertain') : 'not_found'
        });
    }

    return results;
}

