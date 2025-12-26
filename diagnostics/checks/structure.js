import fs from "fs";
import path from "path";

export function checkStructure(report, options = {}) {
  const rootDir = options.rootDir || process.cwd();

  const srcDir = path.join(rootDir, "src");
  const nestedSrcDir = path.join(rootDir, "src", "src");
  const indexPath = path.join(rootDir, "index.js");
  const pkgPath = path.join(rootDir, "package.json");

  // 1) index.js exists
  if (fs.existsSync(indexPath)) {
    report.addOk("index.js exists");
  } else {
    report.addFail("index.js missing", `Expected at: ${indexPath}`);
  }

  // 2) package.json exists
  if (fs.existsSync(pkgPath)) {
    report.addOk("package.json exists");
  } else {
    report.addFail("package.json missing", `Expected at: ${pkgPath}`);
  }

  // 3) src/src must NOT exist
  if (fs.existsSync(nestedSrcDir)) {
    report.addFail("Found forbidden folder src/src", `Path: ${nestedSrcDir}`);
  } else {
    report.addOk("No src/src folder");
  }

  // 4) src optional, but if present, must be a dir
  if (fs.existsSync(srcDir)) {
    const stat = fs.statSync(srcDir);
    if (stat.isDirectory()) report.addOk("src/ is a directory");
    else report.addFail("src exists but is not a directory", `Path: ${srcDir}`);
  } else {
    report.addWarn("src/ folder not found", "This is OK if you use root-only layout.");
  }
}

