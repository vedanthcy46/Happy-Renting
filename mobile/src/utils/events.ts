type EventHandler = (...args: any[]) => void;

class SimpleEventEmitter {
  private listeners: Map<string, EventHandler[]> = new Map();

  on(event: string, handler: EventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);
  }

  off(event: string, handler: EventHandler): void {
    const handlers = this.listeners.get(event) || [];
    this.listeners.set(event, handlers.filter(h => h !== handler));
  }

  emit(event: string, ...args: any[]): void {
    const handlers = this.listeners.get(event) || [];
    handlers.forEach(h => h(...args));
  }
}

export const appEvents = new SimpleEventEmitter();
export const SESSION_EXPIRED_EVENT = 'SESSION_EXPIRED';
export const OPEN_DRAWER_EVENT = 'OPEN_DRAWER';
