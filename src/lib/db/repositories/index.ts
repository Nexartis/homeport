/**
 * Repository Index — Central export for all database repositories.
 *
 * Usage:
 *   import { upsertAgent, getCertJob } from '$lib/db/repositories';
 */

// ===================================================================
// Registry Repository
// ===================================================================

export {
	upsertAgent,
	getAgentById,
	listAllAgents,
	searchAgents,
	deleteAgent,
	updateAgentStatus,
	getAgentStats,
	getAliveAgents,
	getAgentUrl,
	upsertAgentFacts,
	getAgentFacts,
	// Version-aware queries (Phase 4 — Agent Alpha)
	getAgentByVersion,
	updateAgentVersion,
	// AgentFacts v2 extensions (Phase 6 — Agent Bali)
	upsertAgentFactsV2,
	updateAgentFactsV2Metadata
} from './registry';

// ===================================================================
// Certifier Repository
// ===================================================================

export {
	insertCertJob,
	updateCertJobStatus,
	updateCertJobComplete,
	getCertJob,
	getJobStatus,
	incrementCompletedTrials,
	getCompletedTrialCount,
	checkTrialExists,
	insertTrialResult,
	getTrialResultsForJob,
	getCertificateCount,
	insertCertificate,
	getCertificateById,
	getLatestCertScore,
	getLatestCertGrades,
	getCertificateExists,
	getRevocation,
	getMaxRevocationIndex,
	insertRevocation,
	getAllRevocationIndices,
	getRevocationStats
} from './certifier';

// ===================================================================
// Compliance Repository
// ===================================================================

export { getPolicyRules, insertDecision, insertViolation } from './compliance';

// ===================================================================
// Observer Repository
// ===================================================================

export {
	insertTelemetryEvent,
	aggregateHealth,
	getRecentLatencies,
	insertProbeRun,
	getLatestProbeRun,
	getRecentProbeRun,
	insertReputationSnapshot,
	getRecentReputationSnapshot,
	getLatestReputations
} from './observer';

// ===================================================================
// Auditor Repository
// ===================================================================

export {
	insertIntent,
	getIntentById,
	findOpenIntents,
	updateIntentStatus,
	getExpiredOpenIntents,
	insertSettlement,
	ensureWallets,
	updateWalletBalances,
	getWalletBalance,
	insertReconciliation,
	getReconciliationByIntent,
	sweepExpiredIntent
} from './auditor';

// ===================================================================
// Developer Keys Repository
// ===================================================================

export {
	generateDevApiKey,
	validateDevApiKey,
	getDevApiKeyById,
	listDevApiKeys,
	revokeDevApiKey,
	incrementDevKeyUsage
} from './developer-keys';

export type {
	ApiKeyTier,
	ApiKeyStatus,
	GeneratedApiKey,
	ValidatedApiKey,
	ValidateApiKeyResult,
	ApiKeyRateLimited
} from './developer-keys';

// ===================================================================
// Trust Repository (Phase 3 — Agent Alpha)
// ===================================================================

export {
	upsertFederationTrustScore,
	getFederationTrustScores,
	getAllFederationTrustScores,
	upsertCrossRegistryScore,
	getCrossRegistryScore,
	getAllCrossRegistryScores
} from './trust';

// ===================================================================
// Trust Framework Repository (Phase 3 — Agent Gamma)
// ===================================================================

export {
	upsertTrustFramework,
	getAllTrustFrameworks,
	getTrustFrameworkById,
	upsertTrustEdge,
	getTrustEdgesForDid,
	getOutgoingEdges,
	getAllTrustEdges
} from './trust-framework';

// ===================================================================
// Versioning Repository (Phase 4 — Agent Alpha)
// ===================================================================

export {
	insertAgentVersion,
	getAgentVersion,
	listAgentVersions,
	updateVersionStatus,
	getActiveVersions
} from './versioning';

// ===================================================================
// Webhook Repository (Phase 4 — Agent Beta)
// ===================================================================

export {
	insertWebhookSubscription,
	getWebhookSubscription,
	listWebhookSubscriptions,
	listActiveSubscriptionsForEvent,
	updateWebhookSubscription,
	deleteWebhookSubscription,
	incrementFailureCount,
	resetFailureCount,
	updateLastDelivered,
	disableSubscription
} from './webhooks';

// ===================================================================
// Deprecation Repository (Phase 4 — Agent Gamma)
// ===================================================================

export {
	getDeprecatedAgents,
	getSunsetExpiredAgents,
	getAgentDeprecationInfo,
	getDeprecatedAndTombstonedAgents,
	markAgentDeprecated,
	tombstoneAgentRecord
} from './deprecation';

// ===================================================================
// Billing Repository (Phase 5 — Agent Bravo)
// ===================================================================

export {
	createBillingPeriod,
	getBillingPeriod,
	getOpenPeriodForKey,
	closeBillingPeriod,
	incrementUsage,
	updateOverage,
	addLineItem,
	getLineItems,
	listPeriods,
	getExpiredOpenPeriods
} from './billing';

// ===================================================================
// Revenue Repository (Phase 5 — Agent Bravo)
// ===================================================================

