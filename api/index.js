const express = require('express');
const { Pool } = require('pg');
const { createClient } = require('redis');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const redisClient = createClient({
  url: process.env.REDIS_URL,
});
redisClient.connect();

// Creating short link
app.post('/api/shorten', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'url is required' });
  }

  const shortCode = crypto.randomBytes(4).toString('hex');

  await pool.query(
    'INSERT INTO links (short_code, original_url) VALUES ($1, $2)',
    [shortCode, url]
  );

  res.json({ shortCode, shortUrl: `http://localhost:3000/${shortCode}` });
});

// Redirect by short link
app.get('/:shortCode', async (req, res) => {
  const { shortCode } = req.params;

  const cached = await redisClient.get(shortCode);
  if (cached) {
    return res.redirect(cached);
  }

  const result = await pool.query(
    'SELECT original_url FROM links WHERE short_code = $1',
    [shortCode]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'not found' });
  }

  const originalUrl = result.rows[0].original_url;
  await redisClient.set(shortCode, originalUrl, { EX: 3600 });

  res.redirect(originalUrl);
});

app.listen(3000, () => console.log('API running on port 3000'));