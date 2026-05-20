import "@testing-library/jest-dom/vitest";

class ResizeObserverMock {
  private callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe(target: Element) {
    Promise.resolve().then(() => {
      this.callback(
        [{ contentRect: { width: 800, height: 400, x: 0, y: 0, top: 0, right: 800, bottom: 400, left: 0, toJSON() { return {}; } } }] as ResizeObserverEntry[],
        this as unknown as ResizeObserver,
      );
    });
  }
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
