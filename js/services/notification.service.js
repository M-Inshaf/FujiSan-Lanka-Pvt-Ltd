/**
 * Notification Service
 * Centralized notification management with real-time updates
 */
class NotificationService {
  constructor() {
    this.notifications = [];
    this.maxNotifications = 100;
    this.listeners = {};
    this.notificationId = 0;
  }

  /**
   * Create notification
   */
  notify(options) {
    const {
      type = 'info',
      title = '',
      message = '',
      duration = 3500,
      action = null,
      actionLabel = 'Undo'
    } = options;

    const notification = {
      id: ++this.notificationId,
      type,
      title,
      message,
      timestamp: new Date(),
      action,
      actionLabel,
      read: false
    };

    this.notifications.push(notification);
    if (this.notifications.length > this.maxNotifications) {
      this.notifications.shift();
    }

    this.emit('notificationAdded', notification);

    if (duration > 0) {
      setTimeout(() => this.dismiss(notification.id), duration);
    }

    return notification.id;
  }

  /**
   * Notify success
   */
  success(title, message, duration = 3500) {
    return this.notify({ type: 'success', title, message, duration });
  }

  /**
   * Notify error
   */
  error(title, message, duration = 5000) {
    return this.notify({ type: 'error', title, message, duration });
  }

  /**
   * Notify warning
   */
  warning(title, message, duration = 4000) {
    return this.notify({ type: 'warning', title, message, duration });
  }

  /**
   * Notify info
   */
  info(title, message, duration = 3500) {
    return this.notify({ type: 'info', title, message, duration });
  }

  /**
   * Dismiss notification
   */
  dismiss(notificationId) {
    const index = this.notifications.findIndex(n => n.id === notificationId);
    if (index > -1) {
      const notification = this.notifications.splice(index, 1)[0];
      this.emit('notificationDismissed', notification);
    }
  }

  /**
   * Mark as read
   */
  markAsRead(notificationId) {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      this.emit('notificationRead', notification);
    }
  }

  /**
   * Clear all notifications
   */
  clearAll() {
    this.notifications = [];
    this.emit('notificationsCleared');
  }

  /**
   * Get unread count
   */
  getUnreadCount() {
    return this.notifications.filter(n => !n.read).length;
  }

  /**
   * Get notifications
   */
  getNotifications(filter = {}) {
    let filtered = [...this.notifications];

    if (filter.type) {
      filtered = filtered.filter(n => n.type === filter.type);
    }

    if (filter.unreadOnly) {
      filtered = filtered.filter(n => !n.read);
    }

    if (filter.limit) {
      filtered = filtered.slice(-filter.limit);
    }

    return filtered;
  }

  /**
   * Register event listener
   */
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  /**
   * Emit event
   */
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          Logger.error(`Error in notification listener for ${event}:`, error);
        }
      });
    }
  }
}

const notificationService = new NotificationService();