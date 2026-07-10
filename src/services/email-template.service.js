// Email template service - generates invoice email HTML directly without frontend dependency
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

const generateInvoiceEmailHtml = (invoice) => {
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
          <td style="padding: 10px 8px; font-size: 11px; border-bottom: 1px solid #e6eaf0; vertical-align: top; color: #475569;">
            ${formatDate(trip.tripDate)}
          </td>
          <td style="padding: 10px 8px; font-size: 11px; font-weight: bold; color: #1e293b; border-bottom: 1px solid #e6eaf0; vertical-align: top;">
            ${trip.vrid || "N/A"}${loadIdDisplay ? `<br/><span style="font-size: 10px; color: #64748b; font-weight: normal;">${loadIdDisplay}</span>` : ""}
          </td>
          <td style="padding: 10px 8px; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #e6eaf0; vertical-align: top; color: #2563eb; font-weight: bold;">
            ${trip.driverName || "N/A"}
          </td>
          <td style="padding: 10px 8px; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #e6eaf0; vertical-align: top; color: #475569;">
            ${trip.route || "N/A"}
          </td>
          <td style="padding: 10px 8px; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #e6eaf0; vertical-align: top; color: #475569;">
            ${trip.pickup || "N/A"} - ${trip.drop || "N/A"}
          </td>
          <td style="padding: 10px 8px; font-size: 11px; text-align: right; font-weight: bold; color: #dc2626; white-space: nowrap; border-bottom: 1px solid #e6eaf0; vertical-align: top;">
            ${formatCurrency(trip.totalCharges || 0)}
          </td>
        </tr>
      `;
    })
    .join("");

  const invoiceNumber = invoice.invoiceNumber || "N/A";
  const grandTotal = formatCurrency(invoice.grandTotal);
  const dispatchTotal = formatCurrency(
    invoice.dispatchTotal ||
      invoice.trips?.reduce(
        (acc, t) => acc + (t.dispatchAmount || 0),
        0
      ) ||
      0
  );
  const customerName =
    invoice.customer?.companyName ||
    invoice.customer?.customerName ||
    "Valued Customer";

  return `
    <div style="position: relative; width: 100%; max-width: 600px; margin: 0 auto; overflow: hidden;">
      <!-- Email Safe Diagonal Background Watermark -->
      <div style="position: absolute; top: 45%; left: 50%; transform: translate(-50%, -50%) rotate(-35deg); font-family: Arial, sans-serif; font-size: 48px; font-weight: 900; color: rgba(148, 163, 184, 0.12); z-index: 0; pointer-events: none; white-space: nowrap; text-align: center; width: 100%;">
        XCDGOC PVT LTD
      </div>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="position: relative; z-index: 1; font-family: Arial, sans-serif; color: #1e293b; background: transparent;">
        <tr>
          <td style="padding: 20px;">
            <!-- Header -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="text-align: left; padding-bottom: 15px; border-bottom: 2px solid #102a63;">
                  <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #0f2962; text-transform: uppercase;">INVOICE</h1>
                  <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">Num: <strong>#${invoiceNumber}</strong></p>
                </td>
              </tr>
            </table>

            <!-- Greeting -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 20px; margin-bottom: 20px;">
              <tr>
                <td style="padding: 15px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px;">
                  <p style="margin: 0 0 10px 0; font-size: 14px; line-height: 1.5; color: #1e293b;">Hello ${customerName},</p>
                  <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #475569;">Please find attached your professional invoice as a PDF document.</p>
                </td>
              </tr>
            </table>

            <!-- Trip Details Table -->
            ${
              invoice.trips && invoice.trips.length > 0
                ? `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
              <tr>
                <td style="padding: 12px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px;">
                  <h2 style="margin: 0 0 10px 0; font-size: 12px; font-weight: bold; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.5px;">Trip Details</h2>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 11px;">
                    <thead>
                      <tr style="background-color: #102a63; color: #ffffff;">
                        <th style="padding: 8px; text-align: left; font-weight: 700; width: 15%;">DATE</th>
                        <th style="padding: 8px; text-align: left; font-weight: 700; width: 20%;">TRIP ID</th>
                        <th style="padding: 8px; text-align: left; font-weight: 700; width: 20%;">ASSIGNED</th>
                        <th style="padding: 8px; text-align: left; font-weight: 700; width: 15%;">ROUTE</th>
                        <th style="padding: 8px; text-align: left; font-weight: 700; width: 18%;">DISCRIPTION</th>
                        <th style="padding: 8px; text-align: right; font-weight: 700; width: 12%;">CHARGES</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${tripRows}
                    </tbody>
                  </table>
                </td>
              </tr>
            </table>
            `
                : ""
            }

            <!-- Right Aligned Pricing Summary -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
              <tr>
                <td width="40%"></td>
                <td width="60%" style="background-color: #f8fafc; border-top: 3px solid #102a63; padding: 12px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="padding: 4px 0; font-size: 11px; font-weight: bold; color: #dc2626; text-transform: uppercase;">DISPATCH CHARGES</td>
                      <td style="padding: 4px 0; font-size: 12px; font-weight: bold; text-align: right; color: #dc2626;">${dispatchTotal}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 4px 0; font-size: 11px; font-weight: bold; color: #dc2626; text-transform: uppercase;">GRAND TOTAL</td>
                      <td style="padding: 4px 0; font-size: 14px; font-weight: bold; text-align: right; color: #1e293b; white-space: nowrap;">${grandTotal}</td>
                    </tr>
                    <tr>
                      <td colspan="2" style="padding: 8px 0 2px 0; font-size: 11px; font-weight: bold; color: #dc2626; text-transform: uppercase;">DEPOSIT DETAILS</td>
                    </tr>
                    ${
                      eTransferAddress
                        ? `
                    <tr>
                      <td colspan="2" style="padding: 2px 0 2px 10px; font-size: 11px; color: #dc2626;">
                        e-transfer: <span style="color: #475569; font-weight: bold;">${eTransferAddress}</span>
                      </td>
                    </tr>
                    `
                        : ""
                    }
                    <tr>
                      <td colspan="2" style="padding: 2px 0 2px 10px; font-size: 11px; color: #dc2626; line-height: 1.4;">
                        VOID CHEQUE ${invoice.accountNumber ? `<br/><span style="color: #475569; font-weight: normal; font-size: 10px;">Transit: ${invoice.transitNumber || "115000"} | Acct: ${invoice.accountNumber}</span>` : ""}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Footer Band -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; margin-top: 20px;">
              <tr>
                <td style="width: 55%; vertical-align: top;">
                  <h2 style="margin: 0 0 4px 0; font-size: 22px; font-weight: 900; color: #475569; letter-spacing: 1px;">XCDGOC PVT LTD</h2>
                  <p style="margin: 0; font-size: 12px; font-weight: bold; color: #475569; line-height: 1.3;">Extreme Canada Dispatch Group of Companies</p>
                  <p style="margin: 4px 0 0 0; font-size: 10px; font-weight: bold; color: #0f2962;">WE ARE CANADA'S LEADING AND LARGEST DISPATCH SERVICES PROVIDEERS</p>
                </td>
                <td style="width: 45%; vertical-align: top; text-align: right;">
                  <p style="margin: 0; font-size: 11px; line-height: 1.4; color: #64748b;">
                    Open Board, Bision, Walmart, Load Link<br/>
                    and Non Amazon Dispatch Solutions<br/><br/>
                    <strong>Contact:</strong> xcdgoc@gmail.com<br/>
                    +91 750 121 6555<br/>
                    Shahid ul islam
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
};

module.exports = { generateInvoiceEmailHtml };