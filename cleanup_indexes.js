import sequelize from './src/config/db.js';

async function cleanup() {
  try {
    const [tables] = await sequelize.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = 'u689598822_spreadsheetdb'
    `);

    for (const { TABLE_NAME: table } of tables) {
      const [indexes] = await sequelize.query(`SHOW INDEX FROM \`${table}\``);
      const indexNames = indexes.map(i => i.Key_name);
      
      const toDrop = indexNames.filter(name => /_[0-9]+$/.test(name));
      
      for (let idx of toDrop) {
        try {
          await sequelize.query(`ALTER TABLE \`${table}\` DROP INDEX \`${idx}\``);
          console.log(`Dropped ${idx} from ${table}`);
        } catch (e) {
          console.error(`Failed to drop ${idx} from ${table}:`, e.message);
        }
      }
    }
    console.log("Global cleanup done.");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
cleanup();
