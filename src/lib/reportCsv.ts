function tableGrid(rows: HTMLTableRowElement[]): string[][] {
  const grid: string[][] = []

  rows.forEach((row, rowIndex) => {
    grid[rowIndex] ??= []
    let columnIndex = 0

    Array.from(row.cells).filter(cell => getComputedStyle(cell).display !== 'none').forEach(cell => {
      while (grid[rowIndex][columnIndex] !== undefined) columnIndex += 1
      const value = cell.innerText.trim().replace(/\s*\n\s*/g, ' / ').replace(/\s+/g, ' ')
      const rowSpan = Math.max(cell.rowSpan, 1)
      const colSpan = Math.max(cell.colSpan, 1)

      for (let rowOffset = 0; rowOffset < rowSpan; rowOffset += 1) {
        grid[rowIndex + rowOffset] ??= []
        for (let colOffset = 0; colOffset < colSpan; colOffset += 1) {
          grid[rowIndex + rowOffset][columnIndex + colOffset] = value
        }
      }
      columnIndex += colSpan
    })
  })

  return grid
}

function csvCell(value: string): string {
  const safe = /^[\s\u0000-\u001f]*[=+\-@]/.test(value) ? `'${value}` : value
  return `"${safe.replace(/"/g, '""')}"`
}

export function downloadReportTable(table: HTMLTableElement | null, filename: string): boolean {
  if (!table?.tHead || !table.tBodies[0]) return false
  const bodyRows = Array.from(table.tBodies[0].rows).filter(row => row.hasAttribute('data-row-key'))
  if (bodyRows.length === 0) return false

  const headerGrid = tableGrid(Array.from(table.tHead.rows))
  const columnCount = Math.max(...headerGrid.map(row => row.length))
  const headers = Array.from({ length: columnCount }, (_, column) => {
    const labels = headerGrid.map(row => row[column]).filter(Boolean)
    return labels.filter((label, index) => index === 0 || label !== labels[index - 1]).join(' / ')
  })
  const body = tableGrid(bodyRows)
  if (table.closest('.data-report-matrix')) {
    body.forEach(row => {
      if (row[0] === row[1]) row[0] = ''
    })
  }
  const dataColumns = headers.map((header, index) => ({ header, index })).filter(({ header }) => !/(^| \/ )操作$/.test(header))
  const csv = [headers, ...body].map(row => dataColumns.map(({ index }) => csvCell(row[index] ?? '')).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}
