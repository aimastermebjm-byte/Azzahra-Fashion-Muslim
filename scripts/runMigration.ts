/**
 * MIGRATION RUNNER
 *
 * Cara pakai:
 * 1. npm run migration:preview  -> Lihat perubahan yang akan dilakukan
 * 2. npm run migration:run      -> Jalankan migration
 */

// Load environment variables
import { config } from 'dotenv';
config({ path: '.env.migration' });

import { migrateAllProducts, previewMigration } from './migrateProducts';

// Get command from process arguments
const command = process.argv[2];

async function main() {
  try {
    switch (command) {
      case 'preview':
        console.log('='.repeat(60));
        console.log('📋 MIGRATION PREVIEW');
        console.log('='.repeat(60));
        await previewMigration();
        break;

      case 'run':
        console.log('='.repeat(60));
        console.log('🚀 RUNNING MIGRATION');
        console.log('='.repeat(60));
        console.log('⚠️ WARNING: This will modify your Firestore data!');
        console.log('⏱️ You have 10 seconds to cancel (Ctrl+C)...\n');

        // Countdown for safety
        for (let i = 10; i > 0; i--) {
          console.log(`⏳ ${i}...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log('\n🔥 Starting migration...');
        const result = await migrateAllProducts();

        console.log('\n✅ Migration completed!');
        console.log(`📊 Summary: ${result.migratedCount} migrated, ${result.errorCount} errors`);
        break;

      default:
        console.log('❌ Invalid command!');
        console.log('\n📖 Usage:');
        console.log('  npm run migration:preview  - Preview migration changes');
        console.log('  npm run migration:run      - Run the migration');
        console.log('\n⚠️ Always run preview first before running migration!');
        break;
    }

  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

main();