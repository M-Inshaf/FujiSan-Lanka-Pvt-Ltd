/**
 * Chart Service
 * Handles all data visualization using Chart.js
 */
class ChartService {
  constructor() {
    this.charts = {};
    this.chartConfigs = {};
  }

  /**
   * Initialize Chart.js library
   */
  static async initLibrary() {
    if (typeof Chart === 'undefined') {
      throw new Error('Chart.js library not loaded');
    }
  }

  /**
   * Create revenue trend chart
   */
  createRevenueTrendChart(canvasId, data) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) {
      Logger.warn(`Canvas element ${canvasId} not found`);
      return null;
    }

    const labels = data.dates || [];
    const datasets = [
      {
        label: 'Gross Bills',
        data: data.grossBills || [],
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: '#2563eb',
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      },
      {
        label: 'Payments Received',
        data: data.paymentsReceived || [],
        borderColor: '#059669',
        backgroundColor: 'rgba(5, 150, 105, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: '#059669',
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      }
    ];

    if (this.charts[canvasId]) {
      this.charts[canvasId].destroy();
    }

    this.charts[canvasId] = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: this.getChartOptions({
        title: 'Revenue Trend',
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => `LKR ${value.toLocaleString()}`
            }
          }
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              usePointStyle: true,
              padding: 15,
              font: { size: 12, weight: '600' }
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => `${context.dataset.label}: LKR ${context.parsed.y.toLocaleString()}`
            }
          }
        }
      })
    });

    return this.charts[canvasId];
  }

  /**
   * Create outstanding balance chart
   */
  createOutstandingBalanceChart(canvasId, agents) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) {
      Logger.warn(`Canvas element ${canvasId} not found`);
      return null;
    }

    const labels = agents.map(a => a.name);
    const outstandingData = agents.map(a => a.outstanding);
    const colors = outstandingData.map(val => val > 0 ? '#dc2626' : '#059669');

    if (this.charts[canvasId]) {
      this.charts[canvasId].destroy();
    }

    this.charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Outstanding Balance',
          data: outstandingData,
          backgroundColor: colors,
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: this.getChartOptions({
        title: 'Outstanding Balance by Agent',
        indexAxis: 'y',
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              callback: (value) => `LKR ${value.toLocaleString()}`
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => `LKR ${context.parsed.x.toLocaleString()}`
            }
          }
        }
      })
    });

    return this.charts[canvasId];
  }

  /**
   * Create production performance chart
   */
  createProductionPerformanceChart(canvasId, data) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) {
      Logger.warn(`Canvas element ${canvasId} not found`);
      return null;
    }

    const total = data.expectedQty + data.shortage;
    const percentage = total > 0 ? (data.expectedQty / total) * 100 : 0;

    if (this.charts[canvasId]) {
      this.charts[canvasId].destroy();
    }

    this.charts[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Finished Goods', 'Shortage'],
        datasets: [{
          data: [data.expectedQty, data.shortage],
          backgroundColor: ['#059669', '#dc2626'],
          borderColor: '#fff',
          borderWidth: 3
        }]
      },
      options: this.getChartOptions({
        title: 'Production Performance',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              usePointStyle: true,
              padding: 15,
              font: { size: 12, weight: '600' }
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label || '';
                const value = context.parsed || 0;
                const pct = ((value / total) * 100).toFixed(1);
                return `${label}: ${value} (${pct}%)`;
              }
            }
          }
        }
      })
    });

    return this.charts[canvasId];
  }

  /**
   * Create agent performance comparison chart
   */
  createAgentComparisonChart(canvasId, agents) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) {
      Logger.warn(`Canvas element ${canvasId} not found`);
      return null;
    }

    const labels = agents.map(a => a.name);
    const expectedQty = agents.map(a => a.expectedQty);
    const finishedGoods = agents.map(a => a.finishedGoods);

    if (this.charts[canvasId]) {
      this.charts[canvasId].destroy();
    }

    this.charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Expected Qty',
            data: expectedQty,
            backgroundColor: '#2563eb',
            borderRadius: 8,
            borderSkipped: false
          },
          {
            label: 'Finished Goods',
            data: finishedGoods,
            backgroundColor: '#059669',
            borderRadius: 8,
            borderSkipped: false
          }
        ]
      },
      options: this.getChartOptions({
        title: 'Agent Performance Comparison',
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => value.toLocaleString()
            }
          }
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              usePointStyle: true,
              padding: 15,
              font: { size: 12, weight: '600' }
            }
          }
        }
      })
    });

    return this.charts[canvasId];
  }

  /**
   * Create payment methods distribution chart
   */
  createPaymentMethodsChart(canvasId, paymentData) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) {
      Logger.warn(`Canvas element ${canvasId} not found`);
      return null;
    }

    const labels = Object.keys(paymentData);
    const data = Object.values(paymentData);
    const colors = [
      '#2563eb', '#059669', '#d97706',
      '#7c3aed', '#ec4899', '#06b6d4'
    ];

    if (this.charts[canvasId]) {
      this.charts[canvasId].destroy();
    }

    this.charts[canvasId] = new Chart(ctx, {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.slice(0, labels.length),
          borderColor: '#fff',
          borderWidth: 2
        }]
      },
      options: this.getChartOptions({
        title: 'Payment Methods Distribution',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              usePointStyle: true,
              padding: 15,
              font: { size: 11, weight: '600' }
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const value = context.parsed || 0;
                const pct = ((value / total) * 100).toFixed(1);
                return `${value} (${pct}%)`;
              }
            }
          }
        }
      })
    });

    return this.charts[canvasId];
  }

  /**
   * Create monthly performance chart
   */
  createMonthlyPerformanceChart(canvasId, monthlyData) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) {
      Logger.warn(`Canvas element ${canvasId} not found`);
      return null;
    }

    const labels = monthlyData.map(d => d.month);
    const billsData = monthlyData.map(d => d.bills);
    const paymentsData = monthlyData.map(d => d.payments);

    if (this.charts[canvasId]) {
      this.charts[canvasId].destroy();
    }

    this.charts[canvasId] = new Chart(ctx, {
      type: 'area',
      data: {
        labels,
        datasets: [
          {
            label: 'Bills Generated',
            data: billsData,
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            fill: true,
            tension: 0.4
          },
          {
            label: 'Payments Received',
            data: paymentsData,
            borderColor: '#059669',
            backgroundColor: 'rgba(5, 150, 105, 0.1)',
            fill: true,
            tension: 0.4
          }
        ]
      },
      options: this.getChartOptions({
        title: 'Monthly Performance',
        scales: {
          y: {
            beginAtZero: true,
            stacked: false,
            ticks: {
              callback: (value) => `LKR ${(value / 1000).toFixed(0)}K`
            }
          }
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              usePointStyle: true,
              padding: 15,
              font: { size: 12, weight: '600' }
            }
          }
        }
      })
    });

    return this.charts[canvasId];
  }

  /**
   * Get common chart options
   */
  getChartOptions(customOptions = {}) {
    return {
      responsive: true,
      maintainAspectRatio: true,
      ...customOptions,
      plugins: {
        filler: {
          propagate: true
        },
        ...customOptions.plugins
      }
    };
  }

  /**
   * Update chart data
   */
  updateChart(canvasId, newData) {
    const chart = this.charts[canvasId];
    if (!chart) {
      Logger.warn(`Chart ${canvasId} not found`);
      return;
    }

    chart.data = newData;
    chart.update('active');
  }

  /**
   * Destroy chart
   */
  destroyChart(canvasId) {
    const chart = this.charts[canvasId];
    if (chart) {
      chart.destroy();
      delete this.charts[canvasId];
    }
  }

  /**
   * Destroy all charts
   */
  destroyAll() {
    Object.keys(this.charts).forEach(canvasId => {
      this.destroyChart(canvasId);
    });
  }
}

const chartService = new ChartService();