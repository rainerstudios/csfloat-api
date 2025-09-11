/**
 * Test setup file for Jest
 */

// Mock Chrome APIs
const mockChrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    },
    onInstalled: {
      addListener: jest.fn()
    }
  },
  storage: {
    local: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue({}),
      remove: jest.fn().mockResolvedValue({})
    }
  },
  tabs: {
    create: jest.fn()
  }
};

// @ts-ignore
global.chrome = mockChrome;

// Mock fetch
global.fetch = jest.fn();

// Mock DOM methods
Object.defineProperty(window, 'location', {
  value: {
    href: 'https://steamcommunity.com/market/listings/730/AK-47%20%7C%20Redline%20%28Field-Tested%29'
  },
  writable: true
});

// Mock console to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};