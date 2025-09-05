# Contributing to MCP NextGen Financial Intelligence

Thank you for your interest in contributing to the MCP NextGen Financial Intelligence project! This document provides guidelines and information for contributors.

## 🌟 **Ways to Contribute**

### **Code Contributions**
- Bug fixes and improvements
- New AI analyst personas
- Additional AI provider integrations
- Performance optimizations
- Security enhancements

### **Documentation**
- API documentation improvements
- Setup and deployment guides
- Example implementations
- Translation of documentation

### **Testing & Quality Assurance**
- Bug reports with detailed reproduction steps
- Security vulnerability reports
- Performance testing and benchmarks
- Cross-platform compatibility testing

### **Community Support**
- Answering questions in Discord/Telegram
- Creating tutorials and guides
- Sharing use cases and examples

## 🚀 **Getting Started**

### **Development Setup**

1. **Fork and Clone**:
   ```bash
   git clone https://github.com/your-username/mcp-nextgen-financial-intelligence.git
   cd mcp-nextgen-financial-intelligence
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Environment Setup**:
   ```bash
   cp .env.example .env
   # Add your API keys for testing
   ```

4. **Build and Test**:
   ```bash
   npm run build
   npm start
   ```

### **Development Workflow**

1. **Create Feature Branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**:
   - Follow the existing code style
   - Add tests for new functionality
   - Update documentation as needed

3. **Test Your Changes**:
   ```bash
   npm run build
   npm run dev
   # Test both STDIO and HTTP modes
   ```

4. **Commit and Push**:
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   git push origin feature/your-feature-name
   ```

5. **Create Pull Request**:
   - Provide clear description of changes
   - Include test results
   - Reference any related issues

## 📋 **Development Guidelines**

### **Code Style**

- **TypeScript**: Use strict typing throughout
- **ESLint**: Follow existing linting rules
- **Formatting**: Use consistent indentation and spacing
- **Comments**: Add JSDoc comments for public APIs

### **Commit Messages**

Follow [Conventional Commits](https://conventionalcommits.org/) format:

```
type(scope): description

feat(analyst): add new crypto analyst persona
fix(security): resolve XSS vulnerability in input validation
docs(readme): update installation instructions
test(api): add comprehensive endpoint testing
```

**Types**: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `security`

### **Security Requirements**

- **Never commit API keys**: Use environment variables only
- **Input validation**: All user inputs must be validated with Zod
- **Error handling**: No internal details in user-facing errors  
- **Logging**: Ensure no sensitive data in logs
- **Dependencies**: Keep dependencies updated and secure

### **Testing Standards**

- **Unit Tests**: Test individual functions and components
- **Integration Tests**: Test API endpoints and workflows
- **Security Tests**: Validate input sanitization and rate limiting
- **Performance Tests**: Ensure acceptable response times

## 🛡️ **Security Policy**

### **Reporting Security Issues**

**DO NOT** create public issues for security vulnerabilities.

Instead:
1. Join our [Discord community](https://discord.com/channels/1413326280518140014/1413326281487155241)
2. Send a private message to administrators
3. Provide detailed reproduction steps
4. Allow time for assessment and patching

### **Security Guidelines for Contributors**

- Review the `SECURITY.md` file thoroughly
- Test for common vulnerabilities (XSS, injection, etc.)
- Validate all external inputs
- Use parameterized queries for database operations
- Implement proper authentication and authorization

## 🧪 **Testing Your Contributions**

### **Required Tests**

Before submitting a pull request:

1. **Build Test**:
   ```bash
   npm run build
   # Ensure no TypeScript errors
   ```

2. **Functionality Test**:
   ```bash
   npm start
   # Test STDIO mode
   
   npm run start:http  
   # Test HTTP mode on localhost:3001
   ```

3. **Security Test**:
   ```bash
   # Test with invalid inputs
   curl -X POST localhost:3001/tools/multi_analyst_consensus \
     -H "Content-Type: application/json" \
     -d '{"invalid": "data"}'
   ```

4. **Performance Test**:
   ```bash
   # Test concurrent requests
   for i in {1..10}; do curl localhost:3001/health & done
   ```

### **Test Environment**

- Use placeholder API keys for testing
- Test with both valid and invalid configurations
- Verify error handling and edge cases
- Test Docker deployment if making container changes

## 📝 **Documentation Standards**

### **Code Documentation**

```typescript
/**
 * Analyzes market sentiment using multiple AI analysts
 * @param newsItem - The news item to analyze
 * @param depth - Analysis depth: 'quick', 'standard', or 'deep'
 * @returns Promise with consensus analysis and confidence scores
 * @throws {ValidationError} When input parameters are invalid
 */
export async function analyzeMarketSentiment(
  newsItem: string, 
  depth: AnalysisDepth
): Promise<ConsensusResult> {
  // Implementation
}
```

### **API Documentation**

Update relevant documentation when adding/changing:
- New endpoints or parameters
- Response formats
- Error conditions
- Configuration options

## 🎯 **Contribution Areas**

### **High Priority**
- Additional AI provider integrations (Claude, Cohere)
- Enhanced security features
- Performance optimizations
- Better error handling

### **Medium Priority**  
- New analyst personas
- Advanced caching mechanisms
- WebSocket support for real-time updates
- Enhanced logging and monitoring

### **Enhancement Ideas**
- GraphQL API support
- Custom analyst persona creation
- Historical data analysis
- Advanced visualization tools

## 🤝 **Community Guidelines**

### **Code of Conduct**

- Be respectful and inclusive
- Provide constructive feedback
- Help newcomers and answer questions
- Focus on the technical merits of contributions
- Respect maintainer decisions and project direction

### **Communication Channels**

- **Discord**: [Join our community](https://discord.com/channels/1413326280518140014/1413326281487155241) for real-time discussions
- **Telegram**: [Follow updates](https://t.me/KaayaanAi) for announcements
- **GitHub Issues**: For bug reports and feature requests
- **GitHub Discussions**: For general questions and ideas

## 📊 **Recognition**

Contributors will be recognized in:
- Project README contributors section
- Release notes for significant contributions
- Community highlights in Discord/Telegram
- Special contributor badges

## ❓ **Questions?**

If you have questions about contributing:

1. Check existing documentation and issues
2. Ask in our [Discord community](https://discord.com/channels/1413326280518140014/1413326281487155241)
3. Create a GitHub Discussion for general questions
4. Open a GitHub Issue for specific bugs or features

## 📄 **License**

By contributing to this project, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing to MCP NextGen Financial Intelligence!**

**By: Kaayaan Ai**

*Together, we're building the future of AI-powered financial analysis.*