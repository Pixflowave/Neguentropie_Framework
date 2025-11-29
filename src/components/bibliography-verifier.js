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
/**
 * Search BnF (Bibliothèque nationale de France) via SRU API
 */
export async function searchBnF(title, author) {
    try {
        // Build query
        const cleanedTitle = cleanTitle(title);
        let query = `bib.title all "${cleanedTitle}"`;
        if (author) {
            const lastName = extractLastName(author);
            query += ` and bib.author all "${lastName}"`;
        }

        const url = `https://catalogue.bnf.fr/api/SRU?version=1.2&operation=searchRetrieve&query=${encodeURIComponent(query)}&recordSchema=dublincore&maximumRecords=3`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const xmlText = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");

        const records = xmlDoc.getElementsByTagName("srw:record");
        if (records.length === 0) {
            return null;
        }

        // Get best match
        const bestRecord = records[0];

        // Helper to get text content of a tag
        const getTag = (parent, tagName) => {
            const el = parent.getElementsByTagName(tagName)[0];
            return el ? el.textContent : "";
        };

        const matchTitle = getTag(bestRecord, "dc:title");
        const matchCreator = getTag(bestRecord, "dc:creator");
        const matchDate = getTag(bestRecord, "dc:date");
        const matchPublisher = getTag(bestRecord, "dc:publisher");
        const matchIdentifier = getTag(bestRecord, "dc:identifier"); // Usually ISBN or URI

        const similarity = calculateSimilarity(title, matchTitle);

        // Clean the record identifier - it might already contain ark:/12148/
        let recordId = bestRecord.getElementsByTagName("srw:recordIdentifier")[0]?.textContent || '';

        console.log('[BnF SRU] Original recordId:', recordId);

        // Remove ark:/12148/ prefix if it exists (we'll add it back)
        recordId = recordId.replace(/^ark:\/12148\//, '');

        console.log('[BnF SRU] Cleaned recordId:', recordId);

        const bnfUrl = `https://catalogue.bnf.fr/ark:/12148/${recordId}`;

        console.log('[BnF SRU] Final URL:', bnfUrl);

        return {
            title: matchTitle,
            author: matchCreator || author,
            year: matchDate,
            isbn: matchIdentifier, // This might be a URI, but often contains ISBN
            publisher: matchPublisher,
            url: bnfUrl,
            confidence: similarity,
            source: 'BnF (SRU)',
            found: true
        };
    } catch (error) {
        console.error('BnF search error:', error);
        return null;
    }
}

/**
 * Search BnF via SPARQL endpoint (data.bnf.fr)
 * Optimized with bif:contains for full-text search performance
 */
export async function searchBnFSparql(title, author) {
    try {
        // Clean and escape for SPARQL
        // We remove special characters that might break the query or aren't useful for search
        const cleanForSparql = (str) => {
            return str.replace(/["]/g, ' ')  // Remove quotes
                .replace(/\s+/g, ' ')   // Normalize spaces
                .trim();
        };

        const cleanedTitle = cleanForSparql(cleanTitle(title));
        const lastName = cleanForSparql(extractLastName(author));

        if (!cleanedTitle || !lastName) return null;

        // Use bif:contains for fast full-text search
        // Note: We use 'AND' implicitly in bif:contains by just listing words
        const query = `
        PREFIX dcterms: <http://purl.org/dc/terms/>
        PREFIX foaf: <http://xmlns.com/foaf/0.1/>
        
        SELECT DISTINCT ?work ?title ?creatorName ?date ?publisher WHERE {
          ?work dcterms:title ?title .
          ?title bif:contains "'${cleanedTitle}'" .
          
          ?work dcterms:creator ?creator .
          ?creator foaf:name ?creatorName .
          ?creatorName bif:contains "'${lastName}'" .
          
          OPTIONAL { ?work dcterms:date ?date }
          OPTIONAL { ?work dcterms:publisher ?publisher }
        } LIMIT 3
        `;

        const url = `https://data.bnf.fr/sparql?query=${encodeURIComponent(query)}&format=json`;

        // Create a timeout promise (5 seconds)
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('SPARQL request timed out')), 5000)
        );

        // Race between fetch and timeout
        const response = await Promise.race([
            fetch(url),
            timeoutPromise
        ]);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (!data.results?.bindings || data.results.bindings.length === 0) {
            return null;
        }

        // Find best match
        let bestMatch = null;
        let maxSimilarity = 0;

        for (const result of data.results.bindings) {
            const resultTitle = result.title.value;
            const similarity = calculateSimilarity(title, resultTitle);

            if (similarity > maxSimilarity) {
                maxSimilarity = similarity;

                // Clean the BnF URL - the SPARQL endpoint sometimes returns malformed URIs
                // with duplicate ARK prefixes like "https://catalogue.bnf.fr/ark:/12148/ark:/12148/cb412050783"
                let workUrl = result.work.value;

                console.log('[BnF SPARQL] Original URL:', workUrl);

                // Remove any duplicate ark:/12148/ patterns (keep only the last occurrence)
                // This handles cases like: /ark:/12148/ark:/12148/ -> /ark:/12148/
                workUrl = workUrl.replace(/(ark:\/12148\/)+/g, 'ark:/12148/');

                console.log('[BnF SPARQL] After dedup:', workUrl);

                // If the URL is just an ARK identifier (starts with "ark:"), prepend the catalogue base
                if (workUrl.startsWith('ark:/')) {
                    workUrl = `https://catalogue.bnf.fr/${workUrl}`;
                    console.log('[BnF SPARQL] Added base URL:', workUrl);
                }

                console.log('[BnF SPARQL] Final URL:', workUrl);

                bestMatch = {
                    title: resultTitle,
                    author: result.creatorName.value,
                    year: result.date?.value,
                    publisher: result.publisher?.value,
                    url: workUrl,
                    confidence: similarity,
                    source: 'BnF (SPARQL)',
                    found: true
                };
            }
        }

        return bestMatch;

    } catch (error) {
        // Log error but don't crash, allow fallback to other methods
        console.warn('BnF SPARQL search failed or timed out:', error.message);
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

        // 1. Try BnF SPARQL (Highest quality for French works)
        const bnfSparqlResult = await searchBnFSparql(entry.title, entry.author);
        if (bnfSparqlResult && bnfSparqlResult.confidence >= 70) {
            bestResult = bnfSparqlResult;
        }

        // 2. Try HAL (Best for French academic papers)
        if (!bestResult || bestResult.confidence < 80) {
            const halResult = await searchHAL(entry.title, entry.author);
            if (halResult && (!bestResult || halResult.confidence > bestResult.confidence)) {
                bestResult = halResult;
            }
        }

        // 3. Try BnF SRU (Fallback for books if SPARQL missed)
        if (!bestResult || bestResult.confidence < 70) {
            await new Promise(resolve => setTimeout(resolve, 200));
            const bnfResult = await searchBnF(entry.title, entry.author);

            if (bnfResult && (!bestResult || bnfResult.confidence > bestResult.confidence)) {
                bestResult = bnfResult;
            }
        }

        // 4. Try OpenLibrary (General books)
        if (!bestResult || bestResult.confidence < 70) {
            await new Promise(resolve => setTimeout(resolve, 200));
            const openLibResult = await searchOpenLibrary(entry.title, entry.author);

            if (openLibResult && (!bestResult || openLibResult.confidence > bestResult.confidence)) {
                bestResult = openLibResult;
            }
        }

        // 5. Try CrossRef (Articles)
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

