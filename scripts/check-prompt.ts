import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // Check prompt_sets
  const { data: sets, error: setsError } = await supabase
    .from('prompt_sets')
    .select('id, slug, name')
    .eq('slug', 'search_chat');

  console.log('Prompt sets:', JSON.stringify(sets, null, 2), setsError?.message || '');

  if (sets && sets.length > 0) {
    // Check prompt_versions for this set with ai_models join
    const { data: versions, error: versionsError } = await supabase
      .from('prompt_versions')
      .select(`
        id,
        status,
        model_id,
        ai_models (
          model_id,
          provider,
          display_name
        )
      `)
      .eq('prompt_set_id', sets[0].id)
      .eq('status', 'active');

    console.log('Versions with model info:', JSON.stringify(versions, null, 2), versionsError?.message || '');
  }
}

check().catch(console.error);
