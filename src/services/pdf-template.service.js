// PDF template service - generates invoice PDF HTML directly without frontend dependency
const formatCurrency = (amount, currency = "CAD") => {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency,
  }).format(amount || 0);
};

const formatDate = (dateStr) => {
  if (!dateStr) return "N/A";
  return new Date(dateStr)
    .toLocaleDateString("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .replace(/\//g, "-");
};

const maskGstNumber = (gstNumber) => {
  if (!gstNumber || gstNumber.length <= 6) return gstNumber || "N/A";
  const lastSix = gstNumber.slice(-6);
  return `******${lastSix}`;
};

const generateInvoicePdfHtml = (invoice) => {
  const tripsCount = invoice.trips?.length || 0;
  const dynamicInvoiceTitle = tripsCount > 1 ? "INVOICE - T" : "INVOICE - 1";
  const eTransferAddress =
    invoice.customer?.eTransfer || invoice.payee?.eTransferAddress;

  const tripRows = (invoice.trips || [])
    .map((trip) => {
      const hasMultipleLoads = trip.loadId2 && trip.loadId2.trim() !== "";
      const loadIdDisplay = hasMultipleLoads
        ? `${trip.loadId1 || "N/A"}<br/>${trip.loadId2}`
        : "";

      return `
    <tr>
      <td style="padding: 12px 10px; font-size: 12px; border-bottom: 1px solid #e6eaf0; vertical-align: top;">${formatDate(trip.tripDate)}</td>
      <td style="padding: 12px 10px; font-size: 12px; font-weight: bold; color: #1e293b; border-bottom: 1px solid #e6eaf0; vertical-align: top;">
        ${trip.vrid || "N/A"}${loadIdDisplay ? `<br/><span style="font-size: 11px; color: #64748b; font-weight: normal;">${loadIdDisplay}</span>` : ""}
      </td>
      <td style="padding: 12px 10px; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #e6eaf0; vertical-align: top;">${trip.driverName || "N/A"}</td>
      <td style="padding: 12px 10px; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #e6eaf0; vertical-align: top;">${trip.route || "N/A"}</td>
      <td style="padding: 12px 10px; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #e6eaf0; vertical-align: top;">
        ${trip.pickup || "N/A"} - ${trip.drop || "N/A"}
      </td>
      <td style="padding: 12px 10px; font-size: 12px; text-align: right; font-weight: bold; color: #dc2626; white-space: nowrap; border-bottom: 1px solid #e6eaf0; vertical-align: top;">
        ${formatCurrency(trip.totalCharges || 0)}
      </td>
    </tr>
  `;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @page { 
            size: A4; 
            margin: 0;
          }
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #1e293b;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            position: relative;
            width: 210mm;
            height: 296mm;
            overflow: hidden;
          }

          /* Diagonal Watermark Styling */
          .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            transform-origin: center center;
            font-size: 56px;
            font-weight: 900;
            color: rgba(148, 163, 184, 0.12);
            letter-spacing: 8px;
            white-space: nowrap;
            text-align: center;
            z-index: 0;
            pointer-events: none;
            width: 100%;
            text-transform: uppercase;
          }

          .page-container {
            position: relative;
            width: 210mm;
            height: 296mm;
            padding: 16mm 15mm 48mm 15mm;
            box-sizing: border-box;
            display: block;
            z-index: 1;
            overflow: hidden;
          }

          .header-section {
            margin-bottom: 40px;
          }

          .invoice-title {
            font-size: 34px;
            font-weight: 900;
            letter-spacing: 1px;
            color: #0f2962;
            margin: 0;
            line-height: 1.1;
            text-transform: uppercase;
          }

          .invoice-number {
            font-size: 13px;
            color: #5f6978;
            margin-top: 4px;
            display: block;
          }

          .details-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }

          .company-name-red {
            font-size: 14px;
            font-weight: bold;
            color: #dc2626;
            display: block;
            margin-bottom: 2px;
            text-transform: uppercase;
          }

          .company-name-blue {
            font-size: 14px;
            font-weight: bold;
            color: #2563eb;
            display: block;
            margin-bottom: 2px;
          }

          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
          }

          .items-table thead tr {
            background-color: #102a63;
            color: #ffffff;
          }

          .items-table th {
            font-weight: 700;
            padding: 12px 10px;
            font-size: 12px;
            text-align: left;
            letter-spacing: 0.5px;
          }

          .footer-band {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            height: 40mm;
            background: #f8fafc;
            color: #64748b;
            border-top: 1px solid #e2e8f0;
            box-sizing: border-box;
            padding: 6mm 15mm 6mm 15mm;
          }

          .footer-brand {
            margin: 0 0 4px 0;
            font-size: 32px;
            line-height: 1;
            font-weight: 900;
            letter-spacing: 2px;
            color: #475569;
          }

          .footer-left-copy {
            font-size: 13px;
            line-height: 1.3;
            font-weight: bold;
            color: #475569;
          }

          .footer-right-copy {
            font-size: 12px;
            line-height: 1.4;
            color: #64748b;
            text-align: right;
          }
        </style>
      </head>
      <body>
        <!-- Watermark base layer behind content -->
        <div class="watermark">XCDGOC PVT LTD</div>

        <div class="page-container">
          <!-- Header Section -->
          <div class="header-section">
            <h1 class="invoice-title">${dynamicInvoiceTitle}</h1>
            <span class="invoice-number">Num: <b>#${invoice.invoiceNumber || "N/A"}</b></span>
          </div>

          <!-- Company Details Section -->
          <table class="details-table" style="table-layout: fixed;">
            <tr>
              <td style="vertical-align: top; width: 50%; padding-right: 20px;">
                <div style="font-size: 11px; text-transform: uppercase; color: #64748b; margin: 0 0 6px 0; font-weight: bold; letter-spacing: 0.5px;">EXTREME LOGISTICS INVOICE FROM:</div>
                <div>
                  <span class="company-name-red">${invoice.payee?.companyName || invoice.payee?.customerName || "N/A"}</span>
                  <div style="color: #475569; font-size: 12px; line-height: 1.3; text-transform: uppercase;">
                    ${invoice.payee?.address1 || invoice.payee?.address || "N/A"}
                  </div>
                  <div style="margin-top: 4px; color: #475569; font-size: 12px; line-height: 1.35;">
                    <b>Phone:</b> ${invoice.payee?.phone || "N/A"}<br/>
                    <b>Email:</b> ${invoice.payee?.email || "N/A"}<br/>
                    <b>GST/HST:</b> ${maskGstNumber(invoice.payee?.gstNumber)}
                  </div>
                </div>
              </td>
              <td style="vertical-align: top; width: 50%; padding-left: 40px;">
                <div style="font-size: 11px; text-transform: uppercase; color: #64748b; margin: 0 0 6px 0; font-weight: bold; letter-spacing: 0.5px;">INVOICE TO:</div>
                <div>
                  <span class="company-name-blue">${invoice.customer?.companyName || invoice.customer?.customerName || "N/A"}</span>
                  <div style="color: #475569; font-size: 12px; line-height: 1.3; text-transform: uppercase;">
                    ${invoice.customer?.address1 || invoice.customer?.address || "N/A"}
                  </div>
                  <div style="margin-top: 4px; color: #475569; font-size: 12px; line-height: 1.35;">
                    <b>Phone:</b> ${invoice.customer?.phone || "N/A"}<br/>
                    <b>Email:</b> ${invoice.customer?.email || "N/A"}<br/>
                    <b>GST/HST:</b> ${maskGstNumber(invoice.customer?.gstNumber)}
                  </div>
                </div>
              </td>
            </tr>
          </table>

          <!-- Items Table -->
          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 15%;">DATE</th>
                <th style="width: 20%;">TRIP ID</th>
                <th style="width: 20%;">ASSIGNED</th>
                <th style="width: 15%;">ROUTE</th>
                <th style="width: 18%;">DISCRIPTION</th>
                <th style="width: 12%; text-align: right;">CHARGES</th>
              </tr>
            </thead>
            <tbody>
              ${tripRows}
            </tbody>
          </table>

          <!-- Grand Total & Deposit Details Below Table -->
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px;">
            <tr>
              <td style="width: 50%;"></td>
              <td style="width: 50%; vertical-align: top;">
                <table style="width: 100%; border-collapse: collapse; background-color: #f8fafc; border-top: 3px solid #102a63; border-bottom: 3px solid #102a63; padding: 10px;">
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 6px 8px; font-size: 11px; font-weight: bold; color: #dc2626; text-transform: uppercase; letter-spacing: 0.5px;">GRAND TOTAL</td>
                    <td style="padding: 6px 8px; font-size: 14px; font-weight: bold; text-align: right; color: #1e293b; white-space: nowrap;">${formatCurrency(invoice.grandTotal)}</td>
                  </tr>
                  <tr>
                    <td colspan="2" style="padding: 8px 8px 4px 8px; font-size: 11px; font-weight: bold; color: #dc2626; text-transform: uppercase; letter-spacing: 0.5px;">DEPOSIT DETAILS</td>
                  </tr>
                  ${eTransferAddress ? `
                  <tr>
                    <td colspan="2" style="padding: 2px 8px 6px 18px; font-size: 11px; color: #dc2626; line-height: 1.5;">
                      <span style="font-weight: bold; text-transform: uppercase;">E-TRANSFER:</span> <span style="color: #475569; font-weight: bold;">${eTransferAddress}</span>
                    </td>
                  </tr>
                  ` : ""}
                  ${invoice.accountNumber ? `
                  <tr>
                    <td colspan="2" style="padding: 2px 8px 6px 18px; font-size: 11px; color: #dc2626; line-height: 1.5;">
                      <span style="font-weight: bold; text-transform: uppercase;">VOID CHEQUE:</span> <span style="color: #475569; font-weight: normal; font-size: 10px; text-transform: uppercase;">Institution: ${invoice.institutionNumber || "003"} | Transit: ${invoice.transitNumber || "115000"} | Acct: ${invoice.accountNumber}</span>
                    </td>
                  </tr>
                  ` : ""}
                </table>
              </td>
            </tr>
          </table>

          <!-- Footer Band -->
          <div class="footer-band">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="width: 55%; vertical-align: top;">
                  <h2 class="footer-brand">XCDGOC PVT LTD</h2>
                  <div class="footer-left-copy">
                    Extreme Canada Dispatch Group of Companies<br/>
                    <span style="font-size: 11px; font-weight: 800; color: #0f2962; letter-spacing: 0.2px;">WE ARE CANADA'S LEADING AND LARGEST DISPATCH SERVICES PROVIDEERS</span>
                  </div>
                </td>
                <td style="width: 45%; vertical-align: top;">
                  <div class="footer-right-copy">
                    Open Board,Bision,Walmart,Load Link<br/>
                    and Non Amazon Dispatch Solutions<br/><br/>
                    <b>Contact :</b> xcdgoc@gmail.com<br/>
                    +91 750 121 6555<br/>
                    Shahid ul islam
                  </div>
                </td>
              </tr>
            </table>
          </div>
        </div>
      </body>
    </html>
  `;
};

module.exports = { generateInvoicePdfHtml };