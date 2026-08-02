import { db } from '@/db'
import { appSettings } from '@/db/schema'
import { eq } from 'drizzle-orm'

// Grants one free 'pr' credit at registration while enabled. Defaults to ON
// when no row exists so the offer works before the setting is ever touched.
export const FREE_FIRST_PR_KEY = 'free_first_pr_enabled'

// Keys the admin settings API is allowed to write, with their code defaults.
export const BOOL_SETTING_DEFAULTS: Record<string, boolean> = {
  [FREE_FIRST_PR_KEY]: true,
}

export async function getBoolSetting(key: string, defaultValue: boolean): Promise<boolean> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, key))
    .limit(1)
  if (!row) return defaultValue
  return row.value === 'true'
}

export async function setSetting(key: string, value: string, updatedBy?: number): Promise<void> {
  const [existing] = await db
    .select({ id: appSettings.id })
    .from(appSettings)
    .where(eq(appSettings.key, key))
    .limit(1)

  if (existing) {
    await db
      .update(appSettings)
      .set({ value, updatedBy: updatedBy ?? null, updatedAt: new Date() })
      .where(eq(appSettings.id, existing.id))
  } else {
    await db.insert(appSettings).values({ key, value, updatedBy: updatedBy ?? null })
  }
}
