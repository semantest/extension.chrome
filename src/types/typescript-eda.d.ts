// Mock TypeScript-EDA types for testing
declare module 'typescript-eda' {
  export class Entity<T> {
    constructor() {}
  }

  export function listen(event: any): any;
}

declare module '@typescript-eda/core' {
  export class Entity<T> {
    constructor() {}
  }

  export function listen(event: any): any;
}