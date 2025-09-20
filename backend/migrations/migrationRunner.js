// migrations/migrationRunner.js
const fs = require('fs');
const path = require('path');
const db = require('../src/db');

// Load environment variables
require('dotenv').config();

class MigrationRunner {
  constructor() {
    this.migrationsDir = __dirname;
  }

  async runMigrations() {
    console.log('Checking for pending migrations...');
    
    try {
      // Ensure migration tracking table exists
      await this.ensureMigrationTable();
      
      // Get all migration files
      const migrationFiles = this.getMigrationFiles();
      
      // Get applied migrations from database
      const appliedMigrations = await this.getAppliedMigrations();
      
      // Find pending migrations
      const pendingMigrations = migrationFiles.filter(file => 
        !appliedMigrations.includes(file.version)
      );
      
      if (pendingMigrations.length === 0) {
        console.log('All migrations are up to date');
        return;
      }
      
      console.log(`Found ${pendingMigrations.length} pending migration(s)`);
      
      // Run pending migrations in order
      for (const migration of pendingMigrations) {
        await this.runMigration(migration);
      }
      
      console.log('All migrations completed successfully');
      
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }

  async ensureMigrationTable() {
    // Check if schema_migrations table exists
    const tableExists = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'schema_migrations'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('Creating migration tracking table...');
      const migrationSystemSql = fs.readFileSync(
        path.join(this.migrationsDir, '000_migration_system.sql'), 
        'utf8'
      );
      await db.query(migrationSystemSql);
    }
  }

  getMigrationFiles() {
    const files = fs.readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.sql') && file !== '000_migration_system.sql')
      .map(file => {
        const version = file.replace('.sql', '');
        const description = this.extractDescription(file);
        return {
          version,
          filename: file,
          description,
          filepath: path.join(this.migrationsDir, file)
        };
      })
      .sort((a, b) => a.version.localeCompare(b.version));
    
    return files;
  }

  extractDescription(filename) {
    const filepath = path.join(this.migrationsDir, filename);
    const content = fs.readFileSync(filepath, 'utf8');
    
    // Look for description in the first few lines of comments
    const lines = content.split('\n').slice(0, 10);
    for (const line of lines) {
      const match = line.match(/-- Description: (.+)/i);
      if (match) {
        return match[1].trim();
      }
    }
    
    // Fallback to filename-based description
    return filename.replace(/^\d+_/, '').replace('.sql', '').replace(/_/g, ' ');
  }

  async getAppliedMigrations() {
    try {
      const result = await db.query('SELECT version FROM schema_migrations ORDER BY version');
      return result.rows.map(row => row.version);
    } catch (error) {
      // If table doesn't exist, return empty array
      return [];
    }
  }

  async runMigration(migration) {
    console.log(`Running migration: ${migration.version} - ${migration.description}`);
    
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Read migration SQL
      let sql = fs.readFileSync(migration.filepath, 'utf8');
      
      // Execute migration SQL (no environment variable substitution needed for hardcoded passwords)
      await client.query(sql);
      
      // Record migration as applied
      await client.query(
        'INSERT INTO schema_migrations (version, description) VALUES ($1, $2)',
        [migration.version, migration.description]
      );
      
      await client.query('COMMIT');
      console.log(`Migration ${migration.version} completed successfully`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Migration ${migration.version} failed:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  substituteEnvironmentVariables(sql) {
    // Replace ${VARIABLE_NAME} with process.env.VARIABLE_NAME
    return sql.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      const value = process.env[varName];
      if (value === undefined) {
        throw new Error(`Environment variable ${varName} is not defined`);
      }
      return value;
    });
  }

}

module.exports = MigrationRunner;
