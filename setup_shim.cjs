const dummyDoc = {
  documentElement: { style: {} },
  createElement: () => ({ style: {}, setAttribute: () => {} }),
  getElementsByTagName: () => [],
  createElementNS: () => ({ style: {} }),
  head: { appendChild: () => {} },
  body: { appendChild: () => {} }
};

const store = new Map();
const storageMock = {
  getItem: (key) => store.get(key) || null,
  setItem: (key, val) => store.set(key, String(val)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear()
};

global.window = {
  navigator: { userAgent: 'node' },
  requestAnimationFrame: (cb) => setTimeout(cb, 16),
  cancelAnimationFrame: (id) => clearTimeout(id),
  document: dummyDoc,
  screen: { deviceXDPI: 1, logicalXDPI: 1 },
  devicePixelRatio: 1,
  localStorage: storageMock,
  sessionStorage: storageMock,
  addEventListener: () => {},
  removeEventListener: () => {}
};
global.document = dummyDoc;
global.navigator = global.window.navigator;
global.screen = global.window.screen;
global.localStorage = storageMock;
global.sessionStorage = storageMock;
