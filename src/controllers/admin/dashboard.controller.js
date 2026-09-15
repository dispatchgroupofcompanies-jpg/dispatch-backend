const Invoice = require("../../models/invoice.model");

exports.getDashboardStats = async (req, res) => {
  try {
    const matchQuery = {};
    
    if (req.accountType !== "admin") {
      const userId = req.user?._id;
      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          message: "User not authenticated" 
        });
      }
      matchQuery.createdBy = userId;
    }

    // One aggregation computes all totals; keep recent documents hydrated to
    // preserve defaults in responses for legacy invoices.
    const [totals, recentInvoices] = await Promise.all([
      Invoice.aggregate([
        { $match: matchQuery },
        { $group: {
          _id: null,
          totalInvoices: { $sum: 1 },
          pendingInvoices: { $sum: { $cond: [{ $eq: ["$invoiceStatus", "pending"] }, 1, 0] } },
          approvedInvoices: { $sum: { $cond: [{ $eq: ["$invoiceStatus", "approved"] }, 1, 0] } },
          totalRevenue: { $sum: "$grandTotal" },
        } },
      ]),
      Invoice.find(matchQuery).sort({ createdAt: -1 }).limit(5),
    ]);
    const { totalInvoices = 0, pendingInvoices = 0, approvedInvoices = 0, totalRevenue = 0 } = totals[0] || {};

    return res.status(200).json({
      success: true,
      data: {
        stats: {
          totalInvoices,
          pendingInvoices,
          approvedInvoices,
          totalRevenue,
        },
        recentInvoices,
      },
    });

  } catch (error) {
    console.error("Error fetching admin dashboard stats:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard statistics",
      error: error.message
    });
  }
};