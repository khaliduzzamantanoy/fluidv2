# Contributing to Fluid VPS Deployment Assistant

Thank you for your interest in contributing to Fluid! This document provides guidelines and instructions for contributing to the project.

## 🤝 How to Contribute

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When creating a bug report, include:

- **Clear description** of the problem
- **Steps to reproduce** the issue
- **Expected behavior** vs actual behavior
- **Environment details** (OS, Node.js version, etc.)
- **Screenshots** if applicable
- **Logs** or error messages

### Suggesting Enhancements

Enhancement suggestions are welcome! Please:

- Use a clear and descriptive title
- Provide a detailed description of the suggested enhancement
- Explain why this enhancement would be useful
- Provide examples of how the enhancement would be used

## 🛠️ Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Git

### Setting Up Development Environment

1. **Fork the repository**
   ```bash
   # Fork the repository on GitHub first
   git clone https://github.com/YOUR_USERNAME/fluidv2.git
   cd fluidv2
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Build for production**
   ```bash
   npm run build
   npm start
   ```

## 📝 Coding Standards

### Code Style

- Use TypeScript for type safety
- Follow existing code formatting
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused

### Frontend (Next.js/React)

- Use functional components with hooks
- Follow React best practices
- Use Tailwind CSS for styling
- Keep components modular and reusable
- Use proper TypeScript types

### Backend (Fastify)

- Follow Fastify conventions
- Use async/await for asynchronous operations
- Implement proper error handling
- Add input validation
- Use meaningful route names

## 🧪 Testing

Before submitting changes, ensure:

- **Code compiles** without errors
- **No console errors** in browser
- **Backend API endpoints** work correctly
- **Terminal functionality** works as expected
- **UI components** render properly

### Manual Testing Checklist

- [ ] GitHub authentication works
- [ ] Repository selection works
- [ ] Directory creation works
- [ ] Project detection works
- [ ] Dependency installation works
- [ ] Runtime configuration works
- [ ] Domain configuration works
- [ ] DNS checking works
- [ ] SSL setup works
- [ ] Nginx configuration works
- [ ] Terminal streaming works

## 📤 Pull Request Process

### Creating a Pull Request

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write clean, commented code
   - Follow coding standards
   - Test thoroughly

3. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

   Use conventional commit messages:
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation changes
   - `style:` for code style changes
   - `refactor:` for code refactoring
   - `test:` for test changes
   - `chore:` for maintenance tasks

4. **Push to your branch**
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Create Pull Request**
   - Go to the repository on GitHub
   - Click "New Pull Request"
   - Select your branch
   - Fill in the PR template
   - Submit the PR

### Pull Request Guidelines

- **One feature per PR"** - Keep changes focused
- **Clear description** - Explain what and why
- **Link to issues** - Reference related issues
- **Update documentation** - Keep docs in sync
- **No merge conflicts** - Resolve conflicts before PR

## 🎯 Areas for Contribution

### High Priority

- **Bug fixes** - Help squash bugs
- **Documentation** - Improve docs and examples
- **Testing** - Add automated tests
- **UI improvements** - Enhance user experience

### Feature Ideas

- **Additional framework support** - Add more framework detectors
- **Cloud provider support** - Support AWS, DigitalOcean, etc.
- **Database integration** - Auto-configure databases
- **Monitoring** - Add monitoring and alerting
- **Backup systems** - Automated backup solutions
- **CI/CD integration** - GitHub Actions, GitLab CI
- **Multi-language support** - Internationalization

### Code Quality

- **Refactoring** - Improve code structure
- **Performance** - Optimize slow operations
- **Security** - Enhance security measures
- **Error handling** - Better error messages and recovery

## 📖 Documentation

### Improving Documentation

- Keep documentation up-to-date
- Add examples for complex features
- Document API endpoints
- Create tutorials and guides
- Add screenshots where helpful

### Documentation Files

- `README.md` - Main project documentation
- `CONTRIBUTING.md` - Contribution guidelines (this file)
- `docs/` - Additional documentation
- Code comments - Inline documentation

## 🌟 Recognition

Contributors will be recognized in:
- Contributors section in README
- Release notes for significant contributions
- Project documentation

## 📜 License

By contributing to Fluid, you agree that your contributions will be licensed under the MIT License.

## 💬 Communication

- **GitHub Issues** - For bugs and feature requests
- **GitHub Discussions** - For questions and ideas
- **Pull Requests** - For code contributions

## 🚀 Getting Help

If you need help contributing:

1. Check existing issues and discussions
2. Read the documentation
3. Ask questions in GitHub Discussions
4. Join community channels (if available)

---

Thank you for contributing to Fluid! Your contributions help make VPS deployment easier for everyone.
