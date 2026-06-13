/**
 * Main Application Controller
 * Refactored with improved code quality and modular architecture
 */
class AppController {
  constructor() {
    this.db = {
      agents: [
        { id: 1, name: 'Agent One', note: '' },
        { id: 2, name: 'Agent Two', note: '' }
      ],
      cutting: [],
      finishing: [],
      ledger: []
    };
    this.currentAgentId = 1;
    this.pendingDelete = null;
    this.initialized = false;
  }

  /**
   * Initialize application
   */
  async initialize() {
    try {
      Logger.info('Initializing application');

      // Load theme
      const theme = storageService.loadTheme();
      this.applyTheme(theme);

      // Load data
      const savedData = await storageService.loadData();
      if (savedData && savedData.agents) {
        this.db = savedData;
      }

      // Initialize services
      await this.initializeServices();

      // Setup UI
      this.setupEventListeners();
      this.renderAgentTabs();
      this.renderCurrentPage();
      this.refreshDashboard();

      // Initialize charts
      this.initializeCharts();

      // Setup collaboration
      collaborationService.on('dataUpdate', (data) => this.handleRemoteUpdate(data));
      collaborationService.on('notification', (data) => this.handleCollaborationNotification(data));

      this.initialized = true;
      notificationService.success('✅ Application Ready', 'All systems initialized');
      Logger.info('Application initialization complete');
    } catch (error) {
      Logger.error('Application initialization error:', error);
      notificationService.error('❌ Initialization Error', error.message);
    }
  }

  /**
   * Initialize all services
   */
  async initializeServices() {
    try {
      Logger.info('Initializing services');

      // Initialize chart service
      await ChartService.initLibrary();

      // Initialize collaboration (local mode by default)
      // In production: collaborationService.connect('wss://your-server.com/collab');
      collaborationService.connect();

      // Setup offline service listeners
      window.addEventListener('offlineStatusChange', (e) => {
        const status = e.detail.isOnline ? 'Online' : 'Offline';
        Logger.info(`Status changed: ${status}`);
        this.updateOfflineStatus(e.detail.isOnline);
      });

      Logger.info('Services initialized successfully');
    } catch (error) {
      Logger.error('Service initialization error:', error);
      throw error;
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Auto-save on input changes
    document.querySelectorAll('input, textarea, select').forEach(el => {
      el.addEventListener('change', () => this.requestSaveData());
      el.addEventListener('input', () => this.requestSaveData());
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.saveData();
        notificationService.success('💾 Saved', 'Data saved locally');
      }
    });

    // Prevent data loss
    window.addEventListener('beforeunload', () => this.saveData());
  }

