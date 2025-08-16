# Cricket Platform API Integration Tests

This document describes the comprehensive integration test suite for the Cricket Platform API.

## Overview

The integration tests cover all API endpoints and workflows, ensuring the complete system works correctly from HTTP requests through to database operations. Tests use a real database (configured for testing) and test the full request/response cycle.

## Test Structure

### Test Files

| Test File | Coverage | Description |
|-----------|----------|-------------|
| `auth.integration.spec.ts` | Authentication | User registration, login, JWT validation, logout |
| `organizations.integration.spec.ts` | Organizations | CRUD operations for cricket organizations |
| `leagues.integration.spec.ts` | Leagues | League management with organization relationships |
| `teams.integration.spec.ts` | Teams | Team management with league/organization relationships |
| `players.integration.spec.ts` | Players | Player management and team assignments |
| `venues.integration.spec.ts` | Venues | Venue management for match locations |
| `matches.integration.spec.ts` | Match Management | Match creation, toss, start/completion workflows |
| `scoring.integration.spec.ts` | Cricket Scoring | Complex scoring workflows (innings, overs, balls, wickets) |

### Utility Files

- `test-setup.ts` - Application setup, database cleanup, and test utilities
- `test-helpers.ts` - Data creation helpers and common test patterns
- `jest-setup.ts` - Jest configuration and global test setup

## Test Coverage

### Authentication & Authorization ✅
- User registration with validation
- Login with email/password
- JWT token generation and validation
- Token refresh flows
- Protected route access
- User profile management

### Entity Management ✅
- **Organizations**: Create, read, update, delete with proper validation
- **Leagues**: CRUD with organization relationships and filtering
- **Teams**: CRUD with league/organization relationships, player assignments
- **Players**: CRUD with team assignments, profile management
- **Venues**: CRUD with match associations

### Match Management ✅
- Match creation with team/venue/league associations
- Toss conducting with proper validation
- Match state transitions (scheduled → live → completed)
- User assignments (scorers, umpires, captains)
- Match completion with result recording

### Cricket Scoring Workflows ✅
- **Innings Management**:
  - Starting innings with batting/bowling teams
  - Target setting for chase innings
  - Innings completion and declaration

- **Over Management**:
  - Starting overs with bowler assignment
  - Bowler rotation validation
  - Over completion tracking

- **Ball-by-Ball Scoring**:
  - Normal deliveries with runs
  - Boundaries (fours and sixes)
  - Extras (wides, no-balls, byes, leg-byes)
  - Free hits after no-balls
  - Ball sequence and numbering

- **Wicket Recording**:
  - All dismissal types (bowled, caught, LBW, run-out, stumped, etc.)
  - Proper attribution (bowler, fielder)
  - Run-out scenarios with batsman crossing

- **Scorecard Generation**:
  - Complete match scorecards
  - Batting statistics (runs, balls, fours, sixes, strike rate)
  - Bowling statistics (overs, runs, wickets, economy)
  - Match summary and results

### Data Integrity & Relationships ✅
- Foreign key constraints
- Cascade deletion handling
- Unique constraint validation
- Cross-entity relationship validation
- Business rule enforcement

## Running Tests

### Prerequisites
1. **Database Setup**: Ensure you have a test database configured
2. **Environment Variables**: Set up test environment variables
3. **Dependencies**: Install all required packages including `supertest`

### Commands

```bash
# Run all integration tests
npm run test:integration

# Run specific test file
npm run test:integration -- auth.integration.spec.ts

# Run tests with coverage
npm run test:integration -- --coverage

# Run tests in watch mode
npm run test:integration -- --watch

# Run tests with verbose output
npm run test:integration -- --verbose
```

### Test Configuration

Integration tests use a separate Jest configuration (`test-integration.config.ts`) with:
- Extended timeout (30 seconds) for complex operations
- Serial execution to avoid database conflicts
- Test-specific database cleanup
- Coverage reporting

## Test Data Management

