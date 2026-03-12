// Session types
export type {
  SessionEvent,
  FileEditEvent,
  FileOpenEvent,
  FileCloseEvent,
  TestRunEvent,
  FocusChangeEvent,
  SessionBoundaryEvent,
  SessionMeta,
  SessionMetrics,
  SessionStatus,
  CheckpointResult,
  SignalSource,
  GitDerivedMetrics,
  ProvenanceMetrics,
} from "./session/types.js";

// Attestation types
export type {
  AttestationV1,
  SigningMethod,
  Check,
  VerificationResult,
} from "./attestation/types.js";

// Session algorithms
export { computeMetrics } from "./session/MetricsComputer.js";
export { computeEntropy } from "./session/EntropyCalculator.js";
export type { EntropyComponents } from "./session/EntropyCalculator.js";
export { computeGitMetrics } from "./session/GitMetricsComputer.js";

// Session management
export * as SessionManager from "./session/SessionManager.js";

// Storage
export * as SessionStore from "./storage/SessionStore.js";
export * as ConfigStore from "./storage/ConfigStore.js";
export {
  PROVENANCE_DIR,
  getProvenanceDir,
  getSessionsDir,
  getAttestationsDir,
  getConfigPath,
  getSessionEventPath,
  getSessionMetaPath,
  getAttestationPath,
  getGlobalConfigDir,
  getGlobalConfigPath,
} from "./storage/paths.js";

// Config
export { ProjectConfigSchema } from "./config/ProjectConfig.js";
export type { ProjectConfig } from "./config/ProjectConfig.js";
export { GlobalConfigSchema } from "./config/GlobalConfig.js";
export type { GlobalConfig } from "./config/GlobalConfig.js";
export * from "./config/defaults.js";

// Attestation
export { AttestationSchemaV1, validateAttestation } from "./attestation/AttestationSchema.js";
export { buildAttestation } from "./attestation/AttestationBuilder.js";
export type { UnsignedAttestation } from "./attestation/AttestationBuilder.js";
export { signAttestation, getCanonicalPayload } from "./attestation/AttestationSigner.js";
export { verifyAttestationSignature, getVerificationPayload } from "./attestation/AttestationVerifier.js";

// Crypto
export { hashEmail, getIdentityHash } from "./crypto/identity.js";
export { signWithGpg, verifyGpgSignature } from "./crypto/gpg.js";
export { signWithSsh, verifySshSignature } from "./crypto/ssh.js";
export { discoverSigningKey } from "./crypto/keyDiscovery.js";
export type { SigningKeyInfo } from "./crypto/keyDiscovery.js";

// Utilities
export { sha256 } from "./util/hash.js";
export { isoNow, formatDuration, formatTimestamp } from "./util/time.js";
export {
  isGitRepo,
  getHeadSha,
  getRemoteUrl,
  getGitEmail,
  getGitConfig,
  parseRemoteToSlug,
  getMergeBase,
  getCommitLog,
  getDiffNumstat,
  getCurrentBranch,
  getDefaultBranch,
} from "./util/git.js";
export type { CommitLogEntry, DiffNumstatEntry } from "./util/git.js";
