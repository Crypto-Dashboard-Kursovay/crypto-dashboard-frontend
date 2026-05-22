import "@testing-library/jest-dom/vitest";

// Демо-режим («мок-данные») включён по умолчанию в проде, но в тестах api/виджетов
// мы хотим реальный путь через fetch (он мокается в самих тестах). Поэтому явно
// выключаем его здесь. Тест мок-стора при необходимости включает его сам.
try {
  localStorage.setItem("crypto.mock.enabled", "false");
} catch {
  // localStorage может быть недоступен в некоторых окружениях — не критично
}

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
