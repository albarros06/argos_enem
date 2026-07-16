/**
 * Design System: Component Token Audit Script
 * Scans all components for hardcoded values and token usage
 */

import fs from 'fs';
import path from 'path';

interface ComponentAnalysis {
  name: string;
  file: string;
  hardcodedValues: string[];
  tokenReferences: string[];
  coverage: number;
  issues: string[];
}

const HARDCODED_PATTERNS = [
  /#[0-9a-fA-F]{6}/g, // Hex colors
  /\b\d+px\b/g, // Pixel values
  /rgba?\([^)]+\)/g, // RGB/RGBA colors
  /\b(red|blue|green|yellow|orange|purple|white|black)\b/gi, // Color names
];

const TOKEN_PATTERN = /var\(--[a-z0-9-]+\)/g;

function analyzeFile(filePath: string): { hardcoded: string[]; tokens: string[] } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const hardcoded: string[] = [];
  const tokens: string[] = [];

  HARDCODED_PATTERNS.forEach((pattern) => {
    const matches = content.match(pattern) || [];
    hardcoded.push(...matches);
  });

  const tokenMatches = content.match(TOKEN_PATTERN) || [];
  tokens.push(...new Set(tokenMatches));

  return { hardcoded: [...new Set(hardcoded)], tokens };
}

function auditComponents(): ComponentAnalysis[] {
  const componentsDir = path.join(process.cwd(), 'src/components');
  const results: ComponentAnalysis[] = [];

  if (!fs.existsSync(componentsDir)) {
    console.warn('components directory not found');
    return results;
  }

  const componentDirs = fs
    .readdirSync(componentsDir)
    .filter((f) => fs.statSync(path.join(componentsDir, f)).isDirectory());

  componentDirs.forEach((componentName) => {
    const componentPath = path.join(componentsDir, componentName);
    const cssFile = path.join(componentPath, `${componentName}.module.css`);
    const tsxFile = path.join(componentPath, `${componentName}.tsx`);

    if (!fs.existsSync(cssFile)) return;

    const { hardcoded, tokens } = analyzeFile(cssFile);
    const coverage = tokens.length > 0 ? (tokens.length / (hardcoded.length + tokens.length)) * 100 : 0;
    const issues: string[] = [];

    if (hardcoded.length > 0) {
      issues.push(`Found ${hardcoded.length} hardcoded values`);
    }

    results.push({
      name: componentName,
      file: cssFile,
      hardcodedValues: hardcoded,
      tokenReferences: tokens,
      coverage: Math.round(coverage),
      issues,
    });
  });

  return results;
}

function generateReport(analyses: ComponentAnalysis[]): void {
  console.log('\n=== Component Token Audit Report ===\n');

  let totalComponents = 0;
  let componentsWithFullCoverage = 0;
  let allIssues: string[] = [];

  analyses.forEach((analysis) => {
    totalComponents++;
    const status = analysis.hardcodedValues.length === 0 ? '✅' : '⚠️';
    console.log(`${status} ${analysis.name}`);
    console.log(`   Coverage: ${analysis.coverage}%`);
    console.log(`   Tokens: ${analysis.tokenReferences.length}`);

    if (analysis.hardcodedValues.length > 0) {
      console.log(`   Hardcoded: ${analysis.hardcodedValues.slice(0, 3).join(', ')}`);
      console.log(`   Issues: ${analysis.issues.join('; ')}`);
    } else {
      componentsWithFullCoverage++;
    }
    console.log();
  });

  console.log(`Summary: ${componentsWithFullCoverage}/${totalComponents} components have 100% token coverage`);
  console.log(`Overall: ${Math.round((componentsWithFullCoverage / totalComponents) * 100)}% compliance\n`);
}

const analyses = auditComponents();
generateReport(analyses);

// Write report to file
const reportPath = path.join(process.cwd(), 'docs/component-audit-p6.md');
const reportContent = `# Component Token Audit Report (Phase 6)

**Generated**: ${new Date().toISOString()}
**Total Components**: ${analyses.length}
**Full Coverage**: ${analyses.filter((a) => a.hardcodedValues.length === 0).length}/${analyses.length}

## Detailed Analysis

${analyses
  .map(
    (a) => `
### ${a.name}
- **File**: ${a.file}
- **Token Coverage**: ${a.coverage}%
- **Token References**: ${a.tokenReferences.length}
- **Hardcoded Values**: ${a.hardcodedValues.length}
${a.hardcodedValues.length > 0 ? `  - Examples: ${a.hardcodedValues.slice(0, 5).join(', ')}` : '  - None (✅)'}
- **Status**: ${a.hardcodedValues.length === 0 ? '✅ PASS' : '⚠️ REVIEW'}
`;
  )
  .join('\n')}

## Recommendations

${analyses.filter((a) => a.hardcodedValues.length > 0).length > 0 ? 'The following components have hardcoded values and should be refactored to use design tokens:' : 'All components are using design tokens! ✅'}

${analyses
  .filter((a) => a.hardcodedValues.length > 0)
  .map((a) => `- ${a.name}`)
  .join('\n')}
`;

fs.writeFileSync(reportPath, reportContent);
console.log(`Report saved to: ${reportPath}`);
