export function makeReport() {
  return {
    ok: true,
    checks: [],
    addOk(name, details = "") {
      this.checks.push({ level: "OK", name, details });
    },
    addWarn(name, details = "") {
      this.ok = false; // WARNING считаем “не ок” для внимания
      this.checks.push({ level: "WARN", name, details });
    },
    addFail(name, details = "") {
      this.ok = false;
      this.checks.push({ level: "FAIL", name, details });
    },
  };
}

export function printReport(report, prefix = "DIAG") {
  const head = report.ok ? "✅" : "⚠️";
  console.log(`${head} ${prefix}: Diagnostics summary`);

  for (const c of report.checks) {
    const icon = c.level === "OK" ? "✅" : c.level === "WARN" ? "🟠" : "❌";
    const line = c.details ? `${c.name} — ${c.details}` : c.name;
    console.log(`${icon} ${prefix}: ${c.level} — ${line}`);
  }

  return report.ok;
}

