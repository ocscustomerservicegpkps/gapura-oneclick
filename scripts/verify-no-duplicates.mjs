#!/usr/bin/env node

/**
 * Verify no duplicates in reports_sync table
 * Usage: node scripts/verify-no-duplicates.mjs
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  console.log('🔍 Checking for duplicates in reports_sync...\n');

  try {
    // Get total count
    const { count: total, error: countError } = await supabase
      .from('ground_handling_irregularity_report')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Error counting records:', countError);
      process.exit(1);
    }

    console.log(`📊 Total records: ${total}`);

    // Get all records to check for duplicates (handle pagination)
    let allRecords = [];
    let page = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data: records, error: fetchError } = await supabase
        .from('ground_handling_irregularity_report')
        .select('id, sheet_id')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (fetchError) {
        console.error('❌ Error fetching records:', fetchError);
        process.exit(1);
      }

      if (!records || records.length === 0) break;

      allRecords = allRecords.concat(records);
      page++;

      if (records.length < pageSize) break;
    }

    console.log(`📊 Fetched records: ${allRecords.length}`);

    // Check for duplicate sheet_ids
    const sheetIds = allRecords.map(r => r.sheet_id);
    const uniqueSheetIds = new Set(sheetIds);
    const duplicateSheetIds = sheetIds.length - uniqueSheetIds.size;

    // Check for duplicate ids
    const ids = allRecords.map(r => r.id);
    const uniqueIds = new Set(ids);
    const duplicateIds = ids.length - uniqueIds.size;

    console.log(`📊 Unique sheet_ids: ${uniqueSheetIds.size}`);
    console.log(`📊 Unique ids: ${uniqueIds.size}`);
    console.log(`📊 Duplicate sheet_ids: ${duplicateSheetIds}`);
    console.log(`📊 Duplicate ids: ${duplicateIds}`);
    console.log('');

    if (duplicateSheetIds === 0 && duplicateIds === 0) {
      console.log('✅ No duplicates found!');
      console.log('✅ Database integrity verified');
      process.exit(0);
    } else {
      console.error('❌ DUPLICATES FOUND!');
      
      if (duplicateSheetIds > 0) {
        console.error(`   - ${duplicateSheetIds} duplicate sheet_ids`);
        
        // Find which ones are duplicated
        const sheetIdCounts = {};
        sheetIds.forEach(id => {
          sheetIdCounts[id] = (sheetIdCounts[id] || 0) + 1;
        });
        
        const duplicated = Object.entries(sheetIdCounts)
          .filter(([, count]) => count > 1)
          .map(([id, count]) => `${id} (${count}x)`);
        
        console.error('   Duplicated sheet_ids:', duplicated.slice(0, 5).join(', '));
      }
      
      if (duplicateIds > 0) {
        console.error(`   - ${duplicateIds} duplicate ids`);
      }
      
      console.error('\n💡 Run this SQL to remove duplicates:');
      console.error('DELETE FROM reports_sync a');
      console.error('USING reports_sync b');
      console.error('WHERE a.id < b.id AND a.sheet_id = b.sheet_id;');
      
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

main();
