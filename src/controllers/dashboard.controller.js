const Invoice = require("../models/invoice.model");

// GET DASHBOARD STATS (user-specific or all for admin)
const getDashboardStats = async (req, res) => {
  try {
    console.log("🔍 getDashboardStats - req.user:", req.user ? "exists" : "undefined");
    console.log("🔍 getDashboardStats - req.accountType:", req.accountType);
    
    let matchQuery = {};
    
    // If user is not admin, filter by createdBy
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

    // Cancelled Invoices
    const cancelledInvoices = await Invoice.countDocuments({ 
      ...matchQuery, 
      invoiceStatus: "cancelled" 
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

    // Top Companies by Invoice Amount
    const topCompanies = await Invoice.aggregate([
      {
        $match: matchQuery
      },
      {
        $group: {
          _id: "$customer.companyName",
          invoiceCount: { $sum: 1 },
          totalAmount: { $sum: "$grandTotal" }
        }
      },
      {
        $sort: { totalAmount: -1 }
      },
      {
        $limit: 5
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
        cancelledInvoices,
        totalEarnings,
        totalSubtotal,
        totalTax,
        statusBreakdown,
        topCompanies,
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

module.exports = {
  getDashboardStats
};