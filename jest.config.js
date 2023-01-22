module.exports = {
  clearMocks: true,
  collectCoverageFrom: ['src/**.ts'],
  coverageDirectory: 'coverage',
  maxWorkers: 1,
  moduleFileExtensions: ['js', 'ts'],
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  testRunner: 'jest-circus/runner',
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  verbose: true
}
