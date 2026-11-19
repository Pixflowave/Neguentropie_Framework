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
 * Ressemblance (0-100) entre le titre cité et le titre trouvé dans un
 * catalogue, qui tolère un sous-titre ou un tome présent d'un seul côté :
 * « La Société automatique. Tome I : L'Avenir du travail » et
 * « La société automatique » valent 100. Le titre complet compte aussi.
 */
export function similariteTitres(cite, trouve) {
    if (!cite || !trouve) return 0;
    const principal = (t) => normaliserTexte(cleanTitle(t).split(/\s*[.:;,]\s/)[0]);
    const pc = principal(cite);
    const pt = principal(trouve);
    let score = calculateSimilarity(cite, trouve);
    score = Math.max(score, calculateSimilarity(pc, pt));
    // l'un commence par l'autre (au moins deux mots) : « La gouvernance par
    // les nombres, cours au Collège de France » / « La gouvernance par les nombres »
    const [court, long] = pc.length <= pt.length ? [pc, pt] : [pt, pc];
    if (court.split(' ').length >= 2 && long.startsWith(court + ' ')) score = Math.max(score, 90);
    // tomes différents (« Tome II » / « . 1 ») : pas la même œuvre
    const tc = numeroTome(cite);
    const tt = numeroTome(trouve);
    if (tc && tt && tc !== tt) score = Math.min(score, 50);
    return score;
}

