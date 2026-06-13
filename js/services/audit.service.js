/**
 * Audit Service
 * Tracks all user actions and data changes for compliance
 */
class AuditService {
  constructor() {
    this.auditLog = [];
    this.maxEntries = 5000;
    this.loadAuditLog();
  }

  /**
   * Log an action
   */
  logAction(action, details, agentId = null) {
    try {
      const entry = {
        id: this.generateId(),
        timestamp: new Date().toISOString(),
        action,
        details,
        agentId,
        userId: this.getCurrentUserId(),
        ipAddress: 'browser-client', // Would be server-side in production
        userAgent: navigator.userAgent.substring(0, 200)
      };

      this.auditLog.push(entry);
      
      if (this.auditLog.length > this.maxEntries) {
        this.auditLog = this.auditLog.slice(-this.maxEntries);
      }

      this.saveAuditLog();
      Logger.debug('Audit logged', { action, agentId });
      
      return entry;
    } catch (error) {
      Logger.error('Audit logging error:', error);
    }
  }

  /**
   * Log data creation
   */
  logCreate(type, id, data, agentId) {
    this.logAction(`CREATE_${type}`, {
      type,
      id,
      snapshot: data
    }, agentId);
  }

  /**
   * Log data update
   */
  logUpdate(type, id, oldData, newData, agentId) {
    this.logAction(`UPDATE_${type}`, {
      type,
      id,
      changes: this.getDifferences(oldData, newData),
      oldSnapshot: oldData,
      newSnapshot: newData
    }, agentId);
  }

  /**
   * Log data deletion
   */
  logDelete(type, id, data, agentId) {
    this.logAction(`DELETE_${type}`, {
      type,
      id,
      snapshot: data
    }, agentId);
  }

  /**
   * Get audit log with filters
   */
  getLog(filters = {}) {
    let filtered = [...this.auditLog];

    if (filters.action) {
      filtered = filtered.filter(log => log.action === filters.action);
    }

    if (filters.agentId) {
      filtered = filtered.filter(log => log.agentId === filters.agentId);
    }

    if (filters.startDate) {
      filtered = filtered.filter(log => new Date(log.timestamp) >= filters.startDate);
    }

    if (filters.endDate) {
      filtered = filtered.filter(log => new Date(log.timestamp) <= filters.endDate);
    }

    if (filters.limit) {
      filtered = filtered.slice(-filters.limit);
    }

    return filtered;
  }

  /**
   * Get differences between two objects
   */
  getDifferences(oldData, newData) {
    const changes = {};
    const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

    allKeys.forEach(key => {
      if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
        changes[key] = {
          old: oldData[key],
          new: newData[key]
        };
      }
    });

    return changes;
  }

  /**
   * Export audit log
   */
  exportLog(filters = {}) {
    const data = this.getLog(filters);
    return JSON.stringify(data, null, 2);
  }

  /**
   * Save audit log to storage
   */
  saveAuditLog() {
    try {
      storageService.saveAuditLog(this.auditLog);
    } catch (error) {
      Logger.error('Save audit log error:', error);
    }
  }

  /**
   * Load audit log from storage
   */
  loadAuditLog() {
    try {
      this.auditLog = storageService.loadAuditLog();
    } catch (error) {
      Logger.error('Load audit log error:', error);
      this.auditLog = [];
    }
  }

  /**
   * Clear old entries (older than days)
   */
  clearOldEntries(days = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const before = this.auditLog.length;
    this.auditLog = this.auditLog.filter(
      log => new Date(log.timestamp) > cutoffDate
    );
    
    this.saveAuditLog();
    Logger.info(`Cleared ${before - this.auditLog.length} old audit entries`);
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current user ID (placeholder for future auth)
   */
  getCurrentUserId() {
    return 'local-user'; // Would come from auth service
  }
}

const auditService = new AuditService();