  /**
   * Request save with debounce
   */
  requestSaveData() {
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => this.saveData(), 1000);
  }

  /**
   * Save data to storage
   */
  async saveData() {
    try {
      await storageService.saveData(this.db);
      const status = document.getElementById('saveStatus');
      if (status) {
        status.textContent = 'Saved ' + new Date().toLocaleTimeString('en-LK', {
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      auditService.logAction('DATA_SAVED', { timestamp: new Date() });
    } catch (error) {
      Logger.error('Save error:', error);
      notificationService.error('❌ Save Failed', error.message, 5000);
    }
  }

  /**
   * Apply theme
   */
  applyTheme(theme) {
    const isDark = theme === 'dark';
    document.body.classList.toggle('dark-mode', isDark);
    const btn = document.getElementById('themeBtn');
    if (btn) {
      btn.textContent = isDark ? '☀️ Light' : '🌙 Dark';
    }
  }

  /**
   * Toggle theme
   */
  toggleTheme() {
    const isDark = document.body.classList.toggle('dark-mode');
    const btn = document.getElementById('themeBtn');
    if (btn) {
      btn.textContent = isDark ? '☀️ Light' : '🌙 Dark';
    }
    storageService.saveTheme(isDark ? 'dark' : 'light');
    this.refreshDashboard();
  }

  /**
   * Update offline status in UI
   */
  updateOfflineStatus(isOnline) {
    const statusIndicator = document.getElementById('offlineStatus');
    if (statusIndicator) {
      statusIndicator.textContent = isOnline ? '🟢 Online' : '🔴 Offline';
      statusIndicator.style.color = isOnline ? '#059669' : '#dc2626';
    }
  }

  /**
   * Initialize charts on dashboard
   */
  initializeCharts() {
    try {
      if (document.getElementById('revenueChart')) {
        this.updateRevenueChart();
      }
      if (document.getElementById('performanceChart')) {
        this.updatePerformanceChart();
      }
    } catch (error) {
      Logger.warn('Chart initialization skipped (no canvas elements)', error);
    }
  }

  /**
   * Update revenue chart
   */
  updateRevenueChart() {
    try {
      const agentData = analyticsService.getAgentPerformance(this.db);
      chartService.createOutstandingBalanceChart('revenueChart', agentData);
    } catch (error) {
      Logger.error('Revenue chart error:', error);
    }
  }

  /**
   * Update performance chart
   */
  updatePerformanceChart() {
    try {
      const metrics = analyticsService.calculateProductionMetrics(this.db, this.currentAgentId);
      chartService.createProductionPerformanceChart('performanceChart', metrics);
    } catch (error) {
      Logger.error('Performance chart error:', error);
    }
  }

  /**
   * Handle remote data updates from collaboration
   */
  handleRemoteUpdate(data) {
    const { dataType, action, updateData, agentId } = data;
    Logger.info('Handling remote update', { dataType, action });

    try {
      switch (dataType) {
        case 'CUTTING':
          this.handleRemoteCuttingUpdate(action, updateData);
          break;
        case 'FINISHING':
          this.handleRemoteFinishingUpdate(action, updateData);
          break;
        case 'LEDGER':
          this.handleRemoteLedgerUpdate(action, updateData);
          break;
      }

      this.renderCurrentPage();
      this.refreshDashboard();
      notificationService.info('🔄 Update Received', `${dataType} updated by another user`);
    } catch (error) {
      Logger.error('Remote update error:', error);
    }
  }

  /**
   * Handle remote cutting update
   */
  handleRemoteCuttingUpdate(action, data) {
    if (action === 'CREATE') {
      this.db.cutting.push(data);
    } else if (action === 'UPDATE') {
      const item = this.db.cutting.find(c => c.id === data.id);
      if (item) Object.assign(item, data);
    } else if (action === 'DELETE') {
      this.db.cutting = this.db.cutting.filter(c => c.id !== data.id);
    }
  }

  /**
   * Handle remote finishing update
   */
  handleRemoteFinishingUpdate(action, data) {
    if (action === 'CREATE') {
      this.db.finishing.push(data);
    } else if (action === 'UPDATE') {
      const item = this.db.finishing.find(f => f.id === data.id);
      if (item) Object.assign(item, data);
    } else if (action === 'DELETE') {
      this.db.finishing = this.db.finishing.filter(f => f.id !== data.id);
    }
  }

  /**
   * Handle remote ledger update
   */
  handleRemoteLedgerUpdate(action, data) {
    if (action === 'CREATE') {
      this.db.ledger.push(data);
    } else if (action === 'UPDATE') {
      const item = this.db.ledger.find(l => l.id === data.id);
      if (item) Object.assign(item, data);
    } else if (action === 'DELETE') {
      this.db.ledger = this.db.ledger.filter(l => l.id !== data.id);
    }
  }

  /**
   * Handle collaboration notifications
   */
  handleCollaborationNotification(data) {
    const { title, message } = data;
    notificationService.info(title, message);
  }

  /**
   * Render agent tabs
   */
  renderAgentTabs() {
    const tabs = document.getElementById('agentTabs');
    if (!tabs) return;

    tabs.innerHTML = '';
    this.db.agents.forEach(agent => {
      const btn = document.createElement('div');
      btn.className = 'agent-tab' + (agent.id === this.currentAgentId ? ' active' : '');
      btn.innerHTML = `<span>${agent.name}</span><span class="agent-dot"></span>`;
      btn.onclick = () => this.switchAgent(agent.id);

      if (agent.id === this.currentAgentId && this.db.agents.length > 1) {
        const del = document.createElement('button');
        del.style.cssText = 'font-size:13px;color:var(--accent4);background:transparent;border:none;cursor:pointer;padding:0 3px;margin-left:4px;line-height:1';
        del.textContent = '×';
        del.title = 'Remove agent';
        del.onclick = (e) => {
          e.stopPropagation();
          this.removeAgent(agent.id);
        };
        btn.appendChild(del);
      }
      tabs.appendChild(btn);
    });

    const badge = document.getElementById('agentBadge');
    if (badge) {
      const agent = this.db.agents.find(a => a.id === this.currentAgentId) || this.db.agents[0];
      badge.textContent = agent?.name || 'No Agent';
    }
  }

  /**
   * Switch agent
   */
  switchAgent(id) {
    this.currentAgentId = id;
    this.renderAgentTabs();
    this.renderCurrentPage();
    this.refreshDashboard();
  }

  /**
   * Add agent
   */
  addAgent() {
    const name = document.getElementById('newAgentName')?.value?.trim();
    if (!name) {
      notificationService.error('⚠️ Error', 'Agent name is required', 5000);
      return;
    }

    try {
      const id = Date.now();
      const newAgent = {
        id,
        name,
        note: document.getElementById('newAgentNote')?.value || ''
      };
      this.db.agents.push(newAgent);
      this.currentAgentId = id;
      this.renderAgentTabs();
      this.closeModal('addAgentModal');
      this.refreshDashboard();
      this.saveData();
      notificationService.success('✅ Agent Created', `Agent "${name}" created successfully`);
      auditService.logAction('CREATE_AGENT', { agentId: id, agentName: name });
    } catch (error) {
      Logger.error('Add agent error:', error);
      notificationService.error('❌ Error', 'Failed to add agent');
    }
  }

  /**
   * Remove agent
   */
  removeAgent(id) {
    if (this.db.agents.length <= 1) {
      notificationService.error('⚠️ Error', 'Cannot remove last agent', 5000);
      return;
    }

    if (!confirm('Remove this agent and all their data?')) return;

    try {
      const agent = this.db.agents.find(a => a.id === id);
      this.db.agents = this.db.agents.filter(a => a.id !== id);
      this.db.cutting = this.db.cutting.filter(e => e.agentId !== id);
      this.db.finishing = this.db.finishing.filter(e => e.agentId !== id);
      this.db.ledger = this.db.ledger.filter(e => e.agentId !== id);
      this.currentAgentId = this.db.agents[0].id;
      this.renderAgentTabs();
      this.renderCurrentPage();
      this.refreshDashboard();
      this.saveData();
      notificationService.success('✅ Removed', `Agent "${agent.name}" removed`);
      auditService.logAction('DELETE_AGENT', { agentId: id });
    } catch (error) {
      Logger.error('Remove agent error:', error);
      notificationService.error('❌ Error', 'Failed to remove agent');
    }
  }

  /**
   * Navigate to page
   */
  navTo(page, el) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    if (el) el.classList.add('active');
    document.getElementById('page-' + page)?.classList?.add('active');

    const titles = {
      dashboard: 'Executive Dashboard',
      cutting: 'Cutting & Dispatch Log',
      finishing: 'Finishing Receipts',
      ledger: 'Account Ledger',
      summary: 'Statement & Invoice',
      analytics: 'Analytics & Reports',
      audit: 'Activity Log'
    };
    const title = document.getElementById('topTitle');
    if (title) title.textContent = titles[page] || page;

    this.renderCurrentPage();
  }

  /**
   * Render current page
   */
  renderCurrentPage() {
    const active = document.querySelector('.page.active');
    if (!active) return;

    const id = active.id.replace('page-', '');
    switch (id) {
      case 'dashboard':
        this.refreshDashboard();
        this.initializeCharts();
        break;
      case 'analytics':
        this.renderAnalyticsPage();
        break;
      case 'audit':
        this.renderAuditLog();
        break;
    }
  }

  /**
   * Refresh dashboard
   */
  refreshDashboard() {
    try {
      const metrics = analyticsService.calculateProductionMetrics(this.db, this.currentAgentId);
      const revenue = analyticsService.calculateRevenueMetrics(this.db, this.currentAgentId);

      // Update KPI cards
      if (document.getElementById('k1')) document.getElementById('k1').textContent = metrics.totalExpected;
      if (document.getElementById('k2')) document.getElementById('k2').textContent = metrics.totalFinished;
      if (document.getElementById('k3')) document.getElementById('k3').textContent = metrics.totalShortage;
      if (document.getElementById('k4')) document.getElementById('k4').textContent = `LKR ${revenue.totalBills.toFixed(0)}`;

      // Update financial metrics
      if (document.getElementById('d1')) document.getElementById('d1').textContent = `LKR ${revenue.totalBills.toFixed(2)}`;
      if (document.getElementById('d2')) document.getElementById('d2').textContent = `LKR ${revenue.totalPayments.toFixed(2)}`;
      if (document.getElementById('d3')) {
        const d3el = document.getElementById('d3');
        d3el.textContent = `LKR ${revenue.outstanding.toFixed(2)}`;
        d3el.style.color = revenue.outstanding > 0 ? 'var(--accent3)' : 'var(--accent2)';
      }

      // Update agent summary
      const performance = analyticsService.getAgentPerformance(this.db);
      const tbody = document.querySelector('#agentSummaryTable tbody');
      if (tbody) {
        tbody.innerHTML = '';
        performance.forEach(agent => {
          const tr = tbody.insertRow();
          tr.innerHTML = `
            <td style="font-weight:600;color:var(--accent)">${agent.name}</td>
            <td>${agent.totalExpected}</td>
            <td>${agent.totalFinished}</td>
            <td>${Math.max(0, agent.totalShortage)}</td>
            <td>LKR ${agent.totalBills.toFixed(2)}</td>
            <td>LKR ${agent.totalPayments.toFixed(2)}</td>
            <td>${agent.outstanding.toFixed(2)}</td>
          `;
        });
      }
    } catch (error) {
      Logger.error('Dashboard refresh error:', error);
    }
  }

  /**
   * Render analytics page
   */
  renderAnalyticsPage() {
    try {
      const kpis = analyticsService.calculateKPIs(this.db);
      const container = document.getElementById('analyticsContent');
      if (!container) return;

      container.innerHTML = `
        <div class="kpi-grid">
          <div class="kpi-card blue">
            <div class="kpi-label">Total Revenue</div>
            <div class="kpi-val">LKR ${kpis.totalRevenue.toFixed(0)}</div>
          </div>
          <div class="kpi-card green">
            <div class="kpi-label">Collection Rate</div>
            <div class="kpi-val">${kpis.collectionRate.toFixed(1)}%</div>
          </div>
          <div class="kpi-card yellow">
            <div class="kpi-label">Outstanding</div>
            <div class="kpi-val">LKR ${kpis.outstandingBalance.toFixed(0)}</div>
          </div>
          <div class="kpi-card red">
            <div class="kpi-label">Completion Rate</div>
            <div class="kpi-val">${kpis.productionCompletionRate.toFixed(1)}%</div>
          </div>
        </div>
      `;
    } catch (error) {
      Logger.error('Analytics page error:', error);
    }
  }

  /**
   * Render audit log
   */
  renderAuditLog() {
    try {
      const logs = auditService.getLog({ limit: 100 });
      const tbody = document.querySelector('#auditTable tbody');
      if (!tbody) return;

      tbody.innerHTML = '';
      logs.reverse().forEach(log => {
        const tr = tbody.insertRow();
        const date = new Date(log.timestamp).toLocaleString();
        tr.innerHTML = `
          <td>${date}</td>
          <td>${log.action}</td>
          <td>${log.details?.type || '—'}</td>
          <td>${log.userId}</td>
          <td>${JSON.stringify(log.details || {})}</td>
        `;
      });
    } catch (error) {
      Logger.error('Audit log render error:', error);
    }
  }

  /**
   * Open modal
   */
  openModal(id) {
    document.getElementById(id)?.classList.add('open');
  }

  /**
   * Close modal
   */
  closeModal(id) {
    document.getElementById(id)?.classList.remove('open');
  }

  /**
   * Toggle sidebar
   */
  toggleSidebar() {
    document.getElementById('sidebar')?.classList.toggle('mobile-open');
    document.getElementById('sidebarOverlay')?.classList.toggle('open');
  }

  /**
   * Close sidebar
   */
  closeSidebar() {
    document.getElementById('sidebar')?.classList.remove('mobile-open');
    document.getElementById('sidebarOverlay')?.classList.remove('open');
  }
}

// Global instance
let appController;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
  appController = new AppController();
  await appController.initialize();

  // Hide loader
  setTimeout(() => {
    const loader = document.getElementById('loader');
    if (loader) loader.classList.add('hidden');
  }, 400);
});

// Prevent accidental data loss
window.addEventListener('beforeunload', (e) => {
  if (offlineService.getSyncStatus().pendingCount > 0) {
    e.preventDefault();
    e.returnValue = 'You have unsaved changes';
  }
});