const ROMAINS = {I: 1, V: 5, X: 10};
/** Numéro de tome ou de volume d'un titre (« Tome II », « vol. 3 », « . 1, »), ou null. */
export function numeroTome(titre) {
    const m = String(titre).match(/(?:\b(?:[Tt]ome|[Tt]\.|[Vv]ol\.?|[Vv]olume|[Ll]ivre)\s*|\.\s+)([IVX]{1,4}|\d{1,2})(?=\b|$)/);
    if (!m) return null;
    if (/^\d+$/.test(m[1])) return Number(m[1]);
    let n = 0;
    for (let i = 0; i < m[1].length; i++) {
        const v = ROMAINS[m[1][i]], suivant = ROMAINS[m[1][i + 1]] || 0;
        n += v < suivant ? -v : v;
    }
    return n;
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
 * Simplifie un titre pour l'envoyer aux catalogues : retire le nom d'auteur,
 * le sous-titre, les parenthèses, les tomes, les prix… Ne sert qu'aux
 * requêtes et aux comparaisons : pour nommer un nœud du graphe, utiliser
 * retirerAuteurDuTitre, qui garde le titre complet.
 */
export function cleanTitle(title, authorName = null) {
    if (!title) return '';
    return simplifierPourRecherche(retirerAuteurDuTitre(title, authorName));
}

/**
 * Normalise les espaces, supprime une répétition « A. A » et retire le nom
 * de l'auteur collé au titre (« Arendt, Condition de l'homme moderne » ou
 * « Condition de l'homme moderne, Hannah Arendt »). Garde le sous-titre et
 * le numéro de tome.
 */
export function retirerAuteurDuTitre(title, authorName = null) {
    if (!title) return '';

    let cleaned = String(title);

    // NORMALIZE WHITESPACE: Fix double spaces which mess up splitting
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // 0. REPETITION FIX CHECK
    // Basic check: "A . A"
    const lower = cleaned.toLowerCase();
    // Split by period, optional space
    const parts = lower.split('.').map(p => p.trim()).filter(p => p);
    // If exactly 2 parts and they are identical (ignoring case)
    if (parts.length === 2 && parts[0] === parts[1]) {
        // It's a repetition!
        // Return just the first part (preserving original case)
        // We need to find the split point in the original string.
        const originalParts = cleaned.split('.');
        if (originalParts.length >= 2) {
            return originalParts[0].trim();
        }
    }

    // 1. Remove Author Name (Prefix or Suffix/Middle)
    if (authorName) {
        const normTitle = cleaned.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        // Prepare author variants
        const variants = [];

        // Normalize input to array
        const candidates = Array.isArray(authorName) ? authorName : [authorName];

        candidates.forEach(cand => {
            if (!cand) return;

            if (typeof cand === 'object') {
                const family = cand.family ? cand.family.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
                const given = cand.given ? cand.given.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";

                if (family) {
                    variants.push(family);
                    if (given) {
                        variants.push(`${given} ${family}`);
                        variants.push(`${family} ${given}`);
                        variants.push(`${given.charAt(0)} ${family}`);
                        variants.push(`${given.charAt(0)}. ${family}`);
                    }
                }
            } else if (typeof cand === 'string') {
                const normAuth = cand.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                // Add full string
                variants.push(normAuth);

                // If string looks like "Last, First", try to flip it too?
                if (normAuth.includes(',')) {
                    const parts = normAuth.split(',');
                    if (parts.length === 2) {
                        variants.push(`${parts[1].trim()} ${parts[0].trim()}`);
                    }
                }
            }
        });

        // Check for author variant presence
        for (const variant of variants) {
            if (!variant || variant.length < 3) continue; // Skip too short variants to avoid false positives

            const index = normTitle.indexOf(variant);
            if (index !== -1) {
                // CASE 1: Prefix (Starts with Author)
                if (index < 5) {
                    // Look for cut point after the matched name
                    // Use variant length to estimate position in non-normalized string
                    const endOfMatch = index + variant.length;

                    // Find separator after match
                    // We check multiple separators: comma, dash, period
                    // And ensure we don't cut in the middle of a word if variant matched partially (unlikely with spaces)

                    const suffix = cleaned.substring(endOfMatch);
                    // Check if suffix starts with a separator
                    const separatorMatch = suffix.match(/^[\s,.\/:-]+/);

                    if (separatorMatch) {
                        // Cut everything up to the end of separator
                        cleaned = suffix.substring(separatorMatch[0].length).trim();
                        break;
                    }
                }

                // CASE 2: Suffix / Middle (Title by Author...)
                // "Title, Author" or "Title, Author, Publisher"
                else {
                    // Check context BEFORE the author
                    // We want to cut at the separator closest to the left of the author

                    // Look at char before the match
                    // In normalized matches, indices map poorly if special chars exist, but usually 1-1 for standard text.
                    // Let's rely on substring extraction.

                    // Extract text BEFORE the match estimate
                    let prefixStr = cleaned.substring(0, index);

                    // Check if it ends with a separator pattern
                    // e.g. "Title, " or "Title - " or "Title. "
                    // We use a regex looking for separator + spaces at end of string
                    let matchSep = prefixStr.match(/[,.\/-]\s*$/);

                    // NEW: Feature to handle "Evgeny Morozov" when we only know "Morozov"
                    // If no separator found immediately, look back for a First Name?
                    if (!matchSep && index > 3) {
                        // Check previous word
                        const trimmedPrefix = prefixStr.trimEnd();
                        const lastSpaceIndex = trimmedPrefix.lastIndexOf(' ');

                        if (lastSpaceIndex !== -1) {
                            const word = trimmedPrefix.substring(lastSpaceIndex + 1);
                            // Check if Word is Capitalized and alphanumeric (simple check on original string if possible,
                            // but we are working with `prefixStr` which comes from `cleaned` which preserves case!)

                            // `cleaned` preserves case. `normTitle` was lowercased.
                            // So `prefixStr` has original case.

                            if (/^[A-Z][a-z\u00C0-\u00FF]+$/.test(word)) {
                                // Check stopwords to avoid "The Morozov" or "Le Morozov"
                                const stopwords = ['The', 'Le', 'La', 'Les', 'Des', 'Un', 'Une', 'Of', 'De', 'Du', 'By', 'Par'];
                                if (!stopwords.includes(word)) {
                                    // Assume it's a first name.
                                    // Check separator before this word
                                    const newPrefix = trimmedPrefix.substring(0, lastSpaceIndex + 1); // keep trailing space
                                    if (newPrefix.match(/[,.\/-]\s*$/)) {
                                        // Separator found before [FirstName]!
                                        // Update prefixStr to match the cut point before the First Name
                                        matchSep = true;
                                        prefixStr = newPrefix;
                                    }
                                }
                            }
                        }
                    }

                    if (matchSep) {
                        // Separator found!
                        // "Condition de l'homme moderne, Hannah Arendt"
                        // prefixStr = "Condition de l'homme moderne, "

                        // Verify this is a whole word match for the author?
                        // Check if char AFTER variant is end of string or separator
                        const charAfter = normTitle[index + variant.length];
                        const isEndOrSep = !charAfter || /[\s,.\/-]/.test(charAfter);

                        if (isEndOrSep) {
                            // Safe to cut
                            // Keep only the part BEFORE the separator
                            cleaned = prefixStr.replace(/[,.\/-]\s*$/, "").trim();
                            break;
                        }
                    }
                }
            }
        }
    }

    return cleaned.trim();
}

function simplifierPourRecherche(cleaned) {
    // 2. Remove standard suffixes

    // Remove subtitle (text after : or . or - if surrounded by spaces)
    cleaned = cleaned.split(':')[0];

    // Split by " - " (dash with spaces)
    cleaned = cleaned.split(' - ')[0];

    // Remove suffix starting with " /" (responsibility statement)
    cleaned = cleaned.split(' / ')[0];

    // Remove suffix starting with ". - " (library separator)
    cleaned = cleaned.split('. - ')[0];

    // Remove collection info often like ", « Le Débat »"
    if (cleaned.includes(', «')) {
        cleaned = cleaned.split(', «')[0];
    }

    // 3. Remove metadata suffixes (Pages, Price, Publisher, Date)
    // Example: ", 2021, 160 pages, 13,50 €"
    // Regex matches ", 1999" or ", 160 p." at the end
    cleaned = cleaned.replace(/,\s*\d{4}.*$/, ''); // Remove ", 2021..."
    cleaned = cleaned.replace(/,\s*\d+\s*p(?:ages?)?.*$/i, ''); // Remove ", 160 pages..."
    cleaned = cleaned.replace(/,\s*\d+(?:,\d+)?\s*€.*$/i, ''); // Remove ", 13,50 €"

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
        const similarity = similariteTitres(title, bestMatch.title || '');

        return {
            title: bestMatch.title,
            author: bestMatch.author_name?.join(", ") || "",
            year: bestMatch.first_publish_year,
            isbn: bestMatch.isbn?.[0],
            publisher: bestMatch.publisher?.[0],
            url: bestMatch.key ? `https://openlibrary.org${bestMatch.key}` : '',
            confidence: similarity,
            source: 'OpenLibrary',
            found: true
        };
    } catch (error) {
        // console.warn('OpenLibrary search error (handled):', error.message);
        return null;
    }
}

