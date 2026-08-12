const normalizeFileName = (value) => {
  if (!value) return "";

  return String(value)
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
};

const getInvoiceNamePart = (invoice) => {
  if (!invoice) return "Invoice";

  const payeeName = invoice.payee?.companyName || invoice.payee?.customerName || invoice.payee?.name;
  const payToName = invoice.customer?.companyName || invoice.customer?.customerName || invoice.customer?.name;

  const safePayee = normalizeFileName(payeeName);
  const safePayTo = normalizeFileName(payToName);

  if (safePayee && safePayTo) {
    return `${safePayee}_to_${safePayTo}`;
  }

  if (safePayee) {
    return safePayee;
  }

  if (safePayTo) {
    return `to_${safePayTo}`;
  }

  return "Invoice";
};

const buildInvoiceFilename = (invoice, options = {}) => {
  const namePart = getInvoiceNamePart(invoice);
  const invoiceNumber = invoice?.invoiceNumber || invoice?._id || "unknown";
  const paidSuffix = options.paid ? "-Paid" : "";
  if (namePart === "Invoice") {
    return `Invoice-${invoiceNumber}${paidSuffix}.pdf`;
  }
  return `${namePart}-Invoice-${invoiceNumber}${paidSuffix}.pdf`;
};

module.exports = { buildInvoiceFilename, normalizeFileName };
