import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(request, response) {

  const { data, error } = await supabase
    .from('recents')
    .select('id')
    .limit(1);

  if (error) {
    return response.status(500).json({ error: error.message });
  }

  return response.status(200).json({ message: 'Pong! Database is awake.' });
}