/**
 * Search CrossRef for academic articles
 */
export async function searchCrossRef(title, author) {
    try {
        const cleanedTitle = cleanTitle(title);
        let query = cleanedTitle;
        if (author) {
            const lastName = extractLastName(author);
            query += ` ${lastName}`;
        }

        const url = `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(query)}&rows=3`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (!data.message?.items || data.message.items.length === 0) {
            return null;
        }

        const bestMatch = data.message.items[0];
        const matchTitle = bestMatch.title?.[0] || '';
        const similarity = similariteTitres(title, matchTitle);

        // Extract authors
        const authorStr = bestMatch.author?.map(a => `${a.given || ''} ${a.family || ''}`).join(', ') || '';

        return {
            title: matchTitle,
            author: authorStr,
            year: bestMatch.published?.['date-parts']?.[0]?.[0] || bestMatch.created?.['date-parts']?.[0]?.[0],
            doi: bestMatch.DOI,
            journal: bestMatch['container-title']?.[0],
            url: bestMatch.URL || `https://doi.org/${bestMatch.DOI}`,
            confidence: similarity,
            source: 'CrossRef',
            found: true
        };
    } catch (error) {
        // console.warn('CrossRef search error (handled):', error.message);
        return null;
    }
}

/**
 * Search OpenAlex for academic works
 * OpenAlex is a free, open catalog of the global research system
 */
