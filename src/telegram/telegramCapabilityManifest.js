import { createCapabilityManifest } from '../capability/capabilityManifest.js';

export const TELEGRAM_CAPABILITY_MANIFEST = createCapabilityManifest({
  sourceId: 'subsystem:telegram',
  domain: 'telegram',
  sourceOfTruth: 'src/telegram',
  supportedTransports: ['telegram'],
  capabilities: [
    { id: 'telegram.direct.conversation', description: 'Handle private Telegram conversations.' },
    { id: 'telegram.group.observe', description: 'Observe group activity under configured reply policy.' },
    { id: 'telegram.group.reply-routing', description: 'Reply on mention, reply, command and authorized semantic triggers.' },
    { id: 'telegram.group.multi-user', description: 'Preserve participant-aware group behavior and scoped identity.' },
    { id: 'telegram.channel.publish', description: 'Publish authorized content to connected Telegram channels.', requiresAuthorization: true },
    { id: 'telegram.polls-tests', description: 'Run Telegram polls/tests with participant-aware flows.' },
    { id: 'telegram.membership.manage', description: 'Manage observed membership state under Telegram/API constraints.', requiresAuthorization: true },
    { id: 'telegram.join-requests.manage', description: 'Handle managed join requests and access flows.', requiresAuthorization: true },
    { id: 'telegram.join-links.manage', description: 'Create, show and replace managed join links.', requiresAuthorization: true },
    { id: 'telegram.subscription.lifecycle', description: 'Subscription-related membership lifecycle support.', status: 'partial', requiresAuthorization: true }
  ]
});
