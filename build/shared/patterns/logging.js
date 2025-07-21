/**
 * @fileoverview Shared logging patterns for Semantest
 * @module shared/patterns/logging
 */
export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
    LogLevel[LogLevel["NONE"] = 4] = "NONE";
})(LogLevel || (LogLevel = {}));
/**
 * Structured logger with context support
 */
export class Logger {
    constructor() {
        this.level = LogLevel.INFO;
        this.handlers = [];
        this.globalContext = {};
    }
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    setLevel(level) {
        this.level = level;
    }
    setGlobalContext(context) {
        this.globalContext = { ...this.globalContext, ...context };
    }
    addHandler(handler) {
        this.handlers.push(handler);
    }
    log(level, message, context, data, error) {
        if (level < this.level)
            return;
        const entry = {
            level,
            message,
            timestamp: new Date(),
            context: { ...this.globalContext, ...context },
            data,
            error
        };
        // Console output
        const consoleMethod = this.getConsoleMethod(level);
        const prefix = `[${LogLevel[level]}] [${this.formatTimestamp(entry.timestamp)}]`;
        const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
        consoleMethod(`${prefix} ${message}${contextStr}`, data || '');
        if (error) {
            console.error(error);
        }
        // Custom handlers
        this.handlers.forEach(handler => {
            try {
                handler(entry);
            }
            catch (err) {
                console.error('Logger handler error:', err);
            }
        });
    }
    debug(message, context, data) {
        this.log(LogLevel.DEBUG, message, context, data);
    }
    info(message, context, data) {
        this.log(LogLevel.INFO, message, context, data);
    }
    warn(message, context, data) {
        this.log(LogLevel.WARN, message, context, data);
    }
    error(message, error, context, data) {
        this.log(LogLevel.ERROR, message, context, data, error);
    }
    getConsoleMethod(level) {
        switch (level) {
            case LogLevel.DEBUG:
                return console.debug;
            case LogLevel.INFO:
                return console.info;
            case LogLevel.WARN:
                return console.warn;
            case LogLevel.ERROR:
                return console.error;
            default:
                return console.log;
        }
    }
    formatTimestamp(date) {
        return date.toISOString().replace('T', ' ').slice(0, -5);
    }
}
/**
 * Module-specific logger
 */
export class ModuleLogger {
    constructor(moduleName, logger = Logger.getInstance()) {
        this.moduleName = moduleName;
        this.logger = logger;
    }
    debug(message, data) {
        this.logger.debug(message, { module: this.moduleName }, data);
    }
    info(message, data) {
        this.logger.info(message, { module: this.moduleName }, data);
    }
    warn(message, data) {
        this.logger.warn(message, { module: this.moduleName }, data);
    }
    error(message, error, data) {
        this.logger.error(message, error, { module: this.moduleName }, data);
    }
    child(subModule) {
        return new ModuleLogger(`${this.moduleName}.${subModule}`, this.logger);
    }
}
/**
 * Performance logging utility
 */
export class PerformanceLogger {
    static start(label) {
        this.measurements.set(label, performance.now());
    }
    static end(label, context) {
        const start = this.measurements.get(label);
        if (!start) {
            console.warn(`No start time found for label: ${label}`);
            return;
        }
        const duration = performance.now() - start;
        this.measurements.delete(label);
        Logger.getInstance().info(`Performance: ${label}`, { ...context, performance: true }, { duration: `${duration.toFixed(2)}ms` });
    }
    static async measure(label, operation, context) {
        this.start(label);
        try {
            const result = await operation();
            this.end(label, context);
            return result;
        }
        catch (error) {
            this.end(label, { ...context, error: true });
            throw error;
        }
    }
}
PerformanceLogger.measurements = new Map();
/**
 * Chrome extension specific log handler
 */
export class ChromeLogHandler {
    static setup() {
        const logger = Logger.getInstance();
        // Store logs in chrome.storage.local for debugging
        logger.addHandler(async (entry) => {
            try {
                const logs = await chrome.storage.local.get('logs') || {};
                const todayKey = new Date().toISOString().split('T')[0];
                if (!logs[todayKey]) {
                    logs[todayKey] = [];
                }
                logs[todayKey].push({
                    ...entry,
                    timestamp: entry.timestamp.toISOString()
                });
                // Keep only last 1000 logs per day
                if (logs[todayKey].length > 1000) {
                    logs[todayKey] = logs[todayKey].slice(-1000);
                }
                await chrome.storage.local.set({ logs });
            }
            catch (err) {
                console.error('Failed to store log:', err);
            }
        });
    }
}
