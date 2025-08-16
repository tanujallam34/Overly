/**
 * Cricket Platform Integration Tests
 * 
 * This directory contains comprehensive integration tests for the cricket platform API.
 * Tests are organized by module and cover full workflows including:
 * 
 * 1. Authentication & Authorization
 * 2. CRUD operations for all entities
 * 3. Complex cricket scoring workflows
 * 4. Data relationships and integrity
 * 
 * Test Files:
 * - auth.integration.spec.ts - Authentication flows (register, login, JWT)
 * - organizations.integration.spec.ts - Organization management
 * - leagues.integration.spec.ts - League management with organization relationships
 * - teams.integration.spec.ts - Team management with league/organization relationships
 * - players.integration.spec.ts - Player management and team assignments
 * - venues.integration.spec.ts - Venue management
 * - matches.integration.spec.ts - Match creation, toss, start/completion
 * - scoring.integration.spec.ts - Complex scoring workflows (innings, overs, balls, wickets)
 * 
 * Test Utilities:
 * - test-setup.ts - Test application setup and cleanup utilities
 * - test-helpers.ts - Data creation helpers and common test utilities
 * 
 * To run all integration tests:
 * npm test
 * 
 * To run specific test suites:
 * npm test -- auth.integration.spec.ts
 * npm test -- scoring.integration.spec.ts
 * 
 * To run tests with coverage:
 * npm test -- --coverage
 */

export * from './test-setup';
export * from './test-helpers';
