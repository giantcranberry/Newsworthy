/**
 * One-time cleanup: reverse duplicate Purchase: brand_credits rows caused by
 * Flask + Next.js both handling payment_intent.succeeded.
 *
 * Default: dry-run (prints planned changes, writes nothing).
 * Apply:    bun scripts/cleanup-duplicate-purchase-credits.ts --apply
 *
 * Method: INSERT negative adjustment rows (ledger-safe). Does not DELETE
 * purchase history. Skips clawbacks that would drive a scope balance below 0
 * (duplicate already spent).
 *
 * Matching rule: same user_id, company_id, product_type, credits, notes
 * ("Purchase:…"), created within 2 seconds — keep the earlier row.
 *
 * Env: DATABASE_URL (or DIRECT_DATABASE_URL). Bun loads .env.local from repo root.
 */
import { SQL } from "bun";

const APPLY = process.argv.includes("--apply");

type PairRow = {
  keep_id: number;
  remove_id: number;
  user_id: number;
  company_id: number | null;
  dupe_credits: number;
  product_type: string;
  notes: string;
  keep_at: Date;
  remove_at: Date;
  email: string | null;
  company_name: string | null;
  current_balance: number;
};

type Planned = PairRow & {
  clawback_credits: number;
  balance_before: number;
  balance_after: number;
  action: "full" | "partial" | "skip_spent";
  adjustment_notes: string;
};

function getSql() {
  const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL or DIRECT_DATABASE_URL is not set");
  return new SQL(url);
}

async function loadPairs(sql: SQL): Promise<PairRow[]> {
  const rows = await sql`
    WITH purchase_credits AS (
      SELECT
        id, user_id, company_id, credits, product_type, notes, created_at,
        LAG(id) OVER (
          PARTITION BY user_id, credits, product_type, notes, COALESCE(company_id, -1)
          ORDER BY created_at, id
        ) AS prev_id,
        LAG(created_at) OVER (
          PARTITION BY user_id, credits, product_type, notes, COALESCE(company_id, -1)
          ORDER BY created_at, id
        ) AS prev_created_at
      FROM brand_credits
      WHERE credits > 0
        AND notes ILIKE 'Purchase:%'
    ),
    pairs AS (
      SELECT
        prev_id AS keep_id,
        id AS remove_id,
        user_id,
        company_id,
        credits AS dupe_credits,
        product_type,
        notes,
        prev_created_at AS keep_at,
        created_at AS remove_at
      FROM purchase_credits
      WHERE prev_id IS NOT NULL
        AND EXTRACT(EPOCH FROM (created_at - prev_created_at)) < 2
    ),
    balances AS (
      SELECT
        user_id,
        company_id,
        product_type,
        COALESCE(SUM(credits), 0) AS balance
      FROM brand_credits
      WHERE expires_at IS NULL OR expires_at > NOW()
      GROUP BY user_id, company_id, product_type
    )
    SELECT
      p.keep_id,
      p.remove_id,
      p.user_id,
      p.company_id,
      p.dupe_credits::int AS dupe_credits,
      p.product_type,
      p.notes,
      p.keep_at,
      p.remove_at,
      u.email,
      co.company_name,
      COALESCE(b.balance, 0)::int AS current_balance
    FROM pairs p
    LEFT JOIN balances b
      ON b.user_id = p.user_id
     AND b.product_type = p.product_type
     AND b.company_id IS NOT DISTINCT FROM p.company_id
    LEFT JOIN users u ON u.id = p.user_id
    LEFT JOIN company co ON co.id = p.company_id
    ORDER BY p.remove_at ASC
  `;

  return (rows as PairRow[]).map((r) => ({
    ...r,
    dupe_credits: Number(r.dupe_credits),
    current_balance: Number(r.current_balance),
  }));
}