### Test Helpers
The `TestDataHelper` class provides utilities for creating test data:

```typescript
const testHelper = new TestDataHelper(prisma);

// Create a complete test setup
const setup = await testHelper.createFullTestSetup();
// Returns: organization, user, league, teams, players, venue, match

// Create individual entities
const org = await testHelper.createOrganization();
const user = await testHelper.createUser(org.id);
const league = await testHelper.createLeague(org.id);
```

### Database Cleanup
Each test automatically cleans up after itself:
- All test data is removed after each test
- Foreign key relationships are handled properly
- Database state is reset between tests

## Test Patterns

### Authentication Setup
```typescript
// Standard pattern for authenticated requests
beforeEach(async () => {
  const organization = await testHelper.createOrganization();
  const user = await testHelper.createUser(organization.id);
  
  const loginResponse = await request(app)
    .post('/auth/login')
    .send({ email: user.email, password: 'password123' });
  
  accessToken = loginResponse.body.accessToken;
});
```

### API Testing Pattern
```typescript
const response = await request(app)
  .post('/endpoint')
  .set('Authorization', `Bearer ${accessToken}`)
  .send(testData)
  .expect(201);

expect(response.body).toMatchObject(expectedData);
```

### Complex Workflow Testing
```typescript
// Example: Complete cricket match scoring
it('should handle complete scoring workflow', async () => {
  // 1. Start innings
  const innings = await startInnings();
  
  // 2. Start over
  const over = await startOver(innings.id);
  
  // 3. Record balls
  for (const ball of ballSequence) {
    await recordBall(innings.id, ball);
  }
  
  // 4. Verify scorecard
  const scorecard = await getScorecard(match.id);
  expect(scorecard.totalRuns).toBe(expectedRuns);
});
```

## Test Data Examples

### Sample Test Scenarios

1. **T20 Match Workflow**:
   - Create teams with 11 players each
   - Set up T20 format (20 overs)
   - Complete toss and innings
   - Record full scoring including boundaries and wickets
   - Generate final scorecard

2. **Authentication Security**:
   - Test unauthorized access attempts
   - Validate token expiry
   - Test role-based access control

3. **Data Validation**:
   - Required field validation
   - Format validation (emails, dates)
   - Business rule validation (same team can't play itself)

4. **Edge Cases**:
   - Undo last ball functionality
   - Match abandonment scenarios
   - Tie and no-result situations

## Debugging Tests

### Common Issues
1. **Database Connection**: Ensure test database is running and accessible
2. **Test Isolation**: Tests should not depend on each other
3. **Async Operations**: Ensure all async operations are properly awaited
4. **Authentication**: Check token generation and validation

### Debug Commands
```bash
# Run single test with debug output
npm run test:integration -- --testNamePattern="should create user" --verbose

# Run with debugging
node --inspect-brk node_modules/.bin/jest --config=test-integration.config.ts

# Check test coverage
npm run test:integration -- --coverage --coverageReporters=text
```

## Continuous Integration

Integration tests should be run in CI/CD pipelines:
1. Set up test database
2. Run database migrations
3. Execute integration tests
4. Generate coverage reports
5. Clean up test environment

Example CI configuration:
```yaml
test-integration:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:13
      env:
        POSTGRES_PASSWORD: test
        POSTGRES_DB: cricket_test
  steps:
    - uses: actions/checkout@v2
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
    - name: Install dependencies
      run: npm ci
    - name: Run integration tests
      run: npm run test:integration
      env:
        DATABASE_URL: postgresql://postgres:test@localhost:5432/cricket_test
```

## Contributing

When adding new features:
1. Write integration tests for new endpoints
2. Update existing tests if endpoints change
3. Ensure tests cover error scenarios
4. Add appropriate test data helpers
5. Update this documentation

## Performance Considerations

- Tests run serially to avoid database conflicts
- Each test has a 30-second timeout
- Database cleanup is optimized for speed
- Test data is minimal but representative

For questions or issues with integration tests, please refer to the development team.
