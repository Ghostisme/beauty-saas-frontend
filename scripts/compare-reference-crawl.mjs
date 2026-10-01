import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

function arg(name) {
  const prefix = `--${name}=`
  const item = process.argv.find(value => value.startsWith(prefix))
  return item ? item.slice(prefix.length) : undefined
}

function uniqueNames(items = []) {
  return [...new Set(items.map(item => String(item?.name || '').replace(/\s+/g, ' ').trim()).filter(Boolean))].sort()
}

function difference(left, right) {
  const rightSet = new Set(right)
  return left.filter(item => !rightSet.has(item))
}

function list(items) {
  return items.length ? items.map(item => `- ${item}`).join('\n') : '- 无'
}

async function main() {
  const sourceFile = arg('source')
  const targetFile = arg('target')
  const outputFile = arg('output')
  if (!sourceFile || !targetFile) throw new Error('用法：pnpm compare:reference -- --source=源站/report.json --target=本地/report.json [--output=diff.md]')
  const [source, target] = await Promise.all([
    readFile(path.resolve(sourceFile), 'utf8').then(JSON.parse),
    readFile(path.resolve(targetFile), 'utf8').then(JSON.parse),
  ])
  const targetByKey = new Map((target.results || []).map(item => [item.key, item]))
  const rows = []
  for (const sourceResult of source.results || []) {
    const targetResult = targetByKey.get(sourceResult.key)
    const sourceControls = uniqueNames(sourceResult.controls)
    const targetControls = uniqueNames(targetResult?.controls)
    const sourceInteractions = uniqueNames(sourceResult.interactions)
    const targetInteractions = uniqueNames(targetResult?.interactions)
    rows.push({
      key: sourceResult.key,
      label: sourceResult.label,
      sourceStatus: sourceResult.status,
      targetStatus: targetResult?.status || 'missing-module',
      missingControls: difference(sourceControls, targetControls),
      extraControls: difference(targetControls, sourceControls),
      missingInteractions: difference(sourceInteractions, targetInteractions),
      extraInteractions: difference(targetInteractions, sourceInteractions),
    })
  }
  const markdown = [
    '# 源站与本地交互核验差异',
    '',
    `- 源站报告：\`${path.resolve(sourceFile)}\``,
    `- 本地报告：\`${path.resolve(targetFile)}\``,
    '',
    ...rows.flatMap(row => [
      `## ${row.label}（${row.key}）`,
      `- 源站状态：${row.sourceStatus}`,
      `- 本地状态：${row.targetStatus}`,
      '- 本地缺少的可见控件：',
      list(row.missingControls),
      '- 本地多出的可见控件：',
      list(row.extraControls),
      '- 本地缺少的交互页面：',
      list(row.missingInteractions),
      '- 本地多出的交互页面：',
      list(row.extraInteractions),
      '',
    ]),
  ].join('\n')
  if (outputFile) {
    await writeFile(path.resolve(outputFile), markdown, 'utf8')
    console.log(`差异报告：${path.resolve(outputFile)}`)
  } else {
    console.log(markdown)
  }
  await writeFile(path.resolve(targetFile, '..', 'comparison.json'), JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2), 'utf8')
}

main().catch(error => {
  console.error(`[compare-reference-crawl] ${String(error)}`)
  process.exitCode = 1
})
