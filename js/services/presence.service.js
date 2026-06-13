/**
 * Presence Service
 * Manages user presence and awareness features
 */
class PresenceService {
  constructor() {
    this.userColors = new Map();
    this.userPresence = new Map();
    this.colorPalette = [
      '#2563eb', '#059669', '#dc2626', '#d97706',
      '#7c3aed', '#0891b2', '#e11d48', '#15803d'
    ];
    this.colorIndex = 0;
  }

  /**
   * Register user with color
   */
  registerUser(userId, userName) {
    if (!this.userColors.has(userId)) {
      const color = this.colorPalette[this.colorIndex % this.colorPalette.length];
      this.colorIndex++;
      this.userColors.set(userId, color);
    }

    this.userPresence.set(userId, {
      userId,
      userName,
      timestamp: new Date(),
      activeElement: null,
      isActive: true
    });
  }

  /**
   * Update user presence
   */
  updatePresence(userId, activeElement = null) {
    if (this.userPresence.has(userId)) {
      const presence = this.userPresence.get(userId);
      presence.timestamp = new Date();
      presence.activeElement = activeElement;
      presence.isActive = true;
    }
  }

  /**
   * Mark user as inactive
   */
  markInactive(userId) {
    if (this.userPresence.has(userId)) {
      const presence = this.userPresence.get(userId);
      presence.isActive = false;
    }
  }

  /**
   * Remove user
   */
  removeUser(userId) {
    this.userPresence.delete(userId);
    this.userColors.delete(userId);
  }

  /**
   * Get user color
   */
  getUserColor(userId) {
    return this.userColors.get(userId) || '#gray';
  }

  /**
   * Get active users
   */
  getActiveUsers() {
    return Array.from(this.userPresence.values())
      .filter(presence => presence.isActive);
  }

  /**
   * Get all users
   */
  getAllUsers() {
    return Array.from(this.userPresence.values());
  }

  /**
   * Highlight element being edited by user
   */
  highlightUserElement(userId, elementId) {
    const color = this.getUserColor(userId);
    const element = document.getElementById(elementId);

    if (element) {
      element.style.borderLeft = `4px solid ${color}`;
      element.style.backgroundColor = `${color}08`;
    }
  }

  /**
   * Remove highlight
   */
  removeHighlight(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      element.style.borderLeft = 'none';
      element.style.backgroundColor = '';
    }
  }
}

const presenceService = new PresenceService();