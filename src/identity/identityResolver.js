import { createIdentityContext } from '../contracts/context.js';

function required(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} is required`);
  return value;
}

export function createIdentityResolver({ registry } = {}) {
  if (!registry?.resolveLink || !registry?.getUser) throw new TypeError('identity registry is required');

  return Object.freeze({
    resolve({ platform, platformUserId, authenticationLevel = 'platform-reported' }) {
      required(platform, 'platform');
      required(platformUserId, 'platformUserId');
      const globalUserId = registry.resolveLink(platform, platformUserId);
      if (!globalUserId) {
        return createIdentityContext({
          globalUserId: `guest:${platform}:${platformUserId}`,
          platform,
          platformUserId,
          linkStatus: 'guest',
          roles: ['guest'],
          grants: [],
          authenticationLevel
        });
      }
      const user = registry.getUser(globalUserId);
      if (!user) throw new Error('Identity link points to an unknown global user');
      return createIdentityContext({ ...user, platform, platformUserId, linkStatus: 'linked' });
    }
  });
}
