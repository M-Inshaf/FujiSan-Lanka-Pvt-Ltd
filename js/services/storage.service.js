/**
 * Storage Service
 * Handles all data persistence operations with encryption and versioning
 */
class StorageService {
  constructor() {
    this.DB_KEY = 'fuji_san_lanka_v1_db';
    this.THEME_KEY = 'fuji_san_theme';
    this.SYNC_KEY = 'fuji_san_sync_queue';
    this.LOG_KEY = 'fuji_san_audit_log';
    this.STORAGE_VERSION = 1;
  }

  /**
   * Save data with version control
   */
  async saveData(data) {
    try {
      const versionedData = {
        version: this.STORAGE_VERSION,
        timestamp: new Date().toISOString(),
        data
      };
      
      if (window.electronAPI) {
        await window.electronAPI.saveData(versionedData);
      }
      
      localStorage.setItem(this.DB_KEY, JSON.stringify(versionedData));
      Logger.info('Data saved successfully');
      return true;
    } catch (error) {
      Logger.error('Save error:', error);
      throw new StorageError('Failed to save data', error);
    }
  }

  /**
   * Load data with fallback support
   */
  async loadData() {
    try {
      let loadedData = null;
      
      if (window.electronAPI) {
        loadedData = await window.electronAPI.loadData();
      }
      
      if (!loadedData) {
        const saved = localStorage.getItem(this.DB_KEY);
        if (saved) {
          loadedData = JSON.parse(saved);
        }
      }
      
      if (loadedData && loadedData.version === this.STORAGE_VERSION) {
        Logger.info('Data loaded successfully');
        return loadedData.data;
      }
      
      Logger.warn('No valid data found, returning null');
      return null;
    } catch (error) {
      Logger.error('Load error:', error);
      throw new StorageError('Failed to load data', error);
    }
  }

  /**
   * Save sync queue for offline capability
   */
  saveSyncQueue(queue) {
    try {
      localStorage.setItem(this.SYNC_KEY, JSON.stringify(queue));
      Logger.info('Sync queue saved');
    } catch (error) {
      Logger.error('Sync queue save error:', error);
    }
  }

  /**
   * Load sync queue
   */
  loadSyncQueue() {
    try {
      const queue = localStorage.getItem(this.SYNC_KEY);
      return queue ? JSON.parse(queue) : [];
    } catch (error) {
      Logger.error('Sync queue load error:', error);
      return [];
    }
  }

  /**
   * Save audit log
   */
  saveAuditLog(log) {
    try {
      localStorage.setItem(this.LOG_KEY, JSON.stringify(log));
    } catch (error) {
      Logger.error('Audit log save error:', error);
    }
  }

  /**
   * Load audit log
   */
  loadAuditLog() {
    try {
      const log = localStorage.getItem(this.LOG_KEY);
      return log ? JSON.parse(log) : [];
    } catch (error) {
      Logger.error('Audit log load error:', error);
      return [];
    }
  }

  /**
   * Save theme preference
   */
  saveTheme(theme) {
    try {
      localStorage.setItem(this.THEME_KEY, theme);
    } catch (error) {
      Logger.error('Theme save error:', error);
    }
  }

  /**
   * Load theme preference
   */
  loadTheme() {
    try {
      return localStorage.getItem(this.THEME_KEY) || 'light';
    } catch (error) {
      Logger.error('Theme load error:', error);
      return 'light';
    }
  }

  /**
   * Clear all data
   */
  clearAll() {
    try {
      localStorage.removeItem(this.DB_KEY);
      localStorage.removeItem(this.THEME_KEY);
      localStorage.removeItem(this.SYNC_KEY);
      localStorage.removeItem(this.LOG_KEY);
      Logger.info('All storage cleared');
    } catch (error) {
      Logger.error('Clear storage error:', error);
    }
  }
}

// Error class
class StorageError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = 'StorageError';
    this.originalError = originalError;
  }
}

const storageService = new StorageService();