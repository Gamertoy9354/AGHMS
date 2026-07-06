import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dnjmgxsvwmzeprginaeo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRuam1neHN2d216ZXByZ2luYWVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2Nzg3ODQsImV4cCI6MjA5NDI1NDc4NH0.RvrXN5zI9_TO1ze7oULMzFCigSWEjic-b0NpFSUKvMQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    // 1. Get an academic year
    const { data: years, error: yearErr } = await supabase
      .from('academic_years')
      .select('*')
      .limit(1);
      
    if (yearErr) {
      console.error('Error fetching academic years:', yearErr);
      return;
    }
    
    if (!years || years.length === 0) {
      console.log('No academic years found!');
      return;
    }
    
    const yearId = years[0].id;
    console.log('Using academic year ID:', yearId);

    // 2. Try inserting with a string week value
    const testEvent = {
      title: 'Test Multi-Week Event',
      type: 'academic',
      start_date: '2025-07-01',
      end_date: '2025-07-02',
      week: '1,2,3', // testing string / multi-week assignment
      semester_type: 'odd',
      academic_year_id: yearId
    };

    console.log('Attempting test insert with week="1,2,3"...');
    const { data: insertData, error: insertErr } = await supabase
      .from('academic_events')
      .insert(testEvent)
      .select();

    if (insertErr) {
      console.log('Insert failed (expected if week is integer):', insertErr.message);
      console.log('Full error details:', insertErr);
    } else {
      console.log('Insert succeeded! Table column is string/text compatible.', insertData);
      // Clean up test insertion
      const { error: deleteErr } = await supabase
        .from('academic_events')
        .delete()
        .eq('id', insertData[0].id);
      if (deleteErr) console.error('Cleanup failed:', deleteErr);
      else console.log('Cleanup completed successfully.');
    }
  } catch (err) {
    console.error('Execution error:', err);
  }
}

run();
