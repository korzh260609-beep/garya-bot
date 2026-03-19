// src/bot/dispatchers/dispatchIdentityCommands.js
// Extracted 1:1 from commandDispatcher.js
// Purpose: keep commandDispatcher smaller without changing behavior.

import { handleLinkStart } from "../handlers/linkStart.js";
import { handleLinkConfirm } from "../handlers/linkConfirm.js";
import { handleLinkStatus } from "../handlers/linkStatus.js";
import { handleIdentityDiag } from "../handlers/identityDiag.js";
import { handleIdentityBackfill } from "../handlers/identityBackfill.js";
import { handleIdentityUpgradeLegacy } from "../handlers/identityUpgradeLegacy.js";
import { handleIdentityOrphans } from "../handlers/identityOrphans.js";
import { handleIdentityLegacyTg } from "../handlers/identityLegacyTg.js";
import { handleUsersStats } from "../handlers/usersStats.js";

import { handleGrant } from "../handlers/grant.js";
import { handleRevoke } from "../handlers/revoke.js";
import { handleGrants } from "../handlers/grants.js";

import { handleChatSetActive } from "../handlers/chatSetActive.js";
import { handleChatStatus } from "../handlers/chatStatus.js";

import { handleGroupSourceSet } from "../handlers/groupSourceSet.js";
import { handleGroupSources } from "../handlers/groupSources.js";
import { handleMySeenChats } from "../handlers/mySeenChats.js";
import { handleGroupSourceMeta } from "../handlers/groupSourceMeta.js";
import { handleGroupSourceTopicDiag } from "../handlers/groupSourceTopicDiag.js";

export async function dispatchIdentityCommands({ cmd0, ctx }) {
  const { bot, chatId, chatIdStr } = ctx;

  switch (cmd0) {
    case "/chat_on": {
      await handleChatSetActive({
        bot,
        chatId,
        chatIdStr,
        rest: ctx.rest,
        bypass: ctx.bypass,
        isActive: true,
      });
      return { handled: true };
    }

    case "/chat_off": {
      await handleChatSetActive({
        bot,
        chatId,
        chatIdStr,
        rest: ctx.rest,
        bypass: ctx.bypass,
        isActive: false,
      });
      return { handled: true };
    }

    case "/chat_status": {
      await handleChatStatus({
        bot,
        chatId,
        chatIdStr,
        rest: ctx.rest,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    case "/group_source_on": {
      await handleGroupSourceSet({
        bot,
        chatId,
        chatIdStr,
        rest: ctx.rest,
        bypass: ctx.bypass,
        sourceEnabled: true,
      });
      return { handled: true };
    }

    case "/group_source_off": {
      await handleGroupSourceSet({
        bot,
        chatId,
        chatIdStr,
        rest: ctx.rest,
        bypass: ctx.bypass,
        sourceEnabled: false,
      });
      return { handled: true };
    }

    case "/group_sources": {
      await handleGroupSources({
        bot,
        chatId,
        chatIdStr,
        rest: ctx.rest,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    case "/my_seen_chats": {
      await handleMySeenChats({
        bot,
        chatId,
        rest: ctx.rest,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    case "/group_source_meta": {
      await handleGroupSourceMeta({
        bot,
        chatId,
        rest: ctx.rest,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    case "/group_source_topic_diag": {
      await handleGroupSourceTopicDiag({
        bot,
        chatId,
        rest: ctx.rest,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    case "/grant": {
      await handleGrant({
        bot,
        chatId,
        rest: ctx.rest,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    case "/revoke": {
      await handleRevoke({
        bot,
        chatId,
        rest: ctx.rest,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    case "/grants": {
      await handleGrants({
        bot,
        chatId,
        rest: ctx.rest,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    case "/users_stats": {
      await handleUsersStats({
        bot,
        chatId,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    case "/identity_diag": {
      await handleIdentityDiag({
        bot,
        chatId,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    case "/identity_backfill": {
      await handleIdentityBackfill({
        bot,
        chatId,
        bypass: ctx.bypass,
        rest: ctx.rest,
      });
      return { handled: true };
    }

    case "/identity_upgrade_legacy": {
      await handleIdentityUpgradeLegacy({
        bot,
        chatId,
        bypass: ctx.bypass,
        rest: ctx.rest,
        senderIdStr: ctx.senderIdStr,
      });
      return { handled: true };
    }

    case "/identity_orphans": {
      await handleIdentityOrphans({
        bot,
        chatId,
        bypass: ctx.bypass,
        rest: ctx.rest,
      });
      return { handled: true };
    }

    case "/identity_legacy_tg": {
      await handleIdentityLegacyTg({
        bot,
        chatId,
        bypass: ctx.bypass,
        rest: ctx.rest,
      });
      return { handled: true };
    }

    case "/link_start": {
      const provider = ctx?.identityCtx?.transport || "telegram";
      await handleLinkStart({
        bot,
        chatId,
        senderIdStr: ctx.senderIdStr,
        provider,
      });
      return { handled: true };
    }

    case "/link_confirm": {
      const provider = ctx?.identityCtx?.transport || "telegram";
      await handleLinkConfirm({
        bot,
        chatId,
        senderIdStr: ctx.senderIdStr,
        rest: ctx.rest,
        provider,
      });
      return { handled: true };
    }

    case "/link_status": {
      const provider = ctx?.identityCtx?.transport || "telegram";
      await handleLinkStatus({
        bot,
        chatId,
        senderIdStr: ctx.senderIdStr,
        provider,
      });
      return { handled: true };
    }

    default:
      return { handled: false };
  }
}