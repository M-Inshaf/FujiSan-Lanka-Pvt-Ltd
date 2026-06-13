/**
 * Real-time Collaboration Service
 * Enables multi-user collaboration with WebSocket support
 */
class CollaborationService {
  constructor() {
    this.connected = false;
    this.userId = this.generateUserId();
    this.activeUsers = [];
    this.messageQueue = [];
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.listeners = {};
  }

  /**
   * Initialize WebSocket connection (placeholder for server integration)
   */
  async connect(serverUrl = null) {
    try {
      Logger.info('Attempting to connect to collaboration server');

      // This is a placeholder - in production, connect to actual WebSocket server
      if (serverUrl) {
        this.ws = new WebSocket(serverUrl);
        this.setupWebSocketListeners();
      } else {
        Logger.warn('No collaboration server configured - using local mode');
        this.simulateLocalCollaboration();
      }
    } catch (error) {
      Logger.error('Collaboration connection error:', error);
      this.handleConnectionError();
    }
  }

  /**
   * Setup WebSocket event listeners
   */
  setupWebSocketListeners() {
    this.ws.onopen = () => this.handleConnected();
    this.ws.onmessage = (event) => this.handleMessage(JSON.parse(event.data));
    this.ws.onerror = (error) => this.handleError(error);
    this.ws.onclose = () => this.handleDisconnected();
  }

  /**
   * Handle connection established
   */
  handleConnected() {
    this.connected = true;
    this.reconnectAttempts = 0;
    Logger.info('Collaboration service connected');
    this.emit('connected');

    // Send pending messages
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.send(message);
    }
  }

  /**
   * Handle incoming message
   */
  handleMessage(message) {
    Logger.debug('Collaboration message received', message);

    switch (message.type) {
      case 'userJoined':
        this.handleUserJoined(message);
        break;
      case 'userLeft':
        this.handleUserLeft(message);
        break;
      case 'dataUpdate':
        this.handleDataUpdate(message);
        break;
      case 'cursorPosition':
        this.handleCursorPosition(message);
        break;
      case 'notification':
        this.handleNotification(message);
        break;
      default:
        this.emit(message.type, message);
    }
  }

  /**
   * Handle user joined event
   */
  handleUserJoined(message) {
    const user = message.user;
    if (!this.activeUsers.find(u => u.id === user.id)) {
      this.activeUsers.push(user);
      Logger.info(`User ${user.name} joined the session`);
      this.emit('userJoined', user);
    }
  }

  /**
   * Handle user left event
   */
  handleUserLeft(message) {
    const userId = message.userId;
    this.activeUsers = this.activeUsers.filter(u => u.id !== userId);
    Logger.info(`User left the session`);
    this.emit('userLeft', { userId });
  }

  /**
   * Handle data update from other users
   */
  handleDataUpdate(message) {
    const { dataType, action, data, agentId, userId } = message;
    
    if (userId === this.userId) return; // Ignore own updates

    Logger.debug('Data update from another user', { dataType, action });
    this.emit('dataUpdate', { dataType, action, data, agentId, userId });
  }

  /**
   * Handle cursor position for live collaboration
   */
  handleCursorPosition(message) {
    const { userId, position, activeElement } = message;
    if (userId !== this.userId) {
      this.emit('cursorUpdate', { userId, position, activeElement });
    }
  }

  /**
   * Handle connection error
   */
  handleError(error) {
    Logger.error('WebSocket error:', error);
    this.emit('error', error);
  }

  /**
   * Handle disconnection
   */
  handleDisconnected() {
    this.connected = false;
    Logger.warn('Collaboration service disconnected');
    this.emit('disconnected');
    this.attemptReconnect();
  }

  /**
   * Handle connection error and attempt reconnect
   */
  handleConnectionError() {
    this.connected = false;
    this.attemptReconnect();
  }

  /**
   * Attempt to reconnect
   */
  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * this.reconnectAttempts;
      Logger.info(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      Logger.error('Max reconnection attempts reached');
      this.emit('maxReconnectAttemptsReached');
    }
  }

  /**
   * Send message to server
   */
  send(message) {
    if (this.connected && this.ws) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        Logger.error('Error sending message:', error);
        this.messageQueue.push(message);
      }
    } else {
      this.messageQueue.push(message);
    }
  }

  /**
   * Broadcast data update to other users
   */
  broadcastDataUpdate(dataType, action, data, agentId) {
    const message = {
      type: 'dataUpdate',
      dataType,
      action,
      data,
      agentId,
      userId: this.userId,
      timestamp: new Date().toISOString()
    };

    this.send(message);
    auditService.logAction('COLLABORATION_UPDATE', {
      dataType,
      action,
      agentId
    });
  }

  /**
   * Send cursor position for presence awareness
   */
  sendCursorPosition(activeElement) {
    const message = {
      type: 'cursorPosition',
      userId: this.userId,
      activeElement,
      timestamp: new Date().toISOString()
    };

    this.send(message);
  }

  /**
   * Send notification to other users
   */
  sendNotification(title, message) {
    const notification = {
      type: 'notification',
      userId: this.userId,
      title,
      message,
      timestamp: new Date().toISOString()
    };

    this.send(notification);
  }

  /**
   * Handle notification
   */
  handleNotification(message) {
    const { userId, title, message: msg } = message;
    Logger.info(`Notification from user: ${title}`);
    this.emit('notification', { userId, title, message: msg });
  }

  /**
   * Get active users
   */
  getActiveUsers() {
    return this.activeUsers;
  }

  /**
   * Get collaboration status
   */
  getStatus() {
    return {
      connected: this.connected,
      userId: this.userId,
      activeUsers: this.activeUsers.length,
      pendingMessages: this.messageQueue.length,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  /**
   * Simulate local collaboration (for testing without server)
   */
  simulateLocalCollaboration() {
    Logger.info('Running in local collaboration mode');
    this.connected = true;
    this.emit('connected');

    // Simulate other users joining
    setTimeout(() => {
      this.handleUserJoined({
        user: { id: 'sim-user-1', name: 'Simulation User', color: '#2563eb' }
      });
    }, 2000);
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
  emit(event, data = null) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          Logger.error(`Error in listener for event ${event}:`, error);
        }
      });
    }
  }

  /**
   * Generate unique user ID
   */
  generateUserId() {
    return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Disconnect from collaboration service
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
    this.connected = false;
    Logger.info('Collaboration service disconnected by user');
  }
}

const collaborationService = new CollaborationService();