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

    // Total Invoices
    const totalInvoices = await Invoice.countDocuments(matchQuery);

    // Pending Invoices
    const pendingInvoices = await Invoice.countDocuments({ 
      ...matchQuery, 
      invoiceStatus: "pending" 
    });

    // Approved Invoices
    const approvedInvoices = await Invoice.countDocuments({ 
      ...matchQuery, 
      invoiceStatus: "approved" 
    });

    // Total Revenue (Grand Total ka sum)
    const revenueAggregation = await Invoice.aggregate([
      { $match: matchQuery },
      { $group: { _id: null, total: { $sum: "$grandTotal" } } },
    ]);
    const totalRevenue = revenueAggregation[0] ? revenueAggregation[0].total : 0;

    // Recent 5 Invoices (Table ke liye - Newest first)
    const recentInvoices = await Invoice.find(matchQuery)
      .sort({ createdAt: -1 })
      .limit(5);

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