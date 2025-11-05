/**
 * STANDALONE MIGRATION RUNNER
 *
 * Cara pakai:
 * 1. npx tsx scripts/runMigrationStandalone.ts preview  -> Lihat perubahan
 * 2. npx tsx scripts/runMigrationStandalone.ts run      -> Jalankan migration
 */

import { migrateAllProducts, previewMigration } from './migrateProductsStandalone';

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
        console.log('  npx tsx scripts/runMigrationStandalone.ts preview  - Preview migration changes');
        console.log('  npx tsx scripts/runMigrationStandalone.ts run      - Run the migration');
        console.log('\n⚠️ Always run preview first before running migration!');
        break;
    }

  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

main();