export async function searchOpenAlex(title, author) {
    try {
        const cleanedTitle = cleanTitle(title);
        let query = cleanedTitle;
        if (author) {
            const lastName = extractLastName(author);
            query += ` ${lastName}`;
        }

        // OpenAlex API - polite pool (add email for better rate limits)
        const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per_page=3`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (!data.results || data.results.length === 0) {
            return null;
        }

        const bestMatch = data.results[0];
        const matchTitle = bestMatch.title || '';
        const similarity = similariteTitres(title, matchTitle);

        // Extract authors
        const authorStr = bestMatch.authorships?.map(a => a.author?.display_name).filter(Boolean).join(', ') || '';

        return {
            title: matchTitle,
            author: authorStr,
            year: bestMatch.publication_year,
            doi: bestMatch.doi?.replace('https://doi.org/', ''),
            journal: bestMatch.primary_location?.source?.display_name,
            url: bestMatch.doi || bestMatch.id,
            openAccess: bestMatch.open_access?.is_oa,
            openAccessUrl: bestMatch.open_access?.oa_url,
            citedByCount: bestMatch.cited_by_count,
            confidence: similarity,
            source: 'OpenAlex',
            found: true
        };
    } catch (error) {
        // Silently handle errors - fallback to other sources
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
        const similarity = similariteTitres(title, matchTitle);

        // Extract author name
        const authorName = bestMatch.authFullName_s?.join(", ") || "";

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
 * Clean author name from BnF qualifiers
 * Removes patterns like ". Auteur du texte ", ". Éditeur scientifique ", etc.
 */
function cleanAuthorName(name) {
    if (!name) return name;

    // BnF returns names in format: "Nom, Prénom (dates). Auteur du texte"
    // We want to extract: "Nom, Prénom"

    // First, remove the dates in parentheses: (1980-....) or (1965-....)
    let cleaned = name.replace(/\s*\([0-9\-\.]+\)/g, '');

    // Then remove BnF qualifiers (can be at end or in middle)
    // Pattern: ". Qualifier" or ". Qualifier " where Qualifier can be:
    // - Auteur du texte
    // - Éditeur scientifique
    // - Traducteur
    // - Directeur de publication
    // etc.
    // Use word boundary or end of string to match
    cleaned = cleaned.replace(/\.\s+(Auteur du texte|Éditeur scientifique|Traducteur|Directeur de publication|Préfacier|Illustrateur|Compilateur|Compositeur)(\s+|$)/gi, '');

    // Normalize spaces and trim
    cleaned = cleaned.replace(/\s+/g, ' ').trim();


    return cleaned;
}

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

        const similarity = similariteTitres(title, matchTitle);

        // Clean the record identifier - it might already contain ark:/12148/
        let recordId = bestRecord.getElementsByTagName("srw:recordIdentifier")[0]?.textContent || '';


        // Remove ark:/12148/ prefix if it exists (we'll add it back)
        recordId = recordId.replace(/^ark:\/12148\//, '');


        const bnfUrl = `https://catalogue.bnf.fr/ark:/12148/${recordId}`;


        return {
            title: matchTitle,
            author: cleanAuthorName(matchCreator) || "",
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

// Mots vides ignorés dans la recherche plein texte de data.bnf.fr
const MOTS_VIDES = new Set([
    "les", "des", "une", "aux", "par", "pour", "dans", "sur", "avec", "sans", "sous", "vers", "entre", "comme", "est",
    "que", "qui", "quoi", "son", "ses", "leur", "leurs", "nos", "vos", "the", "and", "for", "with", "from", "into", "that", "this"
]);

/**
 * Requête SPARQL pour data.bnf.fr, ou null si le titre ou l'auteur manque.
 * Recherche par mots (accents gardés : « societe » ne trouve pas
 * « société »), réunis par AND, et auteur par nom de famille. Les mots ne
 * contiennent que des lettres : ni apostrophe ni guillemet ne peuvent
 * casser la requête (« L'obsolescence » faisait une erreur 500).
 * Exportée pour les tests.
 */
export function requeteSparqlBnF(title, author) {
    // Titre principal seulement : un sous-titre ou un tome ajoute des mots
    // absents du titre de l'œuvre à la BnF (« Essai sur le don. Forme et… »).
    const principal = cleanTitle(title).split(/\s*[.:;]\s/)[0];
    // Mots précédés d'une apostrophe ignorés : data.bnf.fr indexe
    // « l'homme » d'un bloc, « homme » ne le trouve pas.
    const candidats = principal.toLowerCase().split(/\s+/).filter((m) => !/['’]/.test(m)).join(' ');
    const mots = [...new Set((candidats.match(/\p{L}{3,}/gu) || []).filter((m) => !MOTS_VIDES.has(m)))]
        .sort((x, y) => y.length - x.length)
        .slice(0, 6);
    const nom = (extractLastName(author).match(/\p{L}[\p{L}-]*/gu) || []).pop();
    if (!mots.length || !nom) return null;
    const recherche = mots.map((m) => `"${m}"`).join(" AND ");
    return `PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
SELECT DISTINCT ?work ?title ?family ?given ?date WHERE {
  ?work dcterms:title ?title .
  ?title bif:contains '${recherche}' .
  ?work dcterms:creator ?creator .
  ?creator foaf:familyName ?family .
  FILTER(LCASE(STR(?family)) = "${nom.toLowerCase()}")
  OPTIONAL { ?creator foaf:givenName ?given }
  OPTIONAL { ?work dcterms:date ?date }
} LIMIT 5`;
}

/**
 * Search BnF via SPARQL endpoint (data.bnf.fr)
 * La couverture des œuvres y est partielle : le catalogue (SRU) prend le
 * relais quand rien n'est trouvé.
 */
export async function searchBnFSparql(title, author) {
    const query = requeteSparqlBnF(title, author);
    if (!query) return null;
    const arret = new AbortController();
    const minuteur = setTimeout(() => arret.abort(), 8000);
    try {
        const url = `https://data.bnf.fr/sparql?query=${encodeURIComponent(query)}&format=json`;
        const response = await fetch(url, {signal: arret.signal});
        if (!response.ok) return null;
        const data = await response.json();

        let bestMatch = null;
        for (const result of data.results?.bindings || []) {
            const resultTitle = result.title.value;
            const similarity = similariteTitres(title, resultTitle);
            if (bestMatch && similarity <= bestMatch.confidence) continue;
            // Adresse en https, sans préfixe ARK en double ni fragment « #about »
            const workUrl = result.work.value
                .replace(/^http:/, 'https:')
                .replace(/(ark:\/12148\/)+/g, 'ark:/12148/')
                .replace(/#about$/, '');
            bestMatch = {
                title: resultTitle,
                author: [result.given?.value, result.family.value].filter(Boolean).join(' '),
                year: result.date?.value,
                url: workUrl,
                confidence: similarity,
                source: 'BnF (SPARQL)',
                found: true
            };
        }
        return bestMatch;
    } catch (error) {
        return null; // délai dépassé ou service indisponible : le catalogue SRU prend le relais
    } finally {
        clearTimeout(minuteur);
    }
}

/**
 * Verify and enrich a list of bibliography entries
 */
/**
 * Verify a single bibliography entry
 */
/**
 * Texte sans accents, sans ponctuation, en minuscules.
 */
export function normaliserTexte(s) {
    return String(s ?? '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
}

/**
 * Le nom de famille de l'auteur d'origine figure-t-il parmi les auteurs
 * trouvés ? true / false, ou null quand on ne peut pas le savoir (pas
 * d'auteur d'origine, ou nom trop court).
 */
export function auteurCorrespond(auteurOriginal, auteurTrouve) {
    if (!auteurOriginal) return null;
    // Dernier mot du nom : « de Beauvoir » → « beauvoir », que le catalogue
    // écrive « Simone de Beauvoir » ou « Beauvoir, Simone de ».
    const nom = normaliserTexte(extractLastName(auteurOriginal)).split(' ').pop();
    if (!nom || nom.length < 2) return null;
    if (!auteurTrouve) return null;
    return ` ${normaliserTexte(auteurTrouve)} `.includes(` ${nom} `);
}

// Catalogues interrogés dans l'ordre. On passe au suivant tant qu'aucun
// résultat n'atteint le seuil.
const CATALOGUES = [
    [searchBnFSparql, 70],   // BnF (data.bnf.fr) : livres en français
    [searchHAL, 80],         // HAL : articles scientifiques français
    [searchBnF, 70],         // BnF (catalogue, SRU)
    [searchOpenLibrary, 70], // livres
    [searchCrossRef, 70],    // articles (DOI)
    [searchOpenAlex, 70]     // tout le reste
];

/**
 * Verify a single bibliography entry
 *
 * La confiance ne mesure que la ressemblance des titres. Un résultat dont
 * l'auteur ne correspond pas n'est jamais retenu comme vérifié : il n'est
 * gardé, au statut « uncertain », que si rien d'autre n'a été trouvé.
 */
export async function verifyEntry(entry) {
    let bestResult = null;   // meilleur résultat dont l'auteur n'est pas contredit
    let autreAuteur = null;  // meilleur résultat dont l'auteur diffère

    for (const [chercher, seuil] of CATALOGUES) {
        if (bestResult && bestResult.confidence >= seuil) continue;
        const result = await chercher(entry.title, entry.author);
        if (!result) continue;
        result.authorMatch = auteurCorrespond(entry.author, result.author);
        if (result.authorMatch === false) {
            if (!autreAuteur || result.confidence > autreAuteur.confidence) autreAuteur = result;
        } else if (!bestResult || result.confidence > bestResult.confidence) {
            bestResult = result;
        }
    }

    const verified = bestResult || autreAuteur;
    let status = 'not_found';
    if (bestResult && bestResult.confidence >= 70) status = 'verified';
    else if (verified) status = 'uncertain';

    return { original: entry, verified, status };
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

        const result = await verifyEntry(entry);
        results.push(result);
    }

    return results;
}