export {
	createRevenueSplit,
	getRevenueSplit,
	getActiveSplitsForAgent,
	getActiveSplitsForDeveloper,
	deactivateSplit,
	createRevenueShare,
	getSharesForSplit,
	getPendingSharesForDeveloper,
	markSharesSettled,
	createSettlement,
	getSettlementsForDeveloper,
	completeSettlement
} from './revenue';

// ===================================================================
// Subscription Repository (Phase 5 — Agent Charlie)
// ===================================================================

export {
	createSubscription,
	getSubscriptionById,
	getActiveSubscription,
	getExpiringSubscriptions,
	updateSubscription,
	updateSubscriptionStatus,
	logSubscriptionEvent,
	getSubscriptionEvents
} from './subscriptions';

// ===================================================================
// Invoice Repository (Phase 5 — Agent Charlie)
// ===================================================================

export {
	generateInvoiceNumber,
	createInvoice,
	getInvoiceById,
	getInvoiceByNumber,
	getInvoicesForKey,
	getInvoicesForPeriod,
	updateInvoiceStatus
} from './invoices';

// ===================================================================
// AgentAddr Repository (Phase 6 — Agent Bali)
// ===================================================================

export {
	upsertAgentAddr,
	getAgentAddr,
	listAgentAddrs,
	getAgentAddrsBySource,
	deleteAgentAddr,
	countAgentAddrs,
	getExpiredAgentAddrs
} from './agent-addrs';

// ===================================================================
// Resolution Log + Protocol Adapters Repository (Phase 6 — Agent California)
// ===================================================================

export {
	insertResolutionLog,
	getResolutionLogs,
	getResolutionStats,
	upsertProtocolAdapter,
	getProtocolAdapters,
	getProtocolAdapter,
	deleteProtocolAdapters
} from './resolution-log';

// ===================================================================
// Orchestration Repository (Phase 6 — Sprint 13)
// ===================================================================

export {
	createWorkflow,
	getWorkflowById,
	listWorkflowsByOwner,
	listWorkflowsByStatus,
	updateWorkflow,
	deleteWorkflow,
	deleteWorkflowCascade,
	createWorkflowStep,
	createWorkflowSteps,
	getWorkflowSteps,
	deleteWorkflowSteps,
	createWorkflowRun,
	getWorkflowRunById,
	listWorkflowRuns,
	updateWorkflowRun,
	createWorkflowStepRun,
	getStepRunsForRun,
	updateWorkflowStepRun,
	createPattern,
	getPatternById,
	listPatternsByCategory,
	listAllPatterns,
	listBuiltinPatterns,
	incrementPatternUsage,
	deletePattern
} from './orchestration';

// ===================================================================
// Delegation & Routing Repository (Phase 6 — Sprint 14)
// ===================================================================

export {
	createDelegationTask,
	getDelegationTaskById,
	listDelegationsByDelegator,
	listDelegationsByDelegate,
	listDelegationsByWorkflow,
	listDelegationsByStatus,
	updateDelegationTask,
	deleteDelegationTask,
	createRoutingDecision,
	getRoutingDecisionById,
	listRoutingDecisionsBySource,
	listRoutingDecisionsByAction,
	updateRoutingDecisionOutcome
} from './delegation';

// ===================================================================
// Real-time & Conflict Resolution Repository (Phase 6 — Sprint 15)
// ===================================================================

export {
	createWorkflowEvent,
	getWorkflowEventById,
	listEventsByRun,
	listEventsByWorkflow,
	listUnconsumedEvents,
	markEventsConsumed,
	createConflictResolution,
	getConflictResolutionById,
	listConflictsByRun,
	listConflictsByWorkflow,
	listUnresolvedConflicts,
	resolveConflict,
	deleteConflictResolution
} from './realtime';

// ===================================================================
// Node Settings Repository (Phase 2 — Launch Roadmap §4)
// ===================================================================

export {
	SETTINGS_ID,
	getNodeSettings,
	updateNodeSettings,
	ensureNodeSettings,
	touchNodeSettings
} from './node-settings';

export type { UpdatableSettings } from './node-settings';

// ===================================================================
// Invitations Repository (Phase 2 — Launch Roadmap §4)
// ===================================================================

export {
	normalizeEmail,
	createInvitation,
	getInvitationByEmail,
	getInvitationById,
	listInvitations,
	updateInvitation,
	revokeInvitation,
	deleteInvitation,
	countInvitationsByStatus
} from './invitations';

export type { InvitationRole, InvitationStatus, CreateInvitationInput } from './invitations';

// ===================================================================
// Admin Audit Log Repository (Phase 2 — Launch Roadmap §4)
// ===================================================================

export { appendAudit, listAudit, countAudit } from './admin-audit-log';
export type { AppendAuditInput, ListAuditFilter } from './admin-audit-log';

// ===================================================================
// Yanez Challenges Repository (biometric sign-and-return, opt-in)
// ===================================================================

export {
	createChallenge,
	getChallenge,
	markVerified,
	markInvalid,
	markExpired
} from './yanez-challenges';
export type { VerifiedUpdate } from './yanez-challenges';
