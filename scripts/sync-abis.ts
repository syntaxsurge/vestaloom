import { readdir, mkdir, copyFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const CONTRACT_NAMES = [
  'Badge1155',
  'MembershipMarketplace',
  'MembershipPass1155',
  'Registrar',
  'RevenueSplitRouter',
  'SplitPayout',
  'VestaBadge',
  'VestaQuest'
]

async function main(): Promise<void> {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  const root = path.resolve(__dirname, '..')

  const artifactsDir = path.join(root, 'blockchain', 'artifacts', 'contracts')
  const targetDir = path.join(root, 'src', 'lib', 'onchain', 'abi', 'artifacts')

  await mkdir(targetDir, { recursive: true })

  async function traverse(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        await traverse(fullPath)
        continue
      }

      if (
        entry.isFile() &&
        entry.name.endsWith('.json') &&
        !entry.name.endsWith('.dbg.json') &&
        CONTRACT_NAMES.some(contractName => entry.name.startsWith(contractName))
      ) {
        const destPath = path.join(targetDir, entry.name)
        await copyFile(fullPath, destPath)
        console.log(
          `✔  ${path.relative(root, fullPath)} → ${path.relative(root, destPath)}`
        )
      }
    }
  }

  try {
    await traverse(artifactsDir)
    console.log('✅  ABI sync complete')
  } catch (error) {
    console.error('❌  ABI sync failed:', (error as Error).message)
    process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main()
}
