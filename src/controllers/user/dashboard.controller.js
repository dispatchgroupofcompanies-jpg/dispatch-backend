const Invoice = require("../../models/invoice.model");

// User: Get dashboard stats (only user's own data)
exports.getDashboardStats = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: "User not authenticated" 
      });
    }

    const matchQuery = { createdBy: userId };

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

    // Total Earnings (sum of all grandTotal)
    const earningsResult = await Invoice.aggregate([
      {
        $match: matchQuery
      },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: "$grandTotal" },
          totalSubtotal: { $sum: "$subtotal" },
          totalTax: { $sum: "$tax" }
        }
      }
    ]);

    const totalEarnings = earningsResult[0]?.totalEarnings || 0;
    const totalSubtotal = earningsResult[0]?.totalSubtotal || 0;
    const totalTax = earningsResult[0]?.totalTax || 0;

    // Invoice Status Breakdown
    const statusBreakdown = await Invoice.aggregate([
      {
        $match: matchQuery
      },
      {
        $group: {
          _id: "$invoiceStatus",
          count: { $sum: 1 },
          totalAmount: { $sum: "$grandTotal" }
        }
      }
    ]);

    // Recent Invoices
    const recentInvoices = await Invoice.find(matchQuery)
      .sort({ createdAt: -1 })
      .limit(10)
      .select("invoiceNumber invoiceStatus grandTotal customer.companyName createdAt");

    // Monthly Stats (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyStats = await Invoice.aggregate([
      {
        $match: {
          ...matchQuery,
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          count: { $sum: 1 },
          earnings: { $sum: "$grandTotal" }
        }
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 }
      }
    ]);

    return res.json({
      success: true,
      data: {
        totalInvoices,
        pendingInvoices,
        approvedInvoices,
        totalEarnings,
        totalSubtotal,
        totalTax,
        statusBreakdown,
        recentInvoices,
        monthlyStats
      }
    });

  } catch (error) {
    console.error("Dashboard stats error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard statistics",
      error: error.message
    });
  }
};