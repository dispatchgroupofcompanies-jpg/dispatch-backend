const pdf = require("html-pdf-node");
const fs = require("fs");
const path = require("path");

const generateInvoicePDF = async (invoice) => {
  const dir = path.join(process.cwd(), "uploads/invoices");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filePath = path.join(dir, `invoice-${invoice.invoiceNumber}.pdf`);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: invoice.currency || "CAD",
    }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-CA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Mask GST/HST number to show only last 6 digits
  const maskGstNumber = (gstNumber) => {
    if (!gstNumber || gstNumber.length <= 6) return gstNumber || "N/A";
    const lastSix = gstNumber.slice(-6);
    return `******${lastSix}`;
  };

  // 🔄 Dynamic Multi/Single Header Tracker Engine Rule
  const tripsCount = invoice.trips?.length || 0;
  const dynamicInvoiceTitle = tripsCount > 1 ? "INVOICE - T" : "INVOICE - 1";

  const tripRows = (invoice.trips || [])
    .map(
      (trip, index) => `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 14px 12px; font-size: 12px; text-align: center;">${index + 1}</td>
      <td style="padding: 14px 12px; font-size: 12px; white-space: nowrap;">${formatDate(trip.tripDate)}</td>
      <td style="padding: 14px 12px; font-size: 12px; font-weight: bold; color: #1e293b;">${trip.vrid || "N/A"}</td>
      <td style="padding: 14px 12px; font-size: 12px; font-weight: 600; color: #2563eb;">${trip.driverName || "N/A"}</td>
      <td style="padding: 14px 12px; font-size: 12px;">${trip.route || "N/A"}</td>
      <td style="padding: 14px 12px; font-size: 12px;">${trip.pickup || "N/A"} to ${trip.drop || "N/A"}</td>
      <td style="padding: 14px 12px; font-size: 12px; text-align: right;">${formatCurrency(trip.totalCharges)}</td>
      <td style="padding: 14px 12px; font-size: 12px; text-align: center; color: #475569;">${trip.dispatchPercent}%</td>
      <td style="padding: 14px 12px; font-size: 12px; text-align: right; font-weight: 600; color: #b91c1c;">${formatCurrency(trip.dispatchAmount)}</td>
    </tr>
  `
    )
    .join("");

  const html = `
    <html>
      <head>
        <style>
          @page { size: A4; margin: 8mm 10mm; }
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #1e293b;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            position: relative;
          }
          .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 48px;
            font-weight: 900;
            color: rgba(226, 232, 240, 0.25);
            letter-spacing: 4px;
            white-space: nowrap;
            z-index: -1000;
            pointer-events: none;
          }
          .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10px;
          }
          .details-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
          }
          .totals-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
          }
          .invoice-title {
            font-size: 24px;
            font-weight: 800;
            letter-spacing: 0.5px;
            color: #102a63;
            margin: 0;
            line-height: 1.1;
            text-transform: uppercase;
          }
          .invoice-number {
            font-size: 12px;
            color: #64748b;
            margin-top: 4px;
            display: block;
          }
          .badge {
            padding: 6px 14px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            border-radius: 999px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            letter-spacing: 0.5px;
          }
          .badge-approved { background-color: #ecfdf5; border: 1px solid #bbf7d0; color: #166534; }
          .badge-rejected { background-color: #fee2e2; border: 1px solid #fecaca; color: #991b1b; }
          .badge-paid { background-color: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; }
          .badge-pending { background-color: #fef3c7; border: 1px solid #fde68a; color: #92400e; }
          .badge-draft { background-color: #f1f5f9; border: 1px solid #e2e8f0; color: #475569; }
          th { 
            font-weight: 700;
            padding: 8px 8px;
            font-size: 11px;
            line-height: 1.2;
          }
          td {
            padding: 6px 8px;
            font-size: 11px;
            line-height: 1.3;
          }
        </style>
      </head>
      <body>
        <div class="watermark">EXTREME LOGISTICS</div>

        <table class="header-table">
          <tr>
            <td style="vertical-align: top;">
              <h1 class="invoice-title">${dynamicInvoiceTitle}</h1>
              <span class="invoice-number">Num: <b>#${invoice.invoiceNumber}</b></span>
            </td>
            <td style="text-align: right; vertical-align: top;">
              <div style="margin-bottom: 6px;">
                <div class="badge badge-${(invoice.invoiceStatus || "draft").toLowerCase()}">${(invoice.invoiceStatus || "DRAFT").toUpperCase()}</div>
              </div>
              <div style="font-size: 12px; color: #64748b;">
                Date: ${formatDate(invoice.invoiceDate || invoice.createdAt)}
              </div>
            </td>
          </tr>
        </table>

        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 12px 0;" />

        <table class="details-table" style="table-layout: fixed;">
          <tr>
            <td style="vertical-align: top; width: 50%; padding-right: 16px;">
              <div style="font-size: 10px; text-transform: uppercase; color: #64748b; margin: 0 0 4px 0; letter-spacing: 0.5px; font-weight: 700;">EXTREME LOGISTIC INVOICE FROM:</div>
              <div style="margin-top: 4px;">
                <strong style="font-size: 13px; color: #dc2626; display: block;">${invoice.payee?.companyName || invoice.payee?.customerName || "N/A"}</strong>
                <div style="color: #475569; font-size: 12px; line-height: 1.4;">
                  ${invoice.payee?.address1 || invoice.payee?.address || "N/A"}
                </div>
                <div style="margin-top: 4px; color: #475569; font-size: 12px; line-height: 1.4;">
                  <b>Phone:</b> ${invoice.payee?.phone || "N/A"}<br/>
                  <b>Email:</b> ${invoice.payee?.email || "N/A"}<br/>
                  <b>GST/HST:</b> ${maskGstNumber(invoice.payee?.gstNumber)}
                </div>
              </div>
            </td>
            <td style="vertical-align: top; width: 50%; padding-left: 16px;">
              <div style="font-size: 10px; text-transform: uppercase; color: #64748b; margin: 0 0 4px 0; letter-spacing: 0.5px; font-weight: 700;">INVOICE TO:</div>
              <div style="margin-top: 4px;">
                <strong style="font-size: 13px; color: #2563eb; display: block;">${invoice.customer?.companyName || invoice.customer?.customerName || "N/A"}</strong>
                <div style="color: #475569; font-size: 12px; line-height: 1.4;">
                  ${invoice.customer?.address1 || invoice.customer?.address || "N/A"}
                </div>
                <div style="margin-top: 4px; color: #475569; font-size: 12px; line-height: 1.4;">
                  <b>Phone:</b> ${invoice.customer?.phone || "N/A"}<br/>
                  <b>Email:</b> ${invoice.customer?.email || "N/A"}<br/>
                  <b>GST/HST:</b> ${maskGstNumber(invoice.customer?.gstNumber)}
                </div>
              </div>
            </td>
          </tr>
        </table>

        ${invoice.invoicePeriod?.startDate ? `
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 10px; border-radius: 4px; font-size: 11px; margin-bottom: 16px; color: #334155;">
            📅 <b>Billing Period:</b> ${formatDate(invoice.invoicePeriod.startDate)} — ${formatDate(invoice.invoicePeriod.endDate)}
          </div>
        ` : ""}

        <table class="items-table">
          <thead>
            <tr style="background-color: #102a63; color: #ffffff;">
              <th style="padding: 8px 8px; font-size: 11px; border-top-left-radius: 4px; text-align: center; width: 5%;">#</th>
              <th style="padding: 8px 8px; font-size: 11px; text-align: left; width: 12%;">Date</th>
              <th style="padding: 8px 8px; font-size: 11px; text-align: left; width: 12%;">VRID</th>
              <th style="padding: 8px 8px; font-size: 11px; text-align: left; width: 14%;">Driver Name</th>
              <th style="padding: 8px 8px; font-size: 11px; text-align: left; width: 10%;">Route</th>
              <th style="padding: 8px 8px; font-size: 11px; text-align: left; width: 17%;">Description</th>
              <th style="padding: 8px 8px; font-size: 11px; text-align: right; width: 10%;">Charges</th>
              <th style="padding: 8px 8px; font-size: 11px; text-align: center; width: 10%;">Dispatch%</th>
              <th style="padding: 8px 8px; font-size: 11px; border-top-right-radius: 4px; text-align: right; width: 10%;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${tripRows}
          </tbody>
        </table>

        <table class="totals-table" style="margin-left: auto; width: 260px; margin-top: 10px;">
          <tr style="padding: 4px 0;">
            <td style="padding: 4px 0; font-size: 12px; color: #475569;">Subtotal:</td>
            <td style="padding: 4px 0; font-size: 12px; text-align: right; color: #0f172a; font-weight: 500;">${formatCurrency(invoice.subtotal)}</td>
          </tr>
          ${invoice.tax ? `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 4px 0; font-size: 12px; color: #475569;">Tax / VAT:</td>
            <td style="padding: 4px 0; font-size: 12px; text-align: right; color: #0f172a; font-weight: 500;">${formatCurrency(invoice.tax)}</td>
          </tr>
          ` : ''}
          <tr style="border-top: 1px solid #e2e8f0; margin-top: 8px;">
            <td style="padding: 8px 0; font-size: 13px; font-weight: bold; color: #1e293b;">Grand Total:</td>
            <td style="padding: 8px 0; font-size: 16px; font-weight: bold; text-align: right; color: #2563eb;">${invoice.currency || 'CAD'} ${formatCurrency(invoice.grandTotal)}</td>
          </tr>
        </table>

        ${invoice.accountNumber || invoice.institutionNumber || invoice.transitNumber || invoice.customer?.eTransfer || invoice.payee?.eTransferAddress ? `
          <div style="padding: 12px 16px; background-color: #f8fafc; border-radius: 8px; margin-top: 12px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                ${invoice.accountNumber ? `
                  <td style="width: ${(invoice.customer?.eTransfer || invoice.payee?.eTransferAddress) ? '50%' : '100%'}; padding-right: ${(invoice.customer?.eTransfer || invoice.payee?.eTransferAddress) ? '16px' : '0'}; vertical-align: top;">
                    <div style="font-size: 10px; text-transform: uppercase; color: #64748b; margin: 0 0 2px 0; letter-spacing: 0.5px; font-weight: 700;">Direct Deposit Details</div>
                    <div style="font-size: 12px; color: #475569; line-height: 1.6;">
                      Institution: ${invoice.institutionNumber || "N/A"} | Transit: ${invoice.transitNumber || "N/A"} | Account: ${invoice.accountNumber}
                    </div>
                  </td>
                ` : '<td style="width: 100%; vertical-align: top;">'}
                ${invoice.customer?.eTransfer || invoice.payee?.eTransferAddress ? `
                  <td style="width: ${invoice.accountNumber ? '50%' : '100%'}; padding-left: ${invoice.accountNumber ? '16px' : '0'}; vertical-align: top; ${invoice.accountNumber ? 'border-left: 1px dashed #cbd5e1;' : ''}">
                    <div style="font-size: 10px; text-transform: uppercase; color: #2563eb; margin: 0 0 2px 0; letter-spacing: 0.5px; font-weight: 700;">💥 E-Transfer Details</div>
                    <div style="font-size: 12px; color: #1e293b; font-weight: 600; line-height: 1.4;">
                      E-Transfer Email: ${invoice.customer?.eTransfer || invoice.payee?.eTransferAddress}
                    </div>
                  </td>
                ` : ''}
              </tr>
            </table>
          </div>
        ` : ""}

        ${invoice.notes ? `
          <div style="margin-top: 12px; font-size: 10px; color: #64748b; font-style: italic;">
            <b>Notes:</b> ${invoice.notes}
          </div>
        ` : ""}
      </body>
    </html>
  `;

  const file = { content: html };
  const options = { format: "A4", printBackground: true };

  console.log("🚀 Rendering Professional Layout Template with Watermark...");
  const pdfBuffer = await pdf.generatePdf(file, options);
  fs.writeFileSync(filePath, pdfBuffer);
  console.log("✅ PROFESSIONAL PDF COPIED TO STORAGE:", filePath);

  return filePath;
};

module.exports = generateInvoicePDF;