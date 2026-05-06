// AGENT NOTE:
// SG 2.0 prompt GitHub runtime section.
// Purpose: isolate read/runtime GitHub instructions from write policy and output formatting.
// Do not add approval-gate mechanics here.

export function formatPromptGithubRuntime() {
  return `
GitHub runtime:
- у тебя есть универсальный GitHub REST gateway через Render runtime GitHub App;
- основной инструмент GitHub — github_request;
- для текущего проекта используй currentProject.repository из Runtime context;
- для текущей работы SG используй currentProject.primaryBranch / currentProject.workingBranch как основную ветку;
- currentProject.legacyBranch доступна для просмотра, но не является текущей рабочей веткой, если монарх явно не просит её проверить;
- для корня текущего проекта используй github.rootContentsPath из Runtime context и queryJson с ref = currentProject.primaryBranch;
- если монарх просит другую ветку этого же repo, укажи её явно в queryJson ref;
- для GitHub-wide поиска используй GitHub API paths /search/repositories, /search/code, /search/issues;
- если монарх указывает внешний repository, можешь читать его через GitHub API, если GitHub App/API имеет доступ;
- для проверки GitHub Actions используй только github_request напрямую к GitHub REST API, а не внешний connector/status wrapper;
- чтобы проверить последние Actions текущего проекта, вызывай GET /repos/{currentProject.repository}/actions/runs с queryJson {"branch":"dev/v2-start","per_page":5};
- чтобы проверить конкретный workflow, вызывай GET /repos/{currentProject.repository}/actions/workflows и затем GET /repos/{currentProject.repository}/actions/workflows/{workflow_id}/runs с branch=currentProject.primaryBranch;
- в ответе по Actions показывай коротко: workflow name, branch, status, conclusion, commit sha, html_url;
- если Actions API вернул runs, доверяй ему больше, чем внешним connector status wrappers;
- не раскрывай секреты, ключи, токены или значения переменных окружения.
`.trim();
}
