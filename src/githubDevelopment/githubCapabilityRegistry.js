export const GITHUB_CAPABILITY_RISK_TIERS = Object.freeze([0, 1, 2, 3, 4]);

const DEFINITIONS = Object.freeze([
  ['github.discovery.public.read', 0, false],
  ['github.repository.read', 1, true],
  ['github.code.search', 1, true],
  ['github.branch.create', 2, true],
  ['github.contents.write', 2, true],
  ['github.commit.create', 2, true],
  ['github.pull-request.read', 1, true],
  ['github.pull-request.write', 2, true],
  ['github.review.read', 1, true],
  ['github.review.write', 2, true],
  ['github.issue.read', 1, true],
  ['github.issue.write', 2, true],
  ['github.actions.read', 1, true],
  ['github.actions.dispatch', 2, true],
  ['github.actions.rerun', 2, true],
  ['github.release.write', 3, true],
  ['github.repository.admin', 4, true]
]);

function freezeDefinition([name, riskTier, repositoryScopeRequired]) {
  return Object.freeze({
    name,
    riskTier,
    repositoryScopeRequired,
    protected: riskTier > 0,
    defaultDecision: riskTier === 0 ? 'read-only' : 'deny',
    separateConfirmationRequired: riskTier >= 3,
    grantsAuthority: false
  });
}

export const GITHUB_CAPABILITY_DEFINITIONS = Object.freeze(DEFINITIONS.map(freezeDefinition));

export function createGitHubCapabilityRegistry({ definitions = GITHUB_CAPABILITY_DEFINITIONS } = {}) {
  const entries = new Map();
  for (const definition of definitions) {
    if (!definition || typeof definition.name !== 'string' || !definition.name.startsWith('github.')) throw new TypeError('GitHub capability name is invalid');
    if (!GITHUB_CAPABILITY_RISK_TIERS.includes(definition.riskTier)) throw new TypeError(`Invalid risk tier for ${definition.name}`);
    if (entries.has(definition.name)) throw new TypeError(`GitHub capability already registered: ${definition.name}`);
    if (definition.riskTier >= 3 && definition.defaultDecision !== 'deny') throw new TypeError(`${definition.name} must default-deny`);
    entries.set(definition.name, Object.freeze({ ...definition, grantsAuthority: false }));
  }
  return Object.freeze({
    get(name) { return entries.get(name) ?? null; },
    list() { return Object.freeze([...entries.values()]); },
    require(name) {
      const definition = entries.get(name);
      if (!definition) throw new TypeError(`Unknown GitHub capability: ${name}`);
      return definition;
    }
  });
}
