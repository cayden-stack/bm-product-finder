import { createClient } from '@supabase/supabase-js';

// Initialize the Supabase Admin Client
// We use the SERVICE_ROLE_KEY because this is the backend.
// This bypasses RLS (Row Level Security) so we can write to the DB freely.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(request, response) {
  // 1. Handle CORS (Allow your website to talk to this function)
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  // Temporary hardcoded User ID for testing
  const TEMP_USER_ID = '00000000-0000-0000-0000-000000000000';

  try {
    // --- HANDLE GET REQUEST (Fetch Favorites) ---
    if (request.method === 'GET') {
      const { data, error } = await supabase
        .from('favorites')
        .select('product_id, saved_at')
        .eq('user_id', TEMP_USER_ID)
        .order('saved_at', { ascending: false });

      if (error) throw error;

      return response.status(200).json({ favorites: data });
    }

    // --- HANDLE POST REQUEST (Add Favorite) ---
    if (request.method === 'POST') {
      const { product_id } = request.body;

      if (!product_id) {
        return response.status(400).json({ error: 'Missing product_id' });
      }

      // Using 'upsert' is safer than 'insert'—it won't crash if the favorite already exists
      const { data, error } = await supabase
        .from('favorites')
        .upsert({ 
            user_id: TEMP_USER_ID, 
            product_id: product_id, 
            saved_at: new Date().toISOString() 
        })
        .select();

      if (error) throw error;

      return response.status(201).json({ success: true, favorite: data[0] });
    }
    
    // --- HANDLE DELETE REQUEST (Remove Favorite) ---
    if (request.method === 'DELETE') {
        const { product_id } = request.body;

        const { error } = await supabase
            .from('favorites')
            .delete()
            .eq('user_id', TEMP_USER_ID)
            .eq('product_id', product_id);

        if (error) throw error;

        return response.status(200).json({ success: true });
    }

    return response.status(405).json({ error: 'Method Not Allowed' });

  } catch (error) {
    console.error('Supabase API Error:', error);
    return response.status(500).json({ error: error.message });
  }
}