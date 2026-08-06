import { createIdentityContext } from '../contracts/context.js';

function key(platform, platformUserId) {
  if (!platform || !platformUserId) throw new TypeError('platform and platformUserId are required');
  return `${platform}:${platformUserId}`;
}

function snapshot(user) {
  return Object.freeze({
    globalUserId: user.globalUserId,
    roles: Object.freeze([...user.roles]),
    grants: Object.freeze([...user.grants]),
    authenticationLevel: user.authenticationLevel
  });
}

export function createIdentityRegistry({ clock = () => new Date().toISOString() } = {}) {
  const users = new Map();
  const links = new Map();
  const audit = [];

  function record(event, details) {
    audit.push(Object.freeze({ event, at: clock(), ...details }));
  }

  return Object.freeze({
    registerUser({ globalUserId, roles = [], grants = [], authenticationLevel = 'verified' }) {
      if (typeof globalUserId !== 'string' || globalUserId.trim() === '') throw new TypeError('globalUserId is required');
      if (users.has(globalUserId)) throw new TypeError(`User already registered: ${globalUserId}`);
      const user = snapshot({ globalUserId, roles, grants, authenticationLevel });
      users.set(globalUserId, user);
      return user;
    },
    getUser(globalUserId) {
      return users.get(globalUserId) ?? null;
    },
    link({ globalUserId, platform, platformUserId, actorGlobalUserId, traceId }) {
      const user = users.get(globalUserId);
      if (!user) throw new TypeError(`Unknown global user: ${globalUserId}`);
      const linkKey = key(platform, platformUserId);
      const existing = links.get(linkKey);
      if (existing && existing !== globalUserId) throw new TypeError('Platform identity is already linked');
      links.set(linkKey, globalUserId);
      record('identity-linked', { globalUserId, platform, platformUserId, actorGlobalUserId, traceId });
      return createIdentityContext({ ...user, platform, platformUserId, linkStatus: 'linked' });
    },
    unlink({ platform, platformUserId, actorGlobalUserId, traceId }) {
      const linkKey = key(platform, platformUserId);
      const globalUserId = links.get(linkKey) ?? null;
      if (!globalUserId) return false;
      links.delete(linkKey);
      record('identity-unlinked', { globalUserId, platform, platformUserId, actorGlobalUserId, traceId });
      return true;
    },
    resolveLink(platform, platformUserId) {
      return links.get(key(platform, platformUserId)) ?? null;
    },
    listAudit() {
      return Object.freeze([...audit]);
    }
  });
}
