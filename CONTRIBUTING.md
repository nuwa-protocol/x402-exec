# Contributing to x402-exec

Thank you for your interest in contributing to x402-exec! We welcome contributions from the community.

## 🚀 Getting Started

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) for Solidity development
- Node.js 18+ for the showcase application
- Git for version control

### Setup Development Environment

```bash
# Clone the repository
git clone https://github.com/nuwa-protocol/x402-exec.git
cd x402-exec

# Install Foundry dependencies and build contracts
cd contracts
forge install
forge build

# Run tests to verify setup
forge test
```

## 🤝 How to Contribute

### Reporting Issues

- Use [GitHub Issues](https://github.com/nuwa-protocol/x402-exec/issues) to report bugs or suggest features
- Search existing issues before creating a new one
- Provide clear reproduction steps for bugs
- Include relevant contract addresses, transaction hashes, or error messages

### Submitting Changes

1. **Fork the repository** and create a new branch from `main`
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write clean, well-documented code
   - Follow the existing code style
   - Add tests for new features
   - Update documentation as needed

3. **Test your changes**
   ```bash
   # Run all tests
   forge test
   
   # Check gas usage
   forge test --gas-report
   
   # Check test coverage
   forge coverage
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```
   
   Use conventional commit messages:
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation changes
   - `test:` for test additions/changes
   - `refactor:` for code refactoring

5. **Push and create a Pull Request**
   ```bash
   git push origin feature/your-feature-name
   ```
   
   Then open a Pull Request on GitHub with:
   - Clear description of changes
   - Reference to related issues (if any)
   - Screenshots or examples (if applicable)

## 📝 Development Guidelines

### Solidity Contracts

- Follow [Solidity Style Guide](https://docs.soliditylang.org/en/latest/style-guide.html)
- Use OpenZeppelin contracts for standard functionality
- Write comprehensive NatSpec comments
- Follow CEI (Checks-Effects-Interactions) pattern
- Add reentrancy guards where appropriate
- Ensure all functions have appropriate visibility modifiers

### Testing

- Write unit tests for all new functions
- Include edge case testing
- Test for expected reverts
- Aim for high test coverage (>90%)

### Documentation

- Update README.md if adding new features
- Add NatSpec comments to all public/external functions
- Include usage examples for new Hooks
- Keep documentation in sync with code changes

## 🔧 Project Areas

### Core Contracts
- `SettlementRouter.sol` - Core settlement logic
- `ISettlementHook.sol` - Hook interface

### Hook Examples
- Add new Hook examples in `contracts/examples/`
- Each Hook should have:
  - Well-documented contract code
  - Comprehensive tests
  - Usage examples

### Documentation
- API documentation
- Integration guides
- Architecture explanations

## 🎯 Priority Areas

We especially welcome contributions in:

- 🧪 **Testing**: Increasing test coverage, adding edge cases
- 📚 **Documentation**: Improving guides, adding examples
- 🔌 **Hook Examples**: New creative use cases for Hooks
- ⚡ **Gas Optimization**: Making contracts more efficient
- 🔒 **Security**: Identifying and fixing vulnerabilities

## 📜 Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Assume good intentions

## 📄 License

By contributing, you agree that your contributions will be licensed under the Apache-2.0 License.

## 💬 Questions?

- Open a [GitHub Discussion](https://github.com/nuwa-protocol/x402-exec/discussions)
- File an [Issue](https://github.com/nuwa-protocol/x402-exec/issues) for bug reports or feature requests

---

Thank you for contributing to x402-exec! 🚀

