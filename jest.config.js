module.exports = {
    preset: "ts-jest",
    testEnvironment: 'jsdom',
    moduleDirectories: ['node_modules', 'src'],
    moduleNameMapper: {
        "data/import/import-manager": "test/mocks/import-manager.ts",
        "obsidian": "test/mocks/obsidian.ts"
    }
};
