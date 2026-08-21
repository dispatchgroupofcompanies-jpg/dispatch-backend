// PDF template service - generates invoice PDF HTML directly without frontend dependency
const formatCurrency = (amount, currency = "CAD") => {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency,
  }).format(amount || 0);
};

const formatDate = (dateStr) => {
  if (!dateStr) return "N/A";
  
  // Using "en-GB" formats directly as DD/MM/YYYY
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const maskGstNumber = (gstNumber) => {
  if (!gstNumber || gstNumber.length <= 6) return gstNumber || "N/A";
  const lastSix = gstNumber.slice(-6);
  return `******${lastSix}`;
};

const generateInvoicePdfHtml = (invoice, options = {}) => {
  const serialNumber = invoice.payeeSerialNumber ?? invoice.invoiceNumber ?? "N/A";
  const dynamicInvoiceTitle = `INVOICE - #${serialNumber}`;
  const eTransferAddress =
    invoice.customer?.eTransfer || invoice.payee?.eTransferAddress;

  // Calculate total dispatch charges matching the email template logic
  const dispatchTotal =
    invoice.dispatchTotal ||
    invoice.trips?.reduce((acc, t) => acc + (t.dispatchAmount || 0), 0) ||
    0;

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

  const paymentProofSection =
    options.includePaymentProof && invoice.paymentProofUrl
      ? `
      <div class="page-break"></div>
      <div class="proof-section">
        <!-- Only include the payment proof image so it fits on a single page. Removed large title/description to avoid creating an extra page. -->
        <img
          class="proof-image"
          src="${invoice.paymentProofUrl}"
          alt="Payment Proof Screenshot"
        />
      </div>
    `
      : "";

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
            /* Let the document flow naturally; avoid forcing a fixed body height which can create an extra empty page. */
          }

          @media screen and (max-width: 700px) {
            body {
              width: 100%;
              height: auto;
              min-height: 100vh;
              overflow: visible;
            }

            .page-container {
              width: 100%;
              height: auto;
              min-height: 100vh;
              padding: 24px 16px 110px;
              overflow: visible;
            }

            .header-section { margin-bottom: 24px; }
            .invoice-title { font-size: 24px; }
            .watermark { font-size: 32px; letter-spacing: 4px; }
            .items-table { display: block; overflow-x: auto; }
            .items-table th, .items-table td { padding: 8px 6px !important; font-size: 10px !important; }
            .footer-band { position: static; height: auto; margin-top: 24px; padding: 18px 16px; }
          }

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
            /* Allow content to determine height and rely on page-breaks for pagination. */
            padding: 16mm 15mm 48mm 15mm;
            box-sizing: border-box;
            display: block;
            z-index: 1;
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

          .page-break {
            page-break-before: always;
            break-before: page;
          }

          .proof-section {
            /* Make proof-section use natural height and avoid forcing extra full-page min-height that can create an extra blank page. */
            padding: 16mm 15mm 16mm 15mm;
            box-sizing: border-box;
            width: 210mm;
            display: block;
            page-break-inside: avoid;
          }

          .proof-title {
            font-size: 28px;
            font-weight: 900;
            color: #0f2962;
            margin-bottom: 16px;
          }

          .proof-description {
            font-size: 12px;
            color: #475569;
            margin-bottom: 12px;
            line-height: 1.5;
          }

          .proof-image {
            width: 100%;
            /* Limit image height to available page space so it fits on a single page */
            max-height: 232mm;
            object-fit: contain;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            background: #ffffff;
          }
        </style>
      </head>
      <body>
        <div class="watermark">XCDGOC PVT LTD</div>

        <div class="page-container">
          <!-- Header Section -->
          <div class="header-section">
            <h1 class="invoice-title">${dynamicInvoiceTitle}</h1>
            <div style="margin-top: 8px; color: #64748b; font-size: 8px; line-height: 1.15; font-weight: bold; letter-spacing: 0.2px;">
              All invoices are non HST/GST<br/>
              We are not responsible for your previous record more than 30 days<br/>
              Rest later for further previous invoices record<br/>
              Of 03 months we will charge you $50
            </div>
          </div>

          <!-- Company Details Section -->
          <table class="details-table" style="table-layout: fixed;">
            <tr>
              <td style="vertical-align: top; width: 50%; padding-right: 20px;">
                <div style="font-size: 11px; text-transform: uppercase; color: #64748b; margin: 0 0 6px 0; font-weight: bold; letter-spacing: 0.5px;">Payee</div>
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
                <div style="font-size: 11px; text-transform: uppercase; color: #64748b; margin: 0 0 6px 0; font-weight: bold; letter-spacing: 0.5px;">Pay TO:</div>
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
                <th style="width: 18%;">DESCRIPTION</th>
                <th style="width: 12%; text-align: right;">CHARGES</th>
              </tr>
            </thead>
            <tbody>
              ${tripRows}
            </tbody>
          </table>

          <!-- Grand Total, Dispatch Charges & Deposit Details -->
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px;">
            <tr>
              <td style="width: 50%;"></td>
              <td style="width: 50%; vertical-align: top;">
                <table style="width: 100%; border-collapse: collapse; background-color: #f8fafc; border-top: 3px solid #102a63; border-bottom: 3px solid #102a63;">
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px 10px; font-size: 11px; font-weight: bold; color: #dc2626; text-transform: uppercase; letter-spacing: 0.5px;">DISPATCH CHARGES</td>
                    <td style="padding: 8px 10px; font-size: 13px; font-weight: bold; text-align: right; color: #dc2626; white-space: nowrap;">${formatCurrency(dispatchTotal)}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px 10px; font-size: 11px; font-weight: bold; color: #dc2626; text-transform: uppercase; letter-spacing: 0.5px;">GRAND TOTAL</td>
                    <td style="padding: 8px 10px; font-size: 15px; font-weight: bold; text-align: right; color: #0f2962; white-space: nowrap;">${formatCurrency(invoice.grandTotal)}</td>
                  </tr>
                  <tr>
                    <td colspan="2" style="padding: 10px 10px 4px 10px; font-size: 11px; font-weight: bold; color: #dc2626; text-transform: uppercase; letter-spacing: 0.5px;">DEPOSIT DETAILS</td>
                  </tr>
                  ${eTransferAddress ? `
                  <tr>
                    <td colspan="2" style="padding: 2px 10px 6px 18px; font-size: 11px; color: #dc2626; line-height: 1.5;">
                      <span style="font-weight: bold; text-transform: uppercase;">E-TRANSFER:</span> <span style="color: #475569; font-weight: bold;">${eTransferAddress}</span>
                    </td>
                  </tr>
                  ` : ""}
                  ${invoice.accountNumber ? `
                  <tr>
                    <td colspan="2" style="padding: 2px 10px 8px 18px; font-size: 11px; color: #dc2626; line-height: 1.5;">
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
                    XCDGOC PVT LTD<br/>
                    <span style="font-size: 11px; font-weight: 800; color: #0f2962; letter-spacing: 0.2px;">WE ARE CANADA'S LEADING AND LARGEST DISPATCH SERVICES PROVIDERS</span>
                  </div>
                </td>
                <td style="width: 45%; vertical-align: top;">
                  <div class="footer-right-copy" style="font-size: 8px; line-height: 1.15;">
                    Open Board, Bison, Walmart, Load Link<br/>
                    and Non Amazon Dispatch Solutions<br/><br/>
                    <b>Contact:</b> <span style="color: #dc2626; font-weight: bold;">BUSINESS HEAD SHAHID UL ISLAM</span><br/>
                    EXTREME CANADA DISPATCH GROUP OF COMPANIES<br/>
                    DIN 11644512<br/>
                    TAN AMRX10063E<br/>
                    CIN U52241JK20260PC018999<br/>
                    business@xcdgocpvtltd.com<br/>
                    xcdgocpvtltd@gmail.com<br/>
                    +1 519 191 0142<br/>
                    +91 750 121 6555
                  </div>
                </td>
              </tr>
            </table>
          </div>
        </div>
        ${paymentProofSection}
      </body>
    </html>
  `;
};

module.exports = { generateInvoicePdfHtml };
