// Mock for @typescript-eda/core
module.exports = {
  Entity: class Entity {
    constructor() {}
  },
  Event: class Event {
    constructor() {
      this.timestamp = new Date();
    }
  },
  listen: (eventClass) => {
    return (target, propertyName, descriptor) => {
      return descriptor;
    };
  }
};