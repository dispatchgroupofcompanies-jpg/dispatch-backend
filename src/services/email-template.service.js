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
  const serialNumber = invoice.payeeSerialNumber ?? invoice.invoiceNumber ?? "N/A";
  const dynamicInvoiceTitle = `INVOICE - #${serialNumber}`;
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
    <div style="width: 100%; max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; color: #1e293b;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding: 20px;">
            <!-- Header -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding-bottom: 15px; border-bottom: 3px solid #102a63;">
                  <h1 style="margin: 0 0 5px 0; font-size: 22px; font-weight: 900; color: #0f2962; text-transform: uppercase;">XCDGOC PVT LTD</h1>
                  <p style="margin: 0; font-size: 11px; color: #64748b; font-weight: 600;">Extreme Canada Dispatch Group of Companies</p>
                  <p style="margin: 4px 0 0 0; font-size: 10px; color: #64748b;">Canada's Leading Dispatch Services Provider</p>
                </td>
              </tr>
            </table>

            <!-- Company Details Section -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
              <tr>
                <td style="padding: 12px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="width: 50%; vertical-align: top; padding-right: 20px;">
                        <div style="font-size: 11px; text-transform: uppercase; color: #64748b; margin: 0 0 6px 0; font-weight: bold; letter-spacing: 0.5px;">EXTREME LOGISTICS INVOICE FROM:</div>
                        <div>
                          <span style="font-size: 14px; font-weight: bold; color: #dc2626; display: block; margin-bottom: 2px; text-transform: uppercase;">${invoice.payee?.companyName || invoice.payee?.customerName || "N/A"}</span>
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
                      <td style="width: 50%; vertical-align: top; padding-left: 20px;">
                        <div style="font-size: 11px; text-transform: uppercase; color: #64748b; margin: 0 0 6px 0; font-weight: bold; letter-spacing: 0.5px;">INVOICE TO:</div>
                        <div>
                          <span style="font-size: 14px; font-weight: bold; color: #2563eb; display: block; margin-bottom: 2px;">${invoice.customer?.companyName || invoice.customer?.customerName || "N/A"}</span>
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
                </td>
              </tr>
            </table>

            <!-- Greeting -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 20px; margin-bottom: 20px;">
              <tr>
                <td style="padding: 15px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px;">
                  <p style="margin: 0 0 10px 0; font-size: 14px; line-height: 1.5; color: #1e293b;">Hello ${customerName},</p>
                  <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #475569;">Please find your invoice details below.</p>
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

            <!-- Pricing Summary Below Table -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
              <tr>
                <td style="padding: 15px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="padding: 6px 0; font-size: 12px; font-weight: bold; color: #dc2626; text-transform: uppercase;">DISPATCH CHARGES</td>
                      <td style="padding: 6px 0; font-size: 13px; font-weight: bold; text-align: right; color: #dc2626;">${dispatchTotal}</td>
                    </tr>
                    <tr style="border-bottom: 2px solid #102a63;">
                      <td style="padding: 8px 0; font-size: 13px; font-weight: bold; color: #dc2626; text-transform: uppercase;">GRAND TOTAL</td>
                      <td style="padding: 8px 0; font-size: 16px; font-weight: bold; text-align: right; color: #1e293b; white-space: nowrap;">${grandTotal}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Deposit Details Below Grand Total -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
              <tr>
                <td style="padding: 15px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px;">
                  <p style="margin: 0 0 10px 0; font-size: 12px; font-weight: bold; color: #dc2626; text-transform: uppercase;">DEPOSIT DETAILS</p>
                  ${eTransferAddress ? `
                  <p style="margin: 0 0 6px 0; font-size: 11px; color: #475569; line-height: 1.5;">
                    <span style="color: #dc2626; font-weight: bold;">e-transfer:</span> <span style="color: #475569; font-weight: bold;">${eTransferAddress}</span>
                  </p>
                  ` : ""}
                  <p style="margin: 0; font-size: 11px; color: #dc2626; line-height: 1.5;">
                    VOID CHEQUE${invoice.accountNumber ? `<br/><span style="color: #475569; font-weight: normal; font-size: 10px;">Institution: ${invoice.institutionNumber || "003"} | Transit: ${invoice.transitNumber || "115000"} | Acct: ${invoice.accountNumber}</span>` : ""}
                  </p>
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
    </div>
  `;
};

module.exports = { generateInvoiceEmailHtml };
