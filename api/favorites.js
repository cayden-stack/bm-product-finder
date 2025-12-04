import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  let body = request.body;
  if (typeof body === 'string') {
    try {
        body = JSON.parse(body);
    } catch (e) {
    }
  }

  const authHeader = request.headers.authorization;
  if (!authHeader) {
      return response.status(401).json({ error: 'No authorization header' });
  }
  const token = authHeader.split(' ')[1]; 

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
      return response.status(401).json({ error: 'Invalid token' });
  }

  const userID = user.id;

  try {
    if (request.method === 'GET') {
      const { data, error } = await supabase
        .from('favorites')
        .select('product_id, saved_at')
        .eq('user_id', userID)
        .order('saved_at', { ascending: false });

      if (error) throw error;
      return response.status(200).json({ favorites: data });
    }

    if (request.method === 'POST') {
      const { product_id } = body;
      if (!product_id) return response.status(400).json({ error: 'Missing product_id' });

      const { data, error } = await supabase
        .from('favorites')
        .upsert({ 
            user_id: userID, 
            product_id: product_id, 
            saved_at: new Date().toISOString() 
        })
        .select();

      if (error) throw error;
      return response.status(201).json({ success: true, favorite: data[0] });
    }
    
    if (request.method === 'DELETE') {
        const { product_id } = body;
        const { error } = await supabase
            .from('favorites')
            .delete()
            .eq('user_id', userID)
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