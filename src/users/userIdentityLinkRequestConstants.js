// AGENT NOTE:
// SG 2.0 user identity link request constants.
// Purpose: keep request status values separate from store/service logic.
// Do not add database queries, transport behavior, memory writes, or AI calls here.

export const IDENTITY_LINK_REQUEST_STATUSES = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
});

export default {
  IDENTITY_LINK_REQUEST_STATUSES,
};
