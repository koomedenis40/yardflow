/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '../..',
  testMatch: ['<rootDir>/apps/api/test/**/*.unit.spec.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/apps/api/tsconfig.json',
        diagnostics: false,
      },
    ],
  },
  moduleNameMapper: {
    '^@yardflow/types$': '<rootDir>/packages/types/dist/index.js',
    '^@yardflow/validation$': '<rootDir>/packages/validation/dist/index.js',
    '^@yardflow/utils$': '<rootDir>/packages/utils/dist/index.js',
  },
  collectCoverageFrom: ['<rootDir>/apps/api/src/**/*.(t|j)s'],
  coverageDirectory: '<rootDir>/apps/api/coverage',
  testEnvironment: 'node',
};
