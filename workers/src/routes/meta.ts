import { Hono } from 'hono';
import type { Env } from '../types';

const app = new Hono<{ Bindings: Env }>();

// GET /api/meta/categories - Hardcoded fallback
app.get('/categories', async (c) => {
  return c.json([
    { id: 'entertainment', name: 'Entertainment' },
    { id: 'news', name: 'News' },
    { id: 'sports', name: 'Sports' },
    { id: 'movies', name: 'Movies' },
    { id: 'music', name: 'Music' },
    { id: 'documentary', name: 'Documentary' },
    { id: 'kids', name: 'Kids' },
    { id: 'education', name: 'Education' },
  ]);
});

// GET /api/meta/countries - Hardcoded fallback
app.get('/countries', async (c) => {
  return c.json([
    { code: 'US', name: 'United States', flag: '🇺🇸' },
    { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
    { code: 'ES', name: 'Spain', flag: '🇪🇸' },
    { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
    { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
    { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
    { code: 'CL', name: 'Chile', flag: '🇨🇱' },
    { code: 'PE', name: 'Peru', flag: '🇵🇪' },
  ]);
});

// GET /api/meta/languages - Hardcoded fallback
app.get('/languages', async (c) => {
  return c.json([
    { code: 'eng', name: 'English' },
    { code: 'spa', name: 'Spanish' },
    { code: 'por', name: 'Portuguese' },
    { code: 'fra', name: 'French' },
    { code: 'deu', name: 'German' },
    { code: 'ita', name: 'Italian' },
  ]);
});

export default app;
