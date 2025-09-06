# 🚀 GitHub Release Checklist

## Pre-Release Preparation

### ✅ Version Management

- [ ] Determine semantic versioning (MAJOR.MINOR.PATCH)
  - **MAJOR**: Breaking changes that require user code changes
  - **MINOR**: New features that are backward compatible
  - **PATCH**: Bug fixes that are backward compatible
- [ ] Update version in `package.json`
- [ ] Update version references in source code (`src/index.ts`, `src/http-server.ts`)
- [ ] Verify version consistency across all files

### ✅ Documentation Updates

- [ ] Update `CHANGELOG.md` with detailed changes
- [ ] Review and update `README.md`
  - [ ] New features and capabilities
  - [ ] Installation/usage instructions
  - [ ] API documentation changes
  - [ ] Performance improvements
  - [ ] Breaking changes (if any)
- [ ] Update `.env.example` with new configuration options
- [ ] Review and update security documentation

### ✅ Code Quality & Testing

- [ ] Run full build: `npm run build`
- [ ] Verify all tests pass
- [ ] Run pre-publish checks: `npm run pre-publish-check`
- [ ] Check TypeScript compilation: `tsc --noEmit`
- [ ] Verify executable permissions on build files
- [ ] Test both STDIO and HTTP modes

### ✅ Security & Configuration

- [ ] Review `.gitignore` for security
- [ ] Verify no sensitive data in repository
- [ ] Check `.npmignore` for proper package content
- [ ] Validate environment configuration examples
- [ ] Review dependency versions for security updates

### ✅ Release Content

- [ ] Create comprehensive release notes
- [ ] Document breaking changes (if any)
- [ ] Create migration guides (if needed)
- [ ] Update usage examples
- [ ] Document dependency changes
- [ ] Include performance benchmarks

## Release Process

### ✅ Git Operations

- [ ] Commit all changes with descriptive message
- [ ] Create annotated git tag: `git tag -a v[VERSION] -m "Release v[VERSION]"`
- [ ] Push commits: `git push origin main`
- [ ] Push tags: `git push origin --tags`

### ✅ GitHub Release

- [ ] Create GitHub release from tag
- [ ] Use comprehensive release notes template
- [ ] Upload any additional assets
- [ ] Mark as pre-release if applicable
- [ ] Publish release

### ✅ NPM Publication (if applicable)

- [ ] Verify NPM login: `npm whoami`
- [ ] Run publication check: `npm run pre-publish-check`
- [ ] Publish to NPM: `npm publish`
- [ ] Verify package on NPM registry

## Post-Release

### ✅ Verification

- [ ] Test installation from NPM
- [ ] Verify GitHub release assets
- [ ] Test downloading and setup from scratch
- [ ] Monitor for issues in first 24 hours

### ✅ Communication

- [ ] Announce on Discord community
- [ ] Post on Telegram channel
- [ ] Update any external documentation
- [ ] Notify key users of breaking changes

## Emergency Rollback Plan

### If Issues Are Found

- [ ] Unpublish from NPM if critical: `npm unpublish [package]@[version]`
- [ ] Delete GitHub release if critical
- [ ] Remove git tag if necessary: `git tag -d v[VERSION]`
- [ ] Fix issues and increment patch version
- [ ] Re-release with fixes

---

## 📌 Quick Reference

**Semantic Versioning Examples:**

- `2.0.1` → `2.0.2` (bug fixes)
- `2.0.1` → `2.1.0` (new features, backward compatible)
- `2.0.1` → `3.0.0` (breaking changes)

**Essential Commands:**

```bash
# Build and test
npm run build
npm run pre-publish-check

# Create release
git tag -a v2.0.1 -m "Release v2.0.1: Enhanced multi-provider AI system"
git push origin main --tags

# NPM publish
npm publish
```

**Files That Must Be Updated:**

- `package.json` (version)
- `CHANGELOG.md` (detailed changes)
- `README.md` (features, usage)
- Source code version references
- `.env.example` (new config options)
