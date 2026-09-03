const db = require('../db');

/**
 * Run relational work on one PostgreSQL connection and keep the transaction
 * boundary in one place. Network calls must happen before or after this
 * helper, never from inside the callback.
 */
async function withTransaction(work) {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Transaction rollback failed:', rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { withTransaction };
