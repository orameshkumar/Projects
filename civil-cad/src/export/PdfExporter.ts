import { jsPDF } from 'jspdf'

const PAPER_SIZES = {
  A3: { w: 420, h: 297, jsPDF: 'a3' as const },
  A4: { w: 297, h: 210, jsPDF: 'a4' as const },
}

export function exportPdf(
  canvas: HTMLCanvasElement,
  paperSize: 'A3' | 'A4' = 'A3',
  title = 'Civil Drawing'
): void {
  const { jsPDF: format } = PAPER_SIZES[paperSize]

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format,
  })

  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  // Convert canvas to PNG data URL
  const imgData = canvas.toDataURL('image/png', 1.0)

  // Maintain aspect ratio — fit within page with 10mm margin
  const margin = 10
  const availW = pageW - margin * 2
  const availH = pageH - margin * 2
  const canvasAspect = canvas.width / canvas.height
  const pageAspect = availW / availH

  let imgW: number, imgH: number
  if (canvasAspect > pageAspect) {
    imgW = availW
    imgH = availW / canvasAspect
  } else {
    imgH = availH
    imgW = availH * canvasAspect
  }

  const imgX = margin + (availW - imgW) / 2
  const imgY = margin + (availH - imgH) / 2

  doc.addImage(imgData, 'PNG', imgX, imgY, imgW, imgH)

  // Thin border
  doc.setDrawColor(100, 116, 139)
  doc.setLineWidth(0.3)
  doc.rect(margin, margin, availW, availH)

  doc.save(`${title}.pdf`)
}
