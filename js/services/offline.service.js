/**
 * Offline Service
 * Handles offline functionality and sync queue management
 */
class OfflineService {
  constructor() {
    this.syncQueue = [];
    this.isOnline = navigator.onLine;
    this.lastSyncTime = null;
    this.syncInProgress = false;
    
    this.loadSyncQueue();
    this.setupEventListeners();
  }

  /**
   * Setup online/offline event listeners
   */
  setupEventListeners() {
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  /**
   * Handle going online
   */
  handleOnline() {
    this.isOnline = true;
    Logger.info('Application is online');
    this.notifyStatusChange(true);
    this.syncPendingChanges();
  }

  /**
   * Handle going offline
   */
  handleOffline() {
    this.isOnline = false;
    Logger.warn('Application is offline - changes will be synced when online');
    this.notifyStatusChange(false);
  }

  /**
   * Add action to sync queue
   */
  queueAction(action, data, agentId) {
    const queueItem = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      action,
      data,
      agentId,
      synced: false,
      syncAttempts: 0,
      maxAttempts: 3
    };

    this.syncQueue.push(queueItem);
    this.saveSyncQueue();
    
    Logger.debug('Action queued for sync', { action, queueItem });
    
    if (this.isOnline) {
      this.syncPendingChanges();
    }

    return queueItem.id;
  }

  /**
   * Sync pending changes with server (placeholder)
   */
  async syncPendingChanges() {
    if (this.syncInProgress || this.syncQueue.length === 0) {
      return;
    }

    this.syncInProgress = true;
    Logger.info('Starting sync of pending changes');

    const pendingItems = this.syncQueue.filter(item => !item.synced);

    for (const item of pendingItems) {
      try {
        // In production, this would send to server
        await this.sendToServer(item);
        
        item.synced = true;
        item.syncedAt = new Date().toISOString();
        
        Logger.info('Synced item', { action: item.action });
      } catch (error) {
        item.syncAttempts++;
        
        if (item.syncAttempts >= item.maxAttempts) {
          Logger.error('Max sync attempts reached for item', { action: item.action });
          item.syncFailed = true;
        }
        
        Logger.warn('Sync attempt failed', { action: item.action, attempt: item.syncAttempts });
      }
    }

    this.saveSyncQueue();
    this.lastSyncTime = new Date();
    this.syncInProgress = false;
    this.notifySyncComplete();
  }

  /**
   * Send item to server (placeholder)
   */
  async sendToServer(item) {
    return new Promise((resolve, reject) => {
      // Simulate server sync
      setTimeout(() => {
        if (Math.random() > 0.1) { // 90% success rate
          resolve();
        } else {
          reject(new Error('Sync failed'));
        }
      }, 500);
    });
  }

  /**
   * Get sync status
   */
  getSyncStatus() {
    const pendingCount = this.syncQueue.filter(item => !item.synced).length;
    return {
      isOnline: this.isOnline,
      pendingCount,
      lastSyncTime: this.lastSyncTime,
      syncInProgress: this.syncInProgress
    };
  }

  /**
   * Save sync queue to storage
   */
  saveSyncQueue() {
    try {
      storageService.saveSyncQueue(this.syncQueue);
    } catch (error) {
      Logger.error('Save sync queue error:', error);
    }
  }

  /**
   * Load sync queue from storage
   */
  loadSyncQueue() {
    try {
      this.syncQueue = storageService.loadSyncQueue();
    } catch (error) {
      Logger.error('Load sync queue error:', error);
      this.syncQueue = [];
    }
  }

  /**
   * Clear sync queue
   */
  clearSyncQueue() {
    this.syncQueue = [];
    this.saveSyncQueue();
    Logger.info('Sync queue cleared');
  }

  /**
   * Notify UI of status change
   */
  notifyStatusChange(isOnline) {
    const event = new CustomEvent('offlineStatusChange', {
      detail: { isOnline }
    });
    window.dispatchEvent(event);
  }

  /**
   * Notify UI of sync completion
   */
  notifySyncComplete() {
    const event = new CustomEvent('syncComplete', {
      detail: { status: this.getSyncStatus() }
    });
    window.dispatchEvent(event);
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

const offlineService = new OfflineService();