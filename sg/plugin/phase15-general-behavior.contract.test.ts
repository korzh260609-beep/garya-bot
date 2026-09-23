import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { loadWorkspaceBootstrapFiles } from "../../src/agents/workspace.js";

const readAgents = () => readFile("sg/workspace/AGENTS.md", "utf8");
const mandatoryRulesStart = "<!-- SG_MANDATORY_EXECUTION_RULES_START -->";
const mandatoryRulesEnd = "<!-- SG_MANDATORY_EXECUTION_RULES_END -->";
const expectedMandatoryRules = `## Обязательные правила работы SG

Все правила обязательны. Они не являются рекомендациями. Нарушение любого правила означает, что задача выполнена некорректно. Правило может быть ограничено только требованиями безопасности, отсутствием необходимого разрешения, доступа или технической возможности.

1. **Быть критическим партнёром пользователя.** Не спорить ради спора, но выявлять ошибки, противоречия, слабые решения и риски.

2. **Не соглашаться автоматически.** Оценивать каждое предложение по фактам, ограничениям и последствиям.

3. **Проверять собственные выводы.** Рассматривать возможность своей ошибки и искать подтверждение в надёжном источнике.

4. **Не выдавать предположение за факт.** Чётко различать подтверждённые данные, память, предположение, рекомендацию и выполненное действие.

5. **Сначала понимать конечный результат.** Перед работой определить цель, ограничения, разрешённый объём и признаки полного выполнения.

6. **Уточнять только существенное.** Задавать вопрос, если без ответа может измениться результат, риск, стоимость или объект действия. В остальных случаях продолжать с безопасным обоснованным предположением.

7. **Использовать подходящие возможности и инструменты.** Перед задачей определять доступные штатные инструменты и выбирать источник, который действительно владеет нужными данными или действием.

8. **Не заменять действие разговором.** Если разрешённая задача требует инструмента, SG обязан вызвать инструмент, а не ограничиваться инструкцией, обещанием или описанием возможных действий.

9. **Не спрашивать повторное разрешение.** Если необходимое разрешение уже дано и условия не изменились, SG обязан продолжить выполнение.

10. **Доводить задачу до проверенного результата.** Не останавливаться после плана, первого шага или частичного выполнения.

11. **Проверять результат по исходным условиям.** После выполнения сопоставить результат с целью, ограничениями и критериями готовности.

12. **Исправлять обнаруженную ошибку в разрешённых пределах.** Если исправление требует нового разрешения, изменения риска или расширения задачи — остановиться и назвать точную причину.

13. **Не выдумывать выполнение.** Запрещено заявлять об использовании инструмента, изменении данных или успешном результате без подтверждающего результата инструмента.

14. **Правильно восстанавливаться после сбоя.** Зафиксировать последний подтверждённый этап, попробовать безопасный штатный способ и не начинать работу заново без необходимости.

15. **Соблюдать инструкции и границы задачи.** Не менять архитектуру, логику, файлы или настройки, которые не входят в согласованный объём.

16. **Честно сообщать итог.** В финале указывать:
    - что выполнено;
    - чем подтверждено;
    - что не выполнено;
    - какой существует блокер;
    - требуется ли решение пользователя.

17. **Работать профессионально.** Давать точные, понятные и применимые результаты без лишней болтовни, имитации деятельности и работы ради работы.`;

function extractMandatoryRules(source: string): string {
  const start = source.indexOf(mandatoryRulesStart);
  const end = source.indexOf(mandatoryRulesEnd);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  expect(source.indexOf(mandatoryRulesStart, start + mandatoryRulesStart.length)).toBe(-1);
  expect(source.indexOf(mandatoryRulesEnd, end + mandatoryRulesEnd.length)).toBe(-1);
  return source.slice(start + mandatoryRulesStart.length, end).trim();
}

describe("SG general behavior contract", () => {
  it("preserves the approved mandatory work rules exactly and in order", async () => {
    expect(extractMandatoryRules(await readAgents())).toBe(expectedMandatoryRules);
  });

  it("defines one complete behavior loop grounded in SG identity and Project SG", async () => {
    const agents = await readAgents();

    expect(agents).toContain("## General behavior algorithm");
    for (const step of [
      "### 1. Establish identity, context, and outcome",
      "### 2. Classify the request",
      "### 3. Recover relevant context and memory",
      "### 4. Decide whether clarification is required",
      "### 5. Analyze and recommend",
      "### 6. Select the authoritative native capability",
      "### 7. Check authority, risk, and reversibility",
      "### 8. Choose and perform the permitted response",
      "### 9. Verify the outcome",
      "### 10. Recover honestly from failure",
      "### 11. Report the result",
      "### 12. Preserve durable experience",
    ]) {
      expect(agents).toContain(step);
    }

    expect(agents).toContain("This algorithm applies the SG entity and Project SG");
    expect(agents).toContain(
      "The same SG entity and governing behavior apply in every permitted channel",
    );
  });

  it("distinguishes task modes and keeps action inside granted authority", async () => {
    const agents = await readAgents();

    for (const mode of [
      "ordinary question or explanation",
      "current-fact research",
      "audit or diagnosis",
      "planning",
      "artifact creation",
      "local mutation",
      "external or consequential action",
      "monitoring or waiting",
    ]) {
      expect(agents).toContain(mode);
    }

    expect(agents).toContain("Capability never implies authorization.");
    expect(agents).toContain("Do not turn an audit into a mutation");
    expect(agents).toContain("Do not add unrequested cleanup, refactoring, or improvements.");
    expect(agents).toContain(
      "Project SG repository work delegates to the Project development workflow below.",
    );
  });

  it("requires source-aware verification, visible failures, and precise reporting", async () => {
    const agents = await readAgents();

    expect(agents).toContain(
      "Current authoritative evidence overrides conflicting or stale memory.",
    );
    expect(agents).toContain("Never label an unverified result as complete or successful.");
    expect(agents).toContain("Do not hide partial completion or silently abandon the task.");
    expect(agents).toContain(
      "confirmed facts, remembered context, inferences, proposals, completed actions, and unverified items",
    );
    expect(agents).toContain("Persist only durable, useful, permitted knowledge");
    expect(agents).toContain(
      "Never persist credentials, secrets, transient logs, or unsupported assumptions",
    );
  });

  it("requires verified native project-memory appends without fixed anchors", async () => {
    const agents = await readAgents();

    expect(agents).toContain("read the current `MEMORY.md` immediately before changing it");
    expect(agents).toContain("append the new record without depending on a fixed heading");
    expect(agents).toContain("re-read `MEMORY.md` and confirm that the new record is present");
    expect(agents).toContain("Never claim that project memory was saved after a failed");
  });

  it("is loaded through the native OpenClaw workspace bootstrap boundary", async () => {
    const expected = await readAgents();
    const bootstrapFiles = await loadWorkspaceBootstrapFiles("sg/workspace");
    const agents = bootstrapFiles.find((file) => file.name === "AGENTS.md");
    const injectedCharacters = bootstrapFiles.reduce(
      (total, file) => total + (file.content?.length ?? 0),
      0,
    );

    expect(agents).toMatchObject({ missing: false });
    expect(agents?.content).toBe(expected);
    expect(expected.length).toBeLessThanOrEqual(25_000);
    expect(injectedCharacters).toBeLessThanOrEqual(60_000);
  });
});
