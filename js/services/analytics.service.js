/**
 * Analytics Service
 * Provides data aggregation and business intelligence
 */
class AnalyticsService {
  /**
   * Calculate revenue metrics
   */
  static calculateRevenueMetrics(db, agentId = null) {
    let finishing = db.finishing;
    let ledger = db.ledger;

    if (agentId) {
      finishing = finishing.filter(f => f.agentId === agentId);
      ledger = ledger.filter(l => l.agentId === agentId);
    }

    const totalBills = finishing.reduce((sum, f) => sum + (f.grossBill || 0), 0);
    const totalPayments = ledger
      .filter(l => l.debit > 0)
      .reduce((sum, l) => sum + l.debit, 0);
    const outstanding = totalBills - totalPayments;

    return {
      totalBills,
      totalPayments,
      outstanding,
      paymentRate: totalBills > 0 ? (totalPayments / totalBills) * 100 : 0
    };
  }

  /**
   * Calculate production metrics
   */
  static calculateProductionMetrics(db, agentId = null) {
    let cutting = db.cutting;
    let finishing = db.finishing;

    if (agentId) {
      cutting = cutting.filter(c => c.agentId === agentId);
      finishing = finishing.filter(f => f.agentId === agentId);
    }

    const totalExpected = cutting.reduce((sum, c) => sum + (c.expectedQty || 0), 0);
    const totalFinished = finishing.reduce((sum, f) => sum + (f.totalAccepted || 0), 0);
    const totalShortage = finishing.reduce((sum, f) => sum + Math.max(0, f.shortage || 0), 0);

    return {
      totalExpected,
      totalFinished,
      totalShortage,
      completionRate: totalExpected > 0 ? (totalFinished / totalExpected) * 100 : 0,
      wastePercentage: totalExpected > 0 
        ? ((totalExpected - totalFinished - totalShortage) / totalExpected) * 100 
        : 0
    };
  }

  /**
   * Get agent performance summary
   */
  static getAgentPerformance(db) {
    return db.agents.map(agent => {
      const revenue = this.calculateRevenueMetrics(db, agent.id);
      const production = this.calculateProductionMetrics(db, agent.id);

      return {
        id: agent.id,
        name: agent.name,
        note: agent.note,
        ...revenue,
        ...production
      };
    });
  }

  /**
   * Get revenue trend over time
   */
  static getRevenueTrend(db, agentId = null, days = 30) {
    let finishing = db.finishing;
    let ledger = db.ledger;

    if (agentId) {
      finishing = finishing.filter(f => f.agentId === agentId);
      ledger = ledger.filter(l => l.agentId === agentId);
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    finishing = finishing.filter(f => new Date(f.date) >= cutoffDate);
    ledger = ledger.filter(l => new Date(l.date) >= cutoffDate);

    const dateMap = {};

    finishing.forEach(f => {
      const date = f.date.split('T')[0];
      if (!dateMap[date]) {
        dateMap[date] = { date, bills: 0, payments: 0 };
      }
      dateMap[date].bills += f.grossBill || 0;
    });

    ledger.forEach(l => {
      const date = l.date.split('T')[0];
      if (!dateMap[date]) {
        dateMap[date] = { date, bills: 0, payments: 0 };
      }
      if (l.debit > 0) {
        dateMap[date].payments += l.debit;
      }
    });

    return Object.values(dateMap)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(item => ({
        dates: item.date,
        grossBills: item.bills,
        paymentsReceived: item.payments
      }));
  }

  /**
   * Get payment methods distribution
   */
  static getPaymentMethodsDistribution(db, agentId = null) {
    let ledger = db.ledger.filter(l => l.debit > 0);

    if (agentId) {
      ledger = ledger.filter(l => l.agentId === agentId);
    }

    const distribution = {};
    const methods = ['Cash Payment', 'Cheque Payment', 'Bank Deposit', 'Online Transfer'];

    methods.forEach(method => {
      distribution[method] = ledger
        .filter(l => l.paymentMethod === method)
        .reduce((sum, l) => sum + l.debit, 0);
    });

    return distribution;
  }

  /**
   * Get monthly performance
   */
  static getMonthlyPerformance(db, agentId = null, months = 6) {
    let finishing = db.finishing;
    let ledger = db.ledger;

    if (agentId) {
      finishing = finishing.filter(f => f.agentId === agentId);
      ledger = ledger.filter(l => l.agentId === agentId);
    }

    const monthlyData = {};

    // Generate month labels
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyData[monthKey] = { month: this.formatMonth(date), bills: 0, payments: 0 };
    }

    finishing.forEach(f => {
      const date = new Date(f.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyData[monthKey]) {
        monthlyData[monthKey].bills += f.grossBill || 0;
      }
    });

    ledger.forEach(l => {
      const date = new Date(l.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyData[monthKey] && l.debit > 0) {
        monthlyData[monthKey].payments += l.debit;
      }
    });

    return Object.values(monthlyData);
  }

  /**
   * Get top performing agents
   */
  static getTopPerformers(db, metric = 'totalBills', limit = 5) {
    const performance = this.getAgentPerformance(db);
    return performance
      .sort((a, b) => (b[metric] || 0) - (a[metric] || 0))
      .slice(0, limit);
  }

  /**
   * Get accounts at risk (high outstanding)
   */
  static getAccountsAtRisk(db, threshold = 0) {
    const performance = this.getAgentPerformance(db);
    return performance
      .filter(p => p.outstanding > threshold)
      .sort((a, b) => b.outstanding - a.outstanding);
  }

  /**
   * Calculate KPIs
   */
  static calculateKPIs(db) {
    const revenue = this.calculateRevenueMetrics(db);
    const production = this.calculateProductionMetrics(db);
    const agentCount = db.agents.length;
    const avgBillsPerAgent = agentCount > 0 ? revenue.totalBills / agentCount : 0;

    return {
      totalRevenue: revenue.totalBills,
      totalPayments: revenue.totalPayments,
      outstandingBalance: revenue.outstanding,
      collectionRate: revenue.paymentRate,
      totalExpectedUnits: production.totalExpected,
      totalFinishedUnits: production.totalFinished,
      totalShortageUnits: production.totalShortage,
      productionCompletionRate: production.completionRate,
      wastePercentage: production.wastePercentage,
      activeAgents: agentCount,
      averageBillsPerAgent: avgBillsPerAgent
    };
  }

  /**
   * Format month for display
   */
  static formatMonth(date) {
    return date.toLocaleDateString('en-LK', { month: 'short', year: 'numeric' });
  }
}

const analyticsService = AnalyticsService;