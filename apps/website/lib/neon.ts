import { Pool } from "pg";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    if (!process.env.NEON_DIRECT_URL) {
      throw new Error("NEON_DATABASE_URL is not set.");
    }
    pool = new Pool({
      connectionString: process.env.NEON_DIRECT_URL,
      max: 3,
    });
  }
  return pool;
}

export { getPool };

export async function runQuery<T>(query: string): Promise<T[]> {
  const client = await getPool().connect();
  try {
    const res = await client.query(query);
    return res.rows;
  } finally {
    client.release();
  }
}

export async function runSingleRowQuery<T>(query: string, params: any[]): Promise<T | null> {
  const client = await getPool().connect();
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
