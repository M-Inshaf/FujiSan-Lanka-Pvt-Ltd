/**
 * Logger Service
 * Centralized logging system with audit trail support
 */
class Logger {
  static LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
  };

  static currentLevel = Logger.LOG_LEVELS.INFO;
  static logs = [];
  static maxLogs = 1000;

  static setLevel(level) {
    this.currentLevel = level;
  }

  static log(level, message, data = null) {
    if (level < this.currentLevel) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      level: Object.keys(this.LOG_LEVELS)[level],
      message,
      data,
      userAgent: navigator.userAgent
    };

    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    console.log(`[${logEntry.level}] ${message}`, data || '');
  }

  static debug(message, data) {
    this.log(this.LOG_LEVELS.DEBUG, message, data);
  }

  static info(message, data) {
    this.log(this.LOG_LEVELS.INFO, message, data);
  }

  static warn(message, data) {
    this.log(this.LOG_LEVELS.WARN, message, data);
  }

  static error(message, data) {
    this.log(this.LOG_LEVELS.ERROR, message, data);
  }

  static getLogs(filter = {}) {
    let filtered = this.logs;
    
    if (filter.level) {
      filtered = filtered.filter(log => log.level === filter.level);
    }
    
    if (filter.startTime) {
      filtered = filtered.filter(log => new Date(log.timestamp) >= filter.startTime);
    }
    
    if (filter.endTime) {
      filtered = filtered.filter(log => new Date(log.timestamp) <= filter.endTime);
    }

    return filtered;
  }

  static clearLogs() {
    this.logs = [];
  }

  static exportLogs() {
    return JSON.stringify(this.logs, null, 2);
  }
}