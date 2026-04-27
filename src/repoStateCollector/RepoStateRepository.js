// src/repoStateCollector/RepoStateRepository.js
// ============================================================================
// Repo State Repository
// Persistence layer for repo state (PostgreSQL).
// ============================================================================

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toJson(value) {
  return JSON.stringify(value || {});
}

function moduleKeyForPath(path = "", modules = []) {
  const normalizedPath = normalizeString(path).replace(/^\/+/, "");
  const sortedModules = [...modules]
    .filter((module) => module?.moduleKey)
    .sort((a, b) => String(b.moduleKey).length - String(a.moduleKey).length);

  const found = sortedModules.find((module) => normalizedPath.startsWith(`${module.moduleKey}/`) || normalizedPath === module.moduleKey);
  return found?.moduleKey || null;
}

export class RepoStateRepository {
  constructor({ pool } = {}) {
    this.pool = pool;
  }

  async saveSnapshot(snapshot) {
    if (!this.pool || typeof this.pool.connect !== "function") {
      return {
        ok: false,
        saved: false,
        error: "repo_state_repository_missing_pg_pool",
      };
    }

    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const repoFullName = normalizeString(snapshot?.repoFullName || "");
      const branch = normalizeString(snapshot?.branch || "main") || "main";
      const commitSha = normalizeString(snapshot?.commitSha || snapshot?.commit || "") || null;
      const files = Array.isArray(snapshot?.tree?.files) ? snapshot.tree.files : [];
      const modules = Array.isArray(snapshot?.modules) ? snapshot.modules : [];
      const dependencies = Array.isArray(snapshot?.dependencies) ? snapshot.dependencies : [];

      const scanRunResult = await client.query(
        `
        INSERT INTO repo_state_scan_runs (
          repo_full_name,
          branch,
          commit_sha,
          status,
          trigger_type,
          started_at,
          finished_at,
          files_count,
          modules_count,
          dependencies_count,
          error,
          metadata
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
        RETURNING id
        `,
        [
          repoFullName,
          branch,
          commitSha,
          snapshot?.ok ? "completed" : "failed",
          normalizeString(snapshot?.triggerType || "manual") || "manual",
          snapshot?.startedAt || new Date().toISOString(),
          snapshot?.finishedAt || new Date().toISOString(),
          Number(snapshot?.filesCount || files.length || 0),
          Number(snapshot?.modulesCount || modules.length || 0),
          Number(snapshot?.dependenciesCount || dependencies.length || 0),
          snapshot?.error || null,
          toJson({
            dependencyStats: snapshot?.dependencyStats || {},
            structureComplete: snapshot?.tree?.structureComplete === true,
            contentComplete: snapshot?.tree?.contentComplete === true,
            contentFilesLoaded: snapshot?.tree?.contentFilesLoaded || 0,
            contentFilesSkipped: snapshot?.tree?.contentFilesSkipped || 0,
          }),
        ]
      );

      const scanRunId = scanRunResult.rows?.[0]?.id;

      await client.query(
        `
        INSERT INTO repo_state_snapshots (
          scan_run_id,
          repo_full_name,
          branch,
          commit_sha,
          snapshot
        ) VALUES ($1,$2,$3,$4,$5::jsonb)
        `,
        [scanRunId, repoFullName, branch, commitSha, toJson(snapshot)]
      );

      for (const module of modules) {
        await client.query(
          `
          INSERT INTO repo_state_modules (
            scan_run_id,
            module_key,
            module_name,
            root_path,
            files_count,
            total_size,
            metadata
          ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
          `,
          [
            scanRunId,
            module.moduleKey,
            module.moduleName || module.moduleKey,
            module.rootPath || module.moduleKey,
            Number(module.filesCount || 0),
            Number(module.totalSize || 0),
            toJson({ files: module.files || [] }),
          ]
        );
      }

      for (const file of files) {
        await client.query(
          `
          INSERT INTO repo_state_files (
            scan_run_id,
            module_key,
            file_path,
            file_sha,
            file_size,
            extension,
            content_loaded,
            content_skipped,
            content_skip_reason,
            visible_in_repo_map,
            metadata
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
          `,
          [
            scanRunId,
            moduleKeyForPath(file.path, modules),
            file.path,
            file.sha || null,
            Number.isFinite(Number(file.size)) ? Number(file.size) : null,
            file.extension || null,
            file.contentLoaded === true,
            file.contentSkipped !== false,
            file.contentSkipReason || null,
            file.visibleInRepoMap !== false,
            toJson({
              type: file.type || null,
              contentError: file.contentError || null,
            }),
          ]
        );
      }

      for (const dependency of dependencies) {
        await client.query(
          `
          INSERT INTO repo_state_dependencies (
            scan_run_id,
            source_file,
            target_specifier,
            target_file,
            dependency_type,
            resolved,
            metadata
          ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
          `,
          [
            scanRunId,
            dependency.sourceFile,
            dependency.targetSpecifier,
            dependency.targetFile || null,
            dependency.dependencyType,
            dependency.resolved === true,
            toJson({}),
          ]
        );
      }

      await client.query("COMMIT");

      return {
        ok: true,
        saved: true,
        scanRunId,
        filesSaved: files.length,
        modulesSaved: modules.length,
        dependenciesSaved: dependencies.length,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        saved: false,
        error: error?.message || "repo_state_repository_save_failed",
      };
    } finally {
      client.release();
    }
  }
}

export default RepoStateRepository;
