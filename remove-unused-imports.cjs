const ts = require('typescript');
const fs = require('fs');

function cleanUnusedImportsInFile(filePath, unusedSymbols, dryRun = true) {
  let content = fs.readFileSync(filePath, 'utf8');
  let sf = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

  const unusedSet = new Set(unusedSymbols);
  let modified = false;

  // Collect import declarations
  const importsToProcess = [];
  sf.forEachChild(node => {
    if (ts.isImportDeclaration(node) && node.importClause) {
      importsToProcess.push(node);
    }
  });

  // Process imports from bottom to top to preserve offsets
  importsToProcess.reverse();

  for (const importDecl of importsToProcess) {
    const clause = importDecl.importClause;
    if (!clause) continue;

    const defaultImport = clause.name;
    const namedBindings = clause.namedBindings;

    // Check if default import is unused
    let removeDefault = false;
    if (defaultImport && unusedSet.has(defaultImport.text)) {
      removeDefault = true;
    }

    if (namedBindings && ts.isNamedImports(namedBindings)) {
      const remainingElements = [];
      const removedElements = [];

      for (const element of namedBindings.elements) {
        const symbolName = element.name.text;
        if (unusedSet.has(symbolName)) {
          removedElements.push(element);
        } else {
          remainingElements.push(element);
        }
      }

      if (removedElements.length > 0) {
        modified = true;
        const start = importDecl.getStart(sf);
        const end = importDecl.getEnd();

        // If no elements remain
        if (remainingElements.length === 0) {
          if (!defaultImport || removeDefault) {
            // Remove entire import statement including trailing semicolon and newline
            let fullEnd = end;
            while (fullEnd < content.length && (content[fullEnd] === ';' || content[fullEnd] === ' ')) {
              fullEnd++;
            }
            if (content[fullEnd] === '\r') fullEnd++;
            if (content[fullEnd] === '\n') fullEnd++;

            content = content.slice(0, start) + content.slice(fullEnd);
          } else {
            // Keep only default import: import React from 'react';
            const moduleSpecifier = importDecl.moduleSpecifier.getText(sf);
            const isTypeOnly = clause.isTypeOnly ? 'type ' : '';
            const newImportText = `import ${isTypeOnly}${defaultImport.text} from ${moduleSpecifier};`;
            content = content.slice(0, start) + newImportText + content.slice(end);
          }
        } else {
          // Some elements remain: reconstruct named imports cleanly
          const moduleSpecifier = importDecl.moduleSpecifier.getText(sf);
          const isTypeOnly = clause.isTypeOnly ? 'type ' : '';
          const defaultPart = defaultImport && !removeDefault ? `${defaultImport.text}, ` : '';
          
          // Format remaining elements nicely
          const elementsText = remainingElements.map(el => el.getText(sf));
          let newImportText;
          if (elementsText.length <= 3 && elementsText.join(', ').length < 60) {
            newImportText = `import ${isTypeOnly}${defaultPart}{ ${elementsText.join(', ')} } from ${moduleSpecifier};`;
          } else {
            newImportText = `import ${isTypeOnly}${defaultPart}{\n  ${elementsText.join(',\n  ')},\n} from ${moduleSpecifier};`;
          }
          
          // Check if there was a semicolon after end
          let fullEnd = end;
          if (content[fullEnd] === ';') fullEnd++;
          content = content.slice(0, start) + newImportText + content.slice(fullEnd);
        }

        // Re-parse source file after string modification
        sf = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
      }
    } else if (defaultImport && removeDefault && !namedBindings) {
      // Only default import, and it's unused
      modified = true;
      const start = importDecl.getStart(sf);
      let fullEnd = importDecl.getEnd();
      while (fullEnd < content.length && (content[fullEnd] === ';' || content[fullEnd] === ' ')) {
        fullEnd++;
      }
      if (content[fullEnd] === '\r') fullEnd++;
      if (content[fullEnd] === '\n') fullEnd++;

      content = content.slice(0, start) + content.slice(fullEnd);
      sf = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
    }
  }

  if (modified && !dryRun) {
    fs.writeFileSync(filePath, content, 'utf8');
  }

  return { modified, content };
}

module.exports = { cleanUnusedImportsInFile };

if (require.main === module) {
  const report = JSON.parse(fs.readFileSync('dead_code_report.json', 'utf8'));
  let totalModified = 0;
  for (const [file, items] of Object.entries(report.files)) {
    const symbols = items.map(i => i.symbol);
    const { modified } = cleanUnusedImportsInFile(file, symbols, false);
    if (modified) {
      totalModified++;
      console.log(`Cleaned imports in: ${file}`);
    }
  }
  console.log(`Finished. Cleaned imports in ${totalModified} files.`);
}
