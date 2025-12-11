// Jest setup file for test environment configuration
// Add any global test setup, mocks, or utilities here

// Node 18+ provides TextEncoder/TextDecoder via util; ensure they exist in JSDOM.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { TextEncoder, TextDecoder } = require('node:util');
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder;
}

// Provide WHATWG fetch classes when running in JSDOM so Next server helpers load.
if (typeof global.Request === 'undefined' || typeof global.Response === 'undefined') {
  // undici is bundled with Node >=18
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const undici = require('undici');
  if (typeof global.Request === 'undefined') global.Request = undici.Request;
  if (typeof global.Response === 'undefined') global.Response = undici.Response;
  if (typeof global.Headers === 'undefined') global.Headers = undici.Headers;
  if (typeof global.FormData === 'undefined') global.FormData = undici.FormData;
}