function plan(pairs: PairRow[]): Planned[] {
  const byScope = new Map<string, number>();
  const planned: Planned[] = [];

  for (const p of pairs) {
    const key = `${p.user_id}|${p.company_id ?? "null"}|${p.product_type}`;
    if (!byScope.has(key)) byScope.set(key, p.current_balance);

    const balanceBefore = byScope.get(key)!;
    const clawback = Math.max(0, Math.min(p.dupe_credits, balanceBefore));
    const action =
      clawback === p.dupe_credits
        ? "full"
        : clawback > 0
          ? "partial"
          : "skip_spent";
    const balanceAfter = balanceBefore - clawback;
    byScope.set(key, balanceAfter);

    planned.push({
      ...p,
      clawback_credits: clawback,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      action,
      adjustment_notes: `Duplicate webhook correction (dup id=${p.remove_id}; keep id=${p.keep_id})`.slice(
        0,
        64,
      ),
    });
  }

  return planned;
}

function printPreview(planned: Planned[]) {
  const applyable = planned.filter((p) => p.clawback_credits > 0);
  const skipped = planned.filter((p) => p.action === "skip_spent");

  console.log("\n=== CLEANUP PREVIEW (no writes unless --apply) ===\n");
  console.log(
    JSON.stringify(
      {
        mode: APPLY ? "APPLY" : "DRY-RUN",
        pairs_found: planned.length,
        will_insert_adjustments: applyable.length,
        skipped_already_spent: skipped.length,
        credits_to_clawback: applyable.reduce(
          (s, p) => s + p.clawback_credits,
          0,
        ),
        duplicate_credits_already_spent: skipped.reduce(
          (s, p) => s + p.dupe_credits,
          0,
        ),
        method:
          "INSERT negative brand_credits rows. Keep original Purchase rows. No DELETEs.",
      },
      null,
      2,
    ),
  );

  console.log("\n--- Adjustments that would be inserted ---\n");
  console.log(
    "action".padEnd(12),
    "email".padEnd(34),
    "scope".padEnd(34),
    "type".padEnd(10),
    "claw".padStart(4),
    "balance".padStart(12),
    "dup_id",
  );
  for (const p of applyable) {
    const scope = p.company_id
      ? p.company_name || `company:${p.company_id}`
      : "(account)";
    console.log(
      p.action.padEnd(12),
      (p.email || "").slice(0, 33).padEnd(34),
      scope.slice(0, 33).padEnd(34),
      p.product_type.padEnd(10),
      String(p.clawback_credits).padStart(4),
      `${p.balance_before}->${p.balance_after}`.padStart(12),
      `${p.remove_id} (keep ${p.keep_id})`,
    );
  }

  if (skipped.length) {
    console.log("\n--- Skipped (duplicate already spent; balance 0) ---\n");
    for (const p of skipped) {
      const scope = p.company_id
        ? p.company_name || `company:${p.company_id}`
        : "(account)";
      console.log(
        `- ${p.email} | ${scope} | ${p.product_type} | +${p.dupe_credits} unrecoverable | dup id=${p.remove_id}`,
      );
    }
  }
}

async function apply(sql: SQL, planned: Planned[]) {
  const applyable = planned.filter((p) => p.clawback_credits > 0);

  await sql.begin(async (tx) => {
    for (const p of applyable) {
      const existing = await tx`
        SELECT id FROM brand_credits WHERE notes = ${p.adjustment_notes} LIMIT 1
      `;
      if (existing.length > 0) {
        console.log(`skip existing correction for dup id=${p.remove_id}`);
        continue;
      }

      await tx`
        INSERT INTO brand_credits (
          user_id, company_id, credits, product_type, notes, created_at
        ) VALUES (
          ${p.user_id},
          ${p.company_id},
          ${-p.clawback_credits},
          ${p.product_type},
          ${p.adjustment_notes},
          NOW()
        )
      `;
      console.log(
        `inserted -${p.clawback_credits} ${p.product_type} for user ${p.user_id} (${p.email})`,
      );
    }
  });

  console.log(`\nCommitted ${applyable.length} adjustment(s).`);
}

async function main() {
  const sql = getSql();
  const pairs = await loadPairs(sql);
  const planned = plan(pairs);
  printPreview(planned);

  if (!APPLY) {
    console.log(
      "\nDry-run only. Re-run with --apply to insert the negative adjustments.\n",
    );
    return;
  }

  console.log("\nApplying adjustments…\n");
  await apply(sql, planned);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
