import { Pool } from 'pg';

const connectionString = `postgres://postgres.mikdpurvhpzjmzsfzyei:PZmwZlYKvTLO2TRt@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x`;

const pool = new Pool({
  connectionString,
  application_name: 'vercel-favorites-api',
  ssl: {
    rejectUnauthorized: false
  }
});

export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*'); 
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Content-Type', 'application/json');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  // Temporary User ID for testing the database connection
  // NOTE: REPLACE THIS WITH THE SECURE USER ID RETRIEVAL LATER
  const TEMP_USER_ID = '00000000-0000-0000-0000-000000000000';

  let client;
  try {
    client = await pool.connect();

    // --- HANDLE GET REQUEST (RETRIEVE FAVORITES) ---
    if (request.method === 'GET') {
      const result = await client.query(
        'SELECT product_id, saved_at FROM favorites WHERE user_id = $1 ORDER BY saved_at DESC',
        [TEMP_USER_ID]
      );
      
      return response.status(200).json({ favorites: result.rows });
    }

    // --- HANDLE POST REQUEST (ADD FAVORITE) ---
    if (request.method === 'POST') {
      const { product_id } = request.body;

      if (!product_id) {
        return response.status(400).json({ error: 'Missing product_id in request body.' });
      }

      // Insert or Update logic: Insert new favorite for the TEMP_USER_ID
      const result = await client.query(
        'INSERT INTO favorites (user_id, product_id, saved_at) VALUES ($1, $2, NOW()) RETURNING *',
        [TEMP_USER_ID, product_id]
      );

      return response.status(201).json({ success: true, favorite: result.rows[0] });
    }

    // Default response for unhandled method types
    return response.status(405).json({ error: 'Method Not Allowed' });

  } catch (error) {
    console.error('API Error:', error);
    return response.status(500).json({ error: 'Database operation failed.', details: error.message });
  } finally {
    if (client) {
      client.release();
    }
  }
}