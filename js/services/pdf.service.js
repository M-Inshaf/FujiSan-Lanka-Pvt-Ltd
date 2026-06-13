/**
 * PDF Service
 * Improved PDF generation with better reliability and quality
 */
class PDFService {
  /**
   * Generate PDF using jsPDF and html2canvas with improvements
   */
  static async generatePDF(elementId, filename, options = {}) {
    try {
      showToast('📄 Generating PDF...', 'success');
      
      const element = document.getElementById(elementId);
      if (!element) {
        throw new Error(`Element with id ${elementId} not found`);
      }

      const defaultOptions = {
        scale: 1.5,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        windowHeight: element.scrollHeight,
        windowWidth: element.scrollWidth,
        logging: false,
        ...options
      };

      // Show processing overlay
      const overlay = this.showProcessingOverlay();

      // Capture canvas
      const canvas = await html2canvas(element, defaultOptions);
      const imgData = canvas.toDataURL('image/jpeg', 0.95);

      if (!window.jspdf || !window.jspdf.jsPDF) {
        throw new Error('jsPDF library not loaded');
      }

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 20; // 10mm margins
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 10;

      // Add image to first page
      pdf.addImage(imgData, 'JPEG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - 20;

      // Add additional pages if needed
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 10, position, imgWidth, imgHeight);
        heightLeft -= pageHeight - 20;
      }

      // Add metadata
      pdf.setProperties({
        title: filename,
        subject: 'Fuji San Lanka - Production Accounting Report',
        author: 'Fuji San Lanka Pvt Ltd',
        keywords: 'accounting, production, report',
        creator: 'FujiSan Accounting System'
      });

      pdf.save(filename);
      
      this.hideProcessingOverlay(overlay);
      showToast('✅ PDF generated and downloaded successfully!', 'success');
      
      auditService.logAction('PDF_GENERATED', {
        filename,
        pages: pdf.internal.pages.length - 1,
        size: imgData.length
      });

      return pdf;
    } catch (error) {
      Logger.error('PDF generation error:', error);
      showToast(`⚠️ PDF generation failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Generate PDF with table content
   */
  static async generateTablePDF(title, headers, rows, filename) {
    try {
      if (!window.jspdf || !window.jspdf.jsPDF) {
        throw new Error('jsPDF library not loaded');
      }

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      let yPosition = 20;

      // Add title
      pdf.setFontSize(14);
      pdf.setFont(undefined, 'bold');
      pdf.text(title, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;

      // Add metadata
      pdf.setFontSize(9);
      pdf.setFont(undefined, 'normal');
      pdf.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;

      // Define table
      const tableData = [headers, ...rows];
      const colWidth = (pageWidth - 20) / headers.length;

      // Draw table header
      pdf.setFillColor(37, 99, 235);
      pdf.setTextColor(255, 255, 255);
      pdf.setFont(undefined, 'bold');
      pdf.setFontSize(10);

      headers.forEach((header, i) => {
        pdf.cell(10 + i * colWidth, yPosition, colWidth, 7, header, 1, 'center');
      });
      yPosition += 8;

      // Draw table rows
      pdf.setTextColor(0, 0, 0);
      pdf.setFont(undefined, 'normal');
      pdf.setFontSize(9);
      pdf.setFillColor(240, 246, 255);

      rows.forEach((row, rowIndex) => {
        if (yPosition > pageHeight - 20) {
          pdf.addPage();
          yPosition = 20;
        }

        const isAlternateRow = rowIndex % 2 === 0;
        if (isAlternateRow) {
          pdf.setFillColor(240, 246, 255);
        } else {
          pdf.setFillColor(255, 255, 255);
        }

        row.forEach((cell, i) => {
          const text = typeof cell === 'number' ? cell.toLocaleString() : String(cell);
          pdf.cell(10 + i * colWidth, yPosition, colWidth, 6, text, 1, 'center');
        });
        yPosition += 7;
      });

      pdf.save(filename);
      showToast('✅ PDF generated successfully!', 'success');
      return pdf;
    } catch (error) {
      Logger.error('Table PDF generation error:', error);
      showToast(`⚠️ PDF generation failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Show processing overlay
   */
  static showProcessingOverlay() {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      backdrop-filter: blur(4px);
    `;

    const spinner = document.createElement('div');
    spinner.style.cssText = `
      width: 50px;
      height: 50px;
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-top: 4px solid white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    `;

    const style = document.createElement('style');
    style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);

    overlay.appendChild(spinner);
    document.body.appendChild(overlay);

    return overlay;
  }

  /**
   * Hide processing overlay
   */
  static hideProcessingOverlay(overlay) {
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }
}

const pdfService = PDFService;