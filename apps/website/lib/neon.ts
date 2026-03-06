import { Pool } from "pg";

if (!process.env.NEON_DIRECT_URL) {
  console.error("NEON_DATABASE_URL is not set.");
  process.exit(1); // Exit in case of missing environment variable
}

const pool = new Pool({
  connectionString: process.env.NEON_DIRECT_URL,
  max: 3,
});

export default pool;


export async function runQuery<T>(query: string): Promise<T[]> {
  const client = await pool.connect();
  try {
    const res = await client.query(query);
    return res.rows;
  } finally {
    client.release();
  }
}

export async function runSingleRowQuery<T>(query: string, params: any[]): Promise<T | null> {
  const client = await pool.connect();
  try {
    const res = await client.query(query, params);
    if (res.rows.length === 0) {
      return null;
    }
    return res.rows[0];
  } finally {
    client.release();
  }
}
