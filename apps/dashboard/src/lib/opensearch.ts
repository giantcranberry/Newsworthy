import { Client } from '@opensearch-project/opensearch'

let client: Client | null = null

function getClient(): Client {
  if (!client) {
    const host = process.env.OPENSEARCH_HOST
    const user = process.env.OPENSEARCH_USER
    const pass = process.env.OPENSEARCH_PASSWORD

    if (!host || !user || !pass) {
      throw new Error('Missing OPENSEARCH_HOST, OPENSEARCH_USER, or OPENSEARCH_PASSWORD env vars')
    }

    client = new Client({
      node: host,
      auth: { username: user, password: pass },
      ssl: { rejectUnauthorized: false },
    })
  }
  return client
}

export async function queryIndex(index: string, query: Record<string, unknown>): Promise<any> {
  const os = getClient()
  const result = await os.search({ index, body: query })
  return result.body
}

export async function deleteDocument(index: string, documentId: string): Promise<any> {
  const os = getClient()
  const result = await os.delete({ index, id: documentId })
  return result.body
}
