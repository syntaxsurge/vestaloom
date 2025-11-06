import 'dotenv/config'

import { ensureQuestSchemas } from '@/lib/streams/register'

async function main() {
  const { questSchemaId, badgeSchemaId } = await ensureQuestSchemas()

  console.log('Somnia Data Streams ready')
  console.log('quest_progress schema:', questSchemaId)
  console.log('badge_mint schema:', badgeSchemaId)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
