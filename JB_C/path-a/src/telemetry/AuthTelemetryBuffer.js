const { buildTelemetryEvent } = require("./authTelemetrySchema");

class AuthTelemetryBuffer {
  constructor(limit = 500) {
    this.limit = Math.max(50, Number(limit) || 500);
    this.events = [];
  }

  emit(eventName, payload) {
    const event = buildTelemetryEvent(eventName, payload);
    this.events.push(event);
    if (this.events.length > this.limit) {
      this.events.splice(0, this.events.length - this.limit);
    }
    return event;
  }

  list(limit = 120) {
    const safeLimit = Math.max(1, Number(limit) || 120);
    return this.events.slice(-safeLimit);
  }
}

module.exports = {
  AuthTelemetryBuffer
};
