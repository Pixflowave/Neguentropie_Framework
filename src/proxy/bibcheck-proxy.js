/**
 * Bibcheck Proxy Server
 * Contourne les restrictions CORS pour accéder à l'API INIST
 * 
 * Usage: node src/proxy/bibcheck-proxy.js
 * Le serveur écoute sur http://localhost:3001
 */

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

// Explicit CORS configuration for Observable dev server
const corsOptions = {
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
    credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'bibcheck-proxy' });
});

// Proxy endpoint for INIST Biblio-Ref
app.post('/v1/validate', async (req, res) => {
    const INIST_ENDPOINT = 'https://biblio-ref.services.istex.fr/v1/validate';

    try {
        console.log(`[Proxy] Forwarding ${req.body?.length || 0} entries to INIST...`);

        const response = await fetch(INIST_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(req.body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Proxy] INIST returned ${response.status}: ${errorText}`);
            return res.status(response.status).json({ error: `INIST error: ${response.status}`, details: errorText });
        }

        const data = await response.json();
        console.log(`[Proxy] Success! Received ${data.length} results.`);
        res.json(data);

    } catch (error) {
        console.error('[Proxy] Request failed:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Bibcheck Proxy running at http://localhost:${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/health`);
    console.log(`   INIST proxy:  POST http://localhost:${PORT}/v1/validate`);
});
