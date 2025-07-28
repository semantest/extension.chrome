/**
 * Mock implementation of @typescript-eda/core
 * Enables testing of modules that depend on this package
 */

// Base Entity class mock
export abstract class Entity<T> {
  constructor() {}
  
  // Add common Entity methods that might be used
  protected emit(event: any): void {
    // Mock emit
  }
}

// Mock listen decorator
export function listen(EventClass: any) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    // Mock decorator - just return the original method
    return descriptor;
  };
}

// Mock Event base class
export abstract class Event {
  constructor() {}
}

// Mock other common exports that might be used
export class DomainEvent {
  constructor(public readonly correlationId: string) {}
}

export class AggregateRoot<T> extends Entity<T> {
  private uncommittedEvents: DomainEvent[] = [];
  
  protected addDomainEvent(event: DomainEvent): void {
    this.uncommittedEvents.push(event);
  }
  
  getUncommittedEvents(): DomainEvent[] {
    return this.uncommittedEvents;
  }
  
  markEventsAsCommitted(): void {
    this.uncommittedEvents = [];
  }
}

// Mock command and query decorators
export function command() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    return descriptor;
  };
}

export function query() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    return descriptor;
  };
}

// Mock EventBus
export class EventBus {
  async publish(event: DomainEvent): Promise<void> {
    // Mock publish
  }
  
  subscribe(eventType: any, handler: (event: any) => void): void {
    // Mock subscribe
  }
}

// Mock CommandBus
export class CommandBus {
  async execute(command: any): Promise<any> {
    // Mock execute
    return Promise.resolve();
  }
  
  register(commandType: any, handler: (command: any) => Promise<any>): void {
    // Mock register
  }
}

// Mock QueryBus
export class QueryBus {
  async execute(query: any): Promise<any> {
    // Mock execute
    return Promise.resolve();
  }
  
  register(queryType: any, handler: (query: any) => Promise<any>): void {
    // Mock register
  }
}