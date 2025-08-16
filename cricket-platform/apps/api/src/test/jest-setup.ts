/**
 * Jest setup file for integration tests
 * This file runs before each test suite
 */

// Increase timeout for integration tests
jest.setTimeout(30000);

// Global test environment setup
beforeAll(() => {
  // Set test environment variables if needed
  process.env.NODE_ENV = 'test';
  
  // You can add global setup here such as:
  // - Database connection setup
  // - Test data seeding
  // - Environment configuration
});

afterAll(() => {
  // Global cleanup
  // Close database connections, etc.
});

// Add any global test utilities or matchers here
expect.extend({
  // Custom matchers can be added here
});
