'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSearchParams } from 'next/navigation';
import {
  Brain, Globe, FileText, Clock, AlertTriangle, CheckCircle, XCircle,
  ChevronLeft, Loader2, Zap, Server, Cloud, Layers, Shield,
  BarChart3, HardDrive, Languages, Sparkles, Cpu, DollarSign,
  ArrowRight, Star, Info, Lock, Type, Hash, Gauge, TrendingUp, Wrench, Download,
  Music, Image
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────

interface DetectedLanguage {
  code: string;
  name: string;
  source: string;
  fileCount: number;
  totalSizeKb: number;
  completenessPercent: number;
}

interface DrmInfo {
  hasDrm: boolean;
  drmTypes: string[];
  affectsTranslation: boolean;
  notes: string;
}

interface EncodingInfo {
  primaryEncoding: string;
  hasUnicode: boolean;
  hasCjk: boolean;
  hasRtl: boolean;
  bomDetected: boolean;
}

interface TranslationComplexity {
  variableCount: number;
  markupCount: number;
  hasPlurals: boolean;
  hasGenderForms: boolean;
  avgStringLength: number;
  shortStringsPercent: number;
  longStringsPercent: number;
  variableFormats: string[];
}

interface FileSizeInfo {
  path: string;
  sizeKb: number;
  format: string;
}

interface TextStats {
  totalTextFiles: number;
  totalTextSizeKb: number;
  estimatedStrings: number;
  estimatedWords: number;
  estimatedCharacters: number;
  largestFiles: FileSizeInfo[];
  localizationFolders: string[];
}

interface FileFormatInfo {
  extension: string;
  count: number;
  totalSizeKb: number;
  translatable: boolean;
  description: string;
}

interface TimeEstimate {
  modelName: string;
  modelSize: string;
  speedStringsPerMin: number;
  estimatedHours: number;
  qualityScore: number;
  provider: string;
}

interface ChainEstimate {
  chainName: string;
  description: string;
  estimatedHours: number;
  qualityScore: number;
  costEstimate: string;
  steps: string[];
}

interface PredictionResult {
  gameTitle: string;
  engine: string;
  installPath: string;
  detectedLanguages: DetectedLanguage[];
  difficultyScore: number;
  difficultyLabel: string;
  textStats: TextStats;
  fileFormats: FileFormatInfo[];
  timeEstimates: TimeEstimate[];
  chainEstimates: ChainEstimate[];
  warnings: string[];
  gsSupported: boolean;
  recommendedMethod: string;
  confidenceScore: number;
  confidenceExplanation: string;
  drmInfo: DrmInfo;
  encodingInfo: EncodingInfo;
  translationComplexity: TranslationComplexity;
  translationQualityScore: number;
  translationQualityExplanation: string;
  existingTools: ExistingTranslationTools;
  selectedTools: SelectedTools;
  llmChains: OptimizedChain[];
  multimediaAnalysis: MultimediaAnalysis;
  backupStrategy: BackupStrategy;
  workflowPlan: WorkflowPlan;
}

interface ExistingTranslationTools {
  hasTranslationFiles: boolean;
  translationFiles: TranslationFileInfo[];
  usesUnityLocalization: boolean;
  usesUnrealLocalization: boolean;
  hasCommunityPatches: boolean;
  communityPatches: CommunityPatchInfo[];
  localizationTools: string[];
  recommendations: string[];
}

interface TranslationFileInfo {
  filePath: string;
  fileType: string;
  language?: string;
  stringCount?: number;
  fileSizeKb: number;
}

interface CommunityPatchInfo {
  patchName: string;
  patchType: string;
  languages: string[];
  status: string;
  installPath?: string;
}

interface SelectedTools {
  primaryTextTool?: SelectedTool;
  alternativeTextTools: SelectedTool[];
  audioTools: SelectedTool[];
  graphicsTools: SelectedTool[];
  archiveTools: SelectedTool[];
  patchTools: SelectedTool[];
  workflowRecommendations: string[];
  selectionScore: number;
}

interface SelectedTool {
  name: string;
  category: ToolCategory;
  description: string;
  supportedFormats: string[];
  compatibilityScore: number;
  easeOfUse: number;
  cost: ToolCost;
  platformSupport: string[];
  specialFeatures: string[];
  recommendedUsage: string;
  installationNotes?: string;
}

type ToolCategory = 'TextExtraction' | 'TextInsertion' | 'AudioConversion' | 'GraphicsEditing' | 'ArchiveExtraction' | 'PatchCreation' | 'LocalizationSystem';

type ToolCost = 'Free' | 'Freemium' | 'Commercial' | 'Enterprise' | 'OpenSource';

interface OptimizedChain {
  chainName: string;
  chainType: ChainType;
  models: ChainModel[];
  estimatedCostUsd: number;
  estimatedTimeHours: number;
  finalQualityScore: number;
  predictionConfidence: number;
  targetBudget?: number;
  advantages: string[];
  disadvantages: string[];
  bestFor: string;
  chainScore: number;
}

interface ChainModel {
  modelName: string;
  provider: LLMProvider;
  role: ModelRole;
  workloadPercentage: number;
  costPerMillionTokens: number;
  speedTokensPerSec: number;
  outputQuality: number;
  rateLimit: number;
  maxContextTokens: number;
  notes: string[];
}

type ChainType = 'Free' | 'Balanced' | 'Premium' | 'BudgetOptimized' | 'Fast' | 'Hybrid';
type LLMProvider = 'OpenAI' | 'Anthropic' | 'Google' | 'Groq' | 'DeepL' | 'TogetherAI' | 'Ollama' | 'Local';
type ModelRole = 'PrimaryTranslation' | 'PostEditing' | 'QualityReview' | 'ContextDetection' | 'FormatValidation';

interface MultimediaAnalysis {
  audioStats: AudioStats;
  graphicsStats: GraphicsStats;
  recommendedTools: MultimediaTools;
  multimediaEstimates: MultimediaEstimates;
  multimediaComplexityScore: number;
  problematicFiles: ProblematicFile[];
}

interface AudioStats {
  totalAudioFiles: number;
  totalAudioSizeMb: number;
  audioFormats: AudioFormatInfo[];
  localizableAudioFiles: number;
  musicAmbientFiles: number;
  compressedAudioFiles: number;
  estimatedTotalMinutes: number;
  predominantQuality: AudioQuality;
  streamingAudioFiles: number;
}

interface GraphicsStats {
  totalGraphicsFiles: number;
  totalGraphicsSizeMb: number;
  graphicsFormats: GraphicsFormatInfo[];
  textContainingGraphics: number;
  uiInterfaceFiles: number;
  textureSpriteFiles: number;
  embeddedTextFiles: number;
  predominantResolution: string;
  animatedFiles: number;
}

interface AudioFormatInfo {
  extension: string;
  count: number;
  totalSizeMb: number;
  isEditable: boolean;
  requiresSpecializedTools: boolean;
  typicalQuality: AudioQuality;
  notes: string[];
}

interface GraphicsFormatInfo {
  extension: string;
  count: number;
  totalSizeMb: number;
  isEditable: boolean;
  supportsTransparency: boolean;
  compressionType: GraphicsCompression;
  resolutions: string[];
  notes: string[];
}

interface MultimediaTools {
  audioTools: SelectedMultimediaTool[];
  graphicsTools: SelectedMultimediaTool[];
  engineSpecificTools: SelectedMultimediaTool[];
  compressionTools: SelectedMultimediaTool[];
}

interface SelectedMultimediaTool {
  name: string;
  category: MultimediaToolCategory;
  description: string;
  supportedFormats: string[];
  compatibilityScore: number;
  cost: ToolCost;
  platformSupport: string[];
  learningCurve: LearningCurve;
  specialFeatures: string[];
  bestFor: string;
  systemRequirements: string[];
}

interface MultimediaEstimates {
  audioEditingHours: number;
  graphicsEditingHours: number;
  toolCostsUsd: number;
  totalComplexity: number;
  highComplexityFiles: number;
  compressionDifficultyFactor: number;
  outsourcingCostEstimate: number;
}

interface ProblematicFile {
  filePath: string;
  problemType: ProblemType;
  severity: ProblemSeverity;
  description: string;
  suggestedSolutions: string[];
  requiredTools: string[];
}

type AudioQuality = 'Low' | 'Medium' | 'High' | 'Studio' | 'Unknown';
type GraphicsCompression = 'None' | 'Lossless' | 'Lossy' | 'Hybrid' | 'Unknown';
type MultimediaToolCategory = 'AudioEditing' | 'GraphicsEditing' | 'AudioCompression' | 'GraphicsCompression' | 'VideoEditing' | 'AssetManagement' | 'EngineSpecific';
type LearningCurve = 'Beginner' | 'Easy' | 'Medium' | 'Hard' | 'Expert';
type ProblemType = 'CompressedFormat' | 'EmbeddedText' | 'ProprietaryFormat' | 'EncryptedContent' | 'CorruptedFile' | 'UnsupportedCodec' | 'LargeFileSize' | 'NestedContainers';
type ProblemSeverity = 'Low' | 'Medium' | 'High' | 'Critical';

interface BackupStrategy {
  recommendedBackupType: BackupType;
  estimatedBackupSizeMb: number;
  backupFilesCount: number;
  compressionMethod: CompressionMethod;
  backupLocation: string;
  backupDurationMinutes: number;
  restoreComplexity: RestoreComplexity;
  backupCategories: BackupCategory[];
  spaceSavingsMb: number;
  backupValidation: BackupValidation;
}

type BackupType = 'Targeted' | 'Essential' | 'Full' | 'Incremental' | 'Custom';
type CompressionMethod = 'None' | 'Fast' | 'Balanced' | 'Maximum' | 'Smart';
type RestoreComplexity = 'Simple' | 'Moderate' | 'Complex' | 'EngineSpecific';

interface BackupCategory {
  categoryType: BackupCategoryType;
  fileCount: number;
  totalSizeMb: number;
  included: boolean;
  priority: BackupPriority;
  description: string;
  examples: string[];
}

type BackupCategoryType = 'TextFiles' | 'AudioFiles' | 'GraphicsFiles' | 'Configuration' | 'Executables' | 'Resources' | 'Localization' | 'EngineSpecific';
type BackupPriority = 'Critical' | 'High' | 'Medium' | 'Low';

interface BackupValidation {
  checksumValidated: boolean;
  integrityChecks: IntegrityCheck[];
  validationTimeMinutes: number;
  canVerifyRestore: boolean;
  backupHealthScore: number;
}

interface IntegrityCheck {
  checkType: IntegrityCheckType;
  description: string;
  passed: boolean;
  details: string;
}

type IntegrityCheckType = 'FileExists' | 'FileSize' | 'Checksum' | 'Permissions' | 'Structure' | 'Metadata';

interface WorkflowPlan {
  recommendedApproach: WorkflowApproach;
  totalEstimatedHours: number;
  totalEstimatedCostUsd: number;
  workflowStages: WorkflowStage[];
  dependencies: WorkflowDependency[];
  riskFactors: RiskFactor[];
  successProbability: number;
  recommendedTeamSize: number;
  qualityAssurancePlan: QualityAssurancePlan;
  deliverables: Deliverable[];
}

type WorkflowApproach = 'Automated' | 'SemiAutomated' | 'Manual' | 'Hybrid' | 'Custom';

interface WorkflowStage {
  stageId: number;
  stageName: string;
  stageType: StageType;
  estimatedDurationHours: number;
  estimatedCostUsd: number;
  requiredTools: string[];
  requiredSkills: string[];
  prerequisites: number[];
  outputs: string[];
  successCriteria: string[];
  riskLevel: RiskLevel;
  automationLevel: AutomationLevel;
  qualityChecks: QualityCheck[];
}

type StageType = 'Preparation' | 'Extraction' | 'Analysis' | 'Translation' | 'Integration' | 'Testing' | 'Packaging' | 'Deployment';
type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';
type AutomationLevel = 'Manual' | 'SemiAutomated' | 'FullyAutomated' | 'Intelligent';

interface QualityCheck {
  checkType: QualityCheckType;
  description: string;
  automated: boolean;
  critical: boolean;
  validationMethod: string;
}

type QualityCheckType = 'FileIntegrity' | 'TranslationAccuracy' | 'FormatCompliance' | 'FunctionalTesting' | 'PerformanceTesting' | 'LocalizationTesting';

interface WorkflowDependency {
  dependencyType: DependencyType;
  description: string;
  required: boolean;
  resolutionTimeHours: number;
  impactLevel: ImpactLevel;
}

type DependencyType = 'ToolInstallation' | 'FilePermissions' | 'SystemRequirements' | 'EngineCompatibility' | 'ThirdPartyServices' | 'NetworkAccess';
type ImpactLevel = 'Low' | 'Medium' | 'High' | 'Blocking';

interface RiskFactor {
  riskType: RiskType;
  description: string;
  probability: number;
  impact: ImpactLevel;
  mitigationStrategy: string;
  contingencyPlan: string;
}

type RiskType = 'Technical' | 'Resource' | 'Timeline' | 'Quality' | 'Compatibility' | 'External';

interface QualityAssurancePlan {
  testingPhases: TestingPhase[];
  acceptanceCriteria: AcceptanceCriterion[];
  bugTracking: BugTrackingConfig;
  reviewProcess: ReviewProcess;
  qualityMetrics: QualityMetric[];
}

interface TestingPhase {
  phaseName: string;
  phaseType: TestingType;
  estimatedHours: number;
  testCasesCount: number;
  automationCoverage: number;
  successThreshold: number;
}

type TestingType = 'UnitTesting' | 'IntegrationTesting' | 'SystemTesting' | 'UserAcceptanceTesting' | 'LocalizationTesting' | 'PerformanceTesting';

interface AcceptanceCriterion {
  criterionId: string;
  description: string;
  category: AcceptanceCategory;
  measurable: boolean;
  targetValue: string;
  validationMethod: string;
}

type AcceptanceCategory = 'Functional' | 'Performance' | 'Quality' | 'Compatibility' | 'Usability';

interface BugTrackingConfig {
  tool: string;
  severityLevels: SeverityLevel[];
  workflow: string;
  reportingFormat: string;
  escalationRules: EscalationRule[];
}

interface SeverityLevel {
  level: string;
  description: string;
  responseTimeHours: number;
  autoEscalation: boolean;
}

interface EscalationRule {
  triggerCondition: string;
  escalationLevel: string;
  notificationRecipients: string[];
  actionRequired: string;
}

interface ReviewProcess {
  reviewType: ReviewType;
  participants: Participant[];
  reviewCriteria: ReviewCriterion[];
  approvalWorkflow: ApprovalWorkflow;
  feedbackMechanism: FeedbackMechanism;
}

type ReviewType = 'TechnicalReview' | 'LinguisticReview' | 'CulturalReview' | 'ComplianceReview' | 'StakeholderReview';

interface Participant {
  role: string;
  name: string;
  expertise: string[];
  authorityLevel: AuthorityLevel;
  availability: number;
}

type AuthorityLevel = 'Advisor' | 'Reviewer' | 'Approver' | 'Authority';

interface ReviewCriterion {
  criterionId: string;
  description: string;
  weight: number;
  evaluationMethod: string;
  passingScore: number;
}

interface ApprovalWorkflow {
  stages: ApprovalStage[];
  parallelReviews: boolean;
  autoApprovalConditions: string[];
  rejectionHandling: RejectionHandling;
}

interface ApprovalStage {
  stageName: string;
  requiredApprovers: number;
  approvalCriteria: string[];
  timeoutHours: number;
}

interface RejectionHandling {
  feedbackRequired: boolean;
  resubmissionAllowed: boolean;
  maxResubmissions: number;
  escalationOnRejection: boolean;
}

interface FeedbackMechanism {
  feedbackFormat: string;
  structuredFeedback: boolean;
  ratingSystem: boolean;
  commentCategories: string[];
  followUpRequired: boolean;
}

interface QualityMetric {
  metricName: string;
  metricType: MetricType;
  targetValue: number;
  measurementMethod: string;
  frequency: MeasurementFrequency;
  trendAnalysis: boolean;
}

type MetricType = 'Quantitative' | 'Qualitative' | 'Binary' | 'Percentage';
type MeasurementFrequency = 'Once' | 'Daily' | 'Weekly' | 'PerStage' | 'Continuous';

interface Deliverable {
  deliverableId: string;
  deliverableName: string;
  deliverableType: DeliverableType;
  format: string;
  sizeEstimateMb: number;
  deliveryStage: number;
  acceptanceCriteria: string[];
  distributionList: string[];
}

type DeliverableType = 'TranslatedFiles' | 'PatchPackage' | 'InstallationGuide' | 'TestingReport' | 'Documentation' | 'BackupArchive' | 'QualityReport' | 'DeploymentPackage';

// ── Language Lists ───────────────────────────────────────────────────

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'it', name: 'Italiano' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
  { code: 'pt', name: 'Português' },
  { code: 'ru', name: 'Русский' },
  { code: 'pl', name: 'Polski' },
  { code: 'ja', name: '日本語' },
  { code: 'zh', name: '中文' },
  { code: 'ko', name: '한국어' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'sv', name: 'Svenska' },
  { code: 'cs', name: 'Čeština' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'ar', name: 'العربية' },
  { code: 'th', name: 'ไทย' },
  { code: 'uk', name: 'Українська' },
];

// ── Helper Components ────────────────────────────────────────────────

function DifficultyGauge({ score, label }: { score: number; label: string }) {
  const color = score <= 20 ? 'text-green-400' : score <= 40 ? 'text-emerald-400' : score <= 60 ? 'text-yellow-400' : score <= 80 ? 'text-orange-400' : 'text-red-400';
  const bgColor = score <= 20 ? 'bg-green-500' : score <= 40 ? 'bg-emerald-500' : score <= 60 ? 'bg-yellow-500' : score <= 80 ? 'bg-orange-500' : 'bg-red-500';
  const ringColor = score <= 20 ? 'ring-green-500/30' : score <= 40 ? 'ring-emerald-500/30' : score <= 60 ? 'ring-yellow-500/30' : score <= 80 ? 'ring-orange-500/30' : 'ring-red-500/30';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`relative w-28 h-28 rounded-full ring-4 ${ringColor} flex items-center justify-center bg-slate-800/80`}>
        <div className="text-center">
          <span className={`text-3xl font-black ${color}`}>{score}</span>
          <span className="text-slate-500 text-xs block">/100</span>
        </div>
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="6" className="text-slate-700/50" />
          <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="6" className={color}
            strokeDasharray={`${score * 3.27} 327`} strokeLinecap="round" />
        </svg>
      </div>
      <span className={`text-sm font-bold ${color}`}>{label}</span>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = 'text-indigo-400' }: { icon: unknown; label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg bg-slate-700/50 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-lg font-bold text-slate-200 truncate">{value}</p>
        {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function QualityBar({ score }: { score: number }) {
  const color = score >= 90 ? 'bg-green-500' : score >= 80 ? 'bg-emerald-500' : score >= 70 ? 'bg-yellow-500' : 'bg-orange-500';
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-mono text-slate-400 w-8 text-right">{score}</span>
    </div>
  );
}

// ── Helper Functions ───────────────────────────────────────────────────

function getChainTypeColor(type: ChainType): string {
  switch (type) {
    case 'Free': return '#10b981';
    case 'Balanced': return '#3b82f6';
    case 'Premium': return '#8b5cf6';
    case 'Fast': return '#f59e0b';
    case 'Hybrid': return '#ec4899';
    case 'BudgetOptimized': return '#06b6d4';
    default: return '#6b7280';
  }
}

function getChainTypeLabel(type: ChainType): string {
  switch (type) {
    case 'Free': return 'Free';
    case 'Balanced': return 'Balanced';
    case 'Premium': return 'Premium';
    case 'Fast': return 'Fast';
    case 'Hybrid': return 'Hybrid';
    case 'BudgetOptimized': return 'Budget';
    default: return type;
  }
}

function getRoleLabel(role: ModelRole): string {
  switch (role) {
    case 'PrimaryTranslation': return 'Primary';
    case 'PostEditing': return 'Post-edit';
    case 'QualityReview': return 'Review';
    case 'ContextDetection': return 'Context';
    case 'FormatValidation': return 'Format';
    default: return role;
  }
}

// ── Multimedia Helper Functions ───────────────────────────────────────

function getAudioQualityColor(quality: AudioQuality): string {
  switch (quality) {
    case 'Studio': return '#10b981';
    case 'High': return '#3b82f6';
    case 'Medium': return '#f59e0b';
    case 'Low': return '#ef4444';
    default: return '#6b7280';
  }
}

function getAudioQualityLabel(quality: AudioQuality): string {
  switch (quality) {
    case 'Studio': return 'Studio';
    case 'High': return 'High';
    case 'Medium': return 'Medium';
    case 'Low': return 'Low';
    default: return 'Unknown';
  }
}

function getGraphicsCompressionColor(compression: GraphicsCompression): string {
  switch (compression) {
    case 'None': return '#10b981';
    case 'Lossless': return '#3b82f6';
    case 'Lossy': return '#f59e0b';
    case 'Hybrid': return '#8b5cf6';
    default: return '#6b7280';
  }
}

function getGraphicsCompressionLabel(compression: GraphicsCompression): string {
  switch (compression) {
    case 'None': return 'None';
    case 'Lossless': return 'Lossless';
    case 'Lossy': return 'Lossy';
    case 'Hybrid': return 'Hybrid';
    default: return 'Unknown';
  }
}

function getMultimediaToolCategoryColor(category: MultimediaToolCategory): string {
  switch (category) {
    case 'AudioEditing': return '#06b6d4';
    case 'GraphicsEditing': return '#10b981';
    case 'AudioCompression': return '#f59e0b';
    case 'GraphicsCompression': return '#ef4444';
    case 'EngineSpecific': return '#8b5cf6';
    default: return '#6b7280';
  }
}

function getMultimediaToolCategoryLabel(category: MultimediaToolCategory): string {
  switch (category) {
    case 'AudioEditing': return 'Audio';
    case 'GraphicsEditing': return 'Graphics';
    case 'AudioCompression': return 'Audio Comp';
    case 'GraphicsCompression': return 'Graphics Comp';
    case 'EngineSpecific': return 'Engine';
    default: return category;
  }
}

function getLearningCurveColor(curve: LearningCurve): string {
  switch (curve) {
    case 'Beginner': return '#10b981';
    case 'Easy': return '#3b82f6';
    case 'Medium': return '#f59e0b';
    case 'Hard': return '#ef4444';
    case 'Expert': return '#dc2626';
    default: return '#6b7280';
  }
}

function getLearningCurveLabel(curve: LearningCurve): string {
  switch (curve) {
    case 'Beginner': return 'Beginner';
    case 'Easy': return 'Easy';
    case 'Medium': return 'Medium';
    case 'Hard': return 'Hard';
    case 'Expert': return 'Expert';
    default: return curve;
  }
}

function getProblemSeverityColor(severity: ProblemSeverity): string {
  switch (severity) {
    case 'Low': return '#10b981';
    case 'Medium': return '#f59e0b';
    case 'High': return '#ef4444';
    case 'Critical': return '#dc2626';
    default: return '#6b7280';
  }
}

function getProblemSeverityLabel(severity: ProblemSeverity): string {
  switch (severity) {
    case 'Low': return 'Low';
    case 'Medium': return 'Medium';
    case 'High': return 'High';
    case 'Critical': return 'Critical';
    default: return severity;
  }
}

// ── Backup Helper Functions ───────────────────────────────────────────

function getBackupTypeColor(type: BackupType): string {
  switch (type) {
    case 'Targeted': return '#10b981';
    case 'Essential': return '#3b82f6';
    case 'Full': return '#f59e0b';
    case 'Incremental': return '#8b5cf6';
    case 'Custom': return '#6b7280';
    default: return '#6b7280';
  }
}

function getBackupTypeLabel(type: BackupType): string {
  switch (type) {
    case 'Targeted': return 'Targeted';
    case 'Essential': return 'Essential';
    case 'Full': return 'Full';
    case 'Incremental': return 'Incremental';
    case 'Custom': return 'Custom';
    default: return type;
  }
}

function getCompressionMethodColor(method: CompressionMethod): string {
  switch (method) {
    case 'None': return '#10b981';
    case 'Fast': return '#3b82f6';
    case 'Balanced': return '#f59e0b';
    case 'Maximum': return '#ef4444';
    case 'Smart': return '#8b5cf6';
    default: return '#6b7280';
  }
}

function getCompressionMethodLabel(method: CompressionMethod): string {
  switch (method) {
    case 'None': return 'None';
    case 'Fast': return 'Fast';
    case 'Balanced': return 'Balanced';
    case 'Maximum': return 'Maximum';
    case 'Smart': return 'Smart';
    default: return method;
  }
}

function getRestoreComplexityColor(complexity: RestoreComplexity): string {
  switch (complexity) {
    case 'Simple': return '#10b981';
    case 'Moderate': return '#f59e0b';
    case 'Complex': return '#ef4444';
    case 'EngineSpecific': return '#dc2626';
    default: return '#6b7280';
  }
}

function getRestoreComplexityLabel(complexity: RestoreComplexity): string {
  switch (complexity) {
    case 'Simple': return 'Simple';
    case 'Moderate': return 'Moderate';
    case 'Complex': return 'Complex';
    case 'EngineSpecific': return 'Engine Specific';
    default: return complexity;
  }
}

function getBackupPriorityColor(priority: BackupPriority): string {
  switch (priority) {
    case 'Critical': return '#dc2626';
    case 'High': return '#ef4444';
    case 'Medium': return '#f59e0b';
    case 'Low': return '#10b981';
    default: return '#6b7280';
  }
}

function getBackupPriorityLabel(priority: BackupPriority): string {
  switch (priority) {
    case 'Critical': return 'Critical';
    case 'High': return 'High';
    case 'Medium': return 'Medium';
    case 'Low': return 'Low';
    default: return priority;
  }
}

function getBackupCategoryColor(category: BackupCategoryType): string {
  switch (category) {
    case 'TextFiles': return '#06b6d4';
    case 'AudioFiles': return '#10b981';
    case 'GraphicsFiles': return '#8b5cf6';
    case 'Configuration': return '#f59e0b';
    case 'Executables': return '#ef4444';
    case 'Resources': return '#6b7280';
    case 'Localization': return '#3b82f6';
    case 'EngineSpecific': return '#dc2626';
    default: return '#6b7280';
  }
}

function getBackupCategoryLabel(category: BackupCategoryType): string {
  switch (category) {
    case 'TextFiles': return 'Text Files';
    case 'AudioFiles': return 'Audio Files';
    case 'GraphicsFiles': return 'Graphics Files';
    case 'Configuration': return 'Configuration';
    case 'Executables': return 'Executables';
    case 'Resources': return 'Resources';
    case 'Localization': return 'Localization';
    case 'EngineSpecific': return 'Engine Specific';
    default: return category;
  }
}

// ── Workflow Helper Functions ───────────────────────────────────────────

function getWorkflowApproachColor(approach: WorkflowApproach): string {
  switch (approach) {
    case 'Automated': return '#10b981';
    case 'SemiAutomated': return '#3b82f6';
    case 'Manual': return '#f59e0b';
    case 'Hybrid': return '#8b5cf6';
    case 'Custom': return '#6b7280';
    default: return '#6b7280';
  }
}

function getWorkflowApproachLabel(approach: WorkflowApproach): string {
  switch (approach) {
    case 'Automated': return 'Automated';
    case 'SemiAutomated': return 'Semi-Automated';
    case 'Manual': return 'Manual';
    case 'Hybrid': return 'Hybrid';
    case 'Custom': return 'Custom';
    default: return approach;
  }
}

function getStageTypeColor(type: StageType): string {
  switch (type) {
    case 'Preparation': return '#06b6d4';
    case 'Extraction': return '#10b981';
    case 'Analysis': return '#3b82f6';
    case 'Translation': return '#8b5cf6';
    case 'Integration': return '#f59e0b';
    case 'Testing': return '#ef4444';
    case 'Packaging': return '#dc2626';
    case 'Deployment': return '#059669';
    default: return '#6b7280';
  }
}

function getStageTypeLabel(type: StageType): string {
  switch (type) {
    case 'Preparation': return 'Preparation';
    case 'Extraction': return 'Extraction';
    case 'Analysis': return 'Analysis';
    case 'Translation': return 'Translation';
    case 'Integration': return 'Integration';
    case 'Testing': return 'Testing';
    case 'Packaging': return 'Packaging';
    case 'Deployment': return 'Deployment';
    default: return type;
  }
}

function getRiskLevelColor(level: RiskLevel): string {
  switch (level) {
    case 'Low': return '#10b981';
    case 'Medium': return '#f59e0b';
    case 'High': return '#ef4444';
    case 'Critical': return '#dc2626';
    default: return '#6b7280';
  }
}

function getRiskLevelLabel(level: RiskLevel): string {
  switch (level) {
    case 'Low': return 'Low';
    case 'Medium': return 'Medium';
    case 'High': return 'High';
    case 'Critical': return 'Critical';
    default: return level;
  }
}

function getAutomationLevelColor(level: AutomationLevel): string {
  switch (level) {
    case 'Manual': return '#ef4444';
    case 'SemiAutomated': return '#f59e0b';
    case 'FullyAutomated': return '#10b981';
    case 'Intelligent': return '#06b6d4';
    default: return '#6b7280';
  }
}

function getAutomationLevelLabel(level: AutomationLevel): string {
  switch (level) {
    case 'Manual': return 'Manual';
    case 'SemiAutomated': return 'Semi-Automated';
    case 'FullyAutomated': return 'Fully Automated';
    case 'Intelligent': return 'Intelligent';
    default: return level;
  }
}

function getTestingTypeColor(type: TestingType): string {
  switch (type) {
    case 'UnitTesting': return '#06b6d4';
    case 'IntegrationTesting': return '#10b981';
    case 'SystemTesting': return '#3b82f6';
    case 'UserAcceptanceTesting': return '#8b5cf6';
    case 'LocalizationTesting': return '#f59e0b';
    case 'PerformanceTesting': return '#ef4444';
    default: return '#6b7280';
  }
}

function getTestingTypeLabel(type: TestingType): string {
  switch (type) {
    case 'UnitTesting': return 'Unit Testing';
    case 'IntegrationTesting': return 'Integration Testing';
    case 'SystemTesting': return 'System Testing';
    case 'UserAcceptanceTesting': return 'User Acceptance Testing';
    case 'LocalizationTesting': return 'Localization Testing';
    case 'PerformanceTesting': return 'Performance Testing';
    default: return type;
  }
}

function getDeliverableTypeColor(type: DeliverableType): string {
  switch (type) {
    case 'TranslatedFiles': return '#06b6d4';
    case 'PatchPackage': return '#10b981';
    case 'InstallationGuide': return '#3b82f6';
    case 'TestingReport': return '#8b5cf6';
    case 'Documentation': return '#f59e0b';
    case 'BackupArchive': return '#ef4444';
    case 'QualityReport': return '#dc2626';
    case 'DeploymentPackage': return '#059669';
    default: return '#6b7280';
  }
}

function getDeliverableTypeLabel(type: DeliverableType): string {
  switch (type) {
    case 'TranslatedFiles': return 'Translated Files';
    case 'PatchPackage': return 'Patch Package';
    case 'InstallationGuide': return 'Installation Guide';
    case 'TestingReport': return 'Testing Report';
    case 'Documentation': return 'Documentation';
    case 'BackupArchive': return 'Backup Archive';
    case 'QualityReport': return 'Quality Report';
    case 'DeploymentPackage': return 'Deployment Package';
    default: return type;
  }
}

// ── Main Component ───────────────────────────────────────────────────

export default function PredictionToolPage() {
  const searchParams = useSearchParams();
  const gameTitle = searchParams.get('name') || 'Unknown Game';
  const installDir = searchParams.get('installDir') || '';
  const engineParam = searchParams.get('engine') || '';
  const headerImage = searchParams.get('headerImage') || '';

  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('it');
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedChain, setExpandedChain] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const analyze = async () => {
    const dir = installDir || result?.installPath || '';
    if (!dir) {
      setError('Nessuna directory di installazione disponibile. Il gioco deve essere installato.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await invoke<PredictionResult>('analyze_game_translation', {
        installPath: dir,
        gameTitle: gameTitle,
        engine: engineParam || null,
        sourceLang,
        targetLang,
      });
      setResult(res);
    } catch (err) {
      setError(err as string);
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async (format: 'json' | 'csv' | 'txt') => {
    if (!result) return;
    
    setExporting(true);
    try {
      const message = await invoke<string>('export_prediction_report', {
        result,
        format,
        outputPath: 'C:\\Users\\Public\\Documents\\GameStringer\\Reports'
      });
      alert(message);
    } catch (err) {
      setError(`Errore export: ${err}`);
    } finally {
      setExporting(false);
    }
  };

  // Auto-analyze on mount if installDir is available
  useEffect(() => {
    if (installDir) {
      analyze();
    }
  }, []);

  const translatableFormats = useMemo(() =>
    result?.fileFormats.filter(f => f.translatable) || [], [result]);
  const binaryFormats = useMemo(() =>
    result?.fileFormats.filter(f => !f.translatable) || [], [result]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-200">
      {/* Header */}
      <div className="relative overflow-hidden">
        {headerImage && (
          <div className="absolute inset-0">
            <img src={headerImage} alt="" className="w-full h-full object-cover opacity-15 blur-sm" />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/90 to-slate-950" />
          </div>
        )}
        <div className="relative max-w-6xl mx-auto px-6 py-6">
          <button onClick={() => window.history.back()}
            className="flex items-center gap-1 text-slate-500 hover:text-slate-300 text-sm mb-4 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Torna alla Libreria
          </button>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-600/20 to-indigo-600/20 border border-purple-500/20">
              <Brain className="w-8 h-8 text-purple-400" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-black tracking-tight">
                P.T. <span className="text-purple-400">Prediction Tool</span>
              </h1>
              <p className="text-sm text-slate-500">{gameTitle}</p>
            </div>
            {result && (
              <div className="flex gap-2">
                <button 
                  onClick={() => exportReport('json')}
                  disabled={exporting}
                  className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 text-xs font-medium transition-all flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  JSON
                </button>
                <button 
                  onClick={() => exportReport('csv')}
                  disabled={exporting}
                  className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 text-xs font-medium transition-all flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  CSV
                </button>
                <button 
                  onClick={() => exportReport('txt')}
                  disabled={exporting}
                  className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 text-xs font-medium transition-all flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  TXT
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 pb-12">
        {/* Language Selector */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 mb-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">Lingua Origine</label>
              <select value={sourceLang} onChange={e => setSourceLang(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500">
                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name} ({l.code})</option>)}
              </select>
            </div>
            <div className="flex items-center pb-2">
              <ArrowRight className="w-5 h-5 text-purple-400" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">Lingua Destinazione</label>
              <select value={targetLang} onChange={e => setTargetLang(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500">
                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name} ({l.code})</option>)}
              </select>
            </div>
            <button onClick={analyze} disabled={loading || (!installDir && !result)}
              className="px-6 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold text-sm transition-all flex items-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? 'Analisi...' : 'Analizza'}
            </button>
          </div>
          {!installDir && (
            <p className="text-xs text-orange-400/80 mt-3 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Il gioco non è installato. Installalo per analizzare i file.
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 mb-6 text-sm text-red-300">
            <XCircle className="w-4 h-4 inline mr-2" /> {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-12 h-12 text-purple-400 animate-spin" />
            <p className="text-slate-400 text-sm">Scansione profonda dei file di gioco...</p>
            <p className="text-slate-600 text-xs">Analisi motore, lingue, formati, volume testo</p>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-6">
            {/* Row 1: Difficulty + Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Difficulty Gauge */}
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 flex flex-col items-center justify-center">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Difficoltà Traduzione</h3>
                <DifficultyGauge score={result.difficultyScore} label={result.difficultyLabel} />
                <div className="mt-4 flex items-center gap-2">
                  {result.gsSupported ? (
                    <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded-lg">
                      <CheckCircle className="w-3 h-3" /> Supportato da GS
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-orange-400 bg-orange-500/10 px-2 py-1 rounded-lg">
                      <AlertTriangle className="w-3 h-3" /> Supporto limitato
                    </span>
                  )}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatCard icon={Cpu} label="Motore" value={result.engine} color="text-cyan-400" />
                <StatCard icon={FileText} label="File Testo" value={String(result.textStats.totalTextFiles)} sub={`${result.textStats.totalTextSizeKb} KB totali`} color="text-blue-400" />
                <StatCard icon={BarChart3} label="Stringhe Stimate" value={result.textStats.estimatedStrings.toLocaleString()} color="text-purple-400" />
                <StatCard icon={Languages} label="Lingue Trovate" value={String(result.detectedLanguages.length)} color="text-emerald-400" />
                <StatCard icon={Layers} label="Formati Traducibili" value={String(translatableFormats.length)} sub={`su ${result.fileFormats.length} formati`} color="text-yellow-400" />
                <StatCard icon={HardDrive} label="Metodo" value={result.gsSupported ? 'GS Nativo' : 'Manuale'} sub={result.recommendedMethod.slice(0, 50)} color="text-pink-400" />
              </div>
            </div>

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div className="bg-amber-900/10 border border-amber-500/20 rounded-xl p-4 space-y-2">
                <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5" /> Avvisi
                </h3>
                {result.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-300/70 pl-5">• {w}</p>
                ))}
              </div>
            )}

            {/* Row 1.5: Confidence + DRM + Encoding + Complexity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Confidence Score */}
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-indigo-400" /> Affidabilità Predizione
                </h3>
                <div className="flex items-center gap-4 mb-3">
                  <div className={`text-3xl font-black ${
                    result.confidenceScore >= 80 ? 'text-green-400' : result.confidenceScore >= 50 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {result.confidenceScore}<span className="text-sm text-slate-500">/100</span>
                  </div>
                  <div className="flex-1">
                    <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${
                        result.confidenceScore >= 80 ? 'bg-green-500' : result.confidenceScore >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                      }`} style={{ width: `${result.confidenceScore}%` }} />
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-400">{result.confidenceExplanation}</p>
              </div>

              {/* DRM Info */}
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-rose-400" /> DRM / Anti-Cheat
                </h3>
                {!result.drmInfo.hasDrm ? (
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <CheckCircle className="w-4 h-4" /> Nessun DRM rilevato
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {result.drmInfo.drmTypes.map((drm, i) => (
                        <span key={i} className={`text-xs px-2 py-0.5 rounded-full border ${
                          result.drmInfo.affectsTranslation
                            ? 'bg-red-500/10 text-red-400 border-red-500/30'
                            : 'bg-slate-700/50 text-slate-300 border-slate-600/50'
                        }`}>{drm}</span>
                      ))}
                    </div>
                    {result.drmInfo.affectsTranslation && (
                      <p className="text-xs text-red-300/70 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Potrebbe interferire con la traduzione
                      </p>
                    )}
                  </div>
                )}
                <p className="text-[11px] text-slate-500 mt-2">{result.drmInfo.notes}</p>
              </div>
            </div>

            {/* Row 1.6: Encoding + Translation Complexity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Encoding */}
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <Type className="w-4 h-4 text-sky-400" /> Encoding File
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Encoding Primario</span>
                    <span className="text-xs font-mono text-slate-200 bg-slate-700/50 px-2 py-0.5 rounded">{result.encodingInfo.primaryEncoding}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {result.encodingInfo.hasUnicode && (
                      <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">Unicode</span>
                    )}
                    {result.encodingInfo.hasCjk && (
                      <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">CJK</span>
                    )}
                    {result.encodingInfo.hasRtl && (
                      <span className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full">RTL</span>
                    )}
                    {result.encodingInfo.bomDetected && (
                      <span className="text-[10px] bg-slate-600/30 text-slate-400 border border-slate-600/30 px-2 py-0.5 rounded-full">BOM</span>
                    )}
                    {!result.encodingInfo.hasUnicode && !result.encodingInfo.hasCjk && !result.encodingInfo.hasRtl && (
                      <span className="text-[10px] text-slate-500">Solo caratteri ASCII/Latin</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Translation Complexity */}
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <Hash className="w-4 h-4 text-fuchsia-400" /> Complessità Traduzione
                </h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-900/40 rounded-lg px-3 py-2">
                    <span className="text-slate-500">Variabili</span>
                    <p className="text-slate-200 font-bold">{result.translationComplexity.variableCount.toLocaleString()}</p>
                  </div>
                  <div className="bg-slate-900/40 rounded-lg px-3 py-2">
                    <span className="text-slate-500">Tag Markup</span>
                    <p className="text-slate-200 font-bold">{result.translationComplexity.markupCount.toLocaleString()}</p>
                  </div>
                  <div className="bg-slate-900/40 rounded-lg px-3 py-2">
                    <span className="text-slate-500">Lung. Media</span>
                    <p className="text-slate-200 font-bold">{result.translationComplexity.avgStringLength} chars</p>
                  </div>
                  <div className="bg-slate-900/40 rounded-lg px-3 py-2">
                    <span className="text-slate-500">Corte/Lunghe</span>
                    <p className="text-slate-200 font-bold">{result.translationComplexity.shortStringsPercent}% / {result.translationComplexity.longStringsPercent}%</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {result.translationComplexity.hasPlurals && (
                    <span className="text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-full">Plurali</span>
                  )}
                  {result.translationComplexity.hasGenderForms && (
                    <span className="text-[10px] bg-pink-500/10 text-pink-400 border border-pink-500/20 px-2 py-0.5 rounded-full">Genere</span>
                  )}
                  {result.translationComplexity.variableFormats.map((fmt, i) => (
                    <span key={i} className="text-[10px] bg-slate-700/50 text-slate-400 border border-slate-600/30 px-2 py-0.5 rounded-full font-mono">{fmt}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Translation Quality */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-400" /> Qualità Traduzione Stimata
              </h3>
              <div className="flex items-center gap-4 mb-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-400">Score Qualità</span>
                    <span className="text-sm font-bold text-purple-400">{result.translationQualityScore}/100</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-purple-400 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${result.translationQualityScore}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="text-xs text-slate-300 leading-relaxed">
                {result.translationQualityExplanation}
              </div>
            </div>

            {/* Existing Translation Tools */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-blue-400" /> Strumenti di Traduzione Esistenti
              </h3>
              
              {/* Translation Files */}
              {result.existingTools.hasTranslationFiles && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-blue-300 mb-2">File di Traduzione Rilevati</h4>
                  <div className="space-y-1">
                    {result.existingTools.translationFiles.slice(0, 5).map((file, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-900/50 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">{file.fileType}</span>
                          <span className="text-xs text-slate-400 truncate max-w-xs">{file.filePath.split('/').pop()}</span>
                          {file.language && (
                            <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">{file.language}</span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500">{(file.fileSizeKb / 1024).toFixed(1)}MB</span>
                      </div>
                    ))}
                    {result.existingTools.translationFiles.length > 5 && (
                      <p className="text-xs text-slate-500 italic">...e altri {result.existingTools.translationFiles.length - 5} file</p>
                    )}
                  </div>
                </div>
              )}

              {/* Localization Tools */}
              {result.existingTools.localizationTools.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-green-300 mb-2">Sistemi di Localizzazione</h4>
                  <div className="flex flex-wrap gap-1">
                    {result.existingTools.localizationTools.map((tool, i) => (
                      <span key={i} className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full">
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Community Patches */}
              {result.existingTools.hasCommunityPatches && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-purple-300 mb-2">Patch Community</h4>
                  <div className="space-y-1">
                    {result.existingTools.communityPatches.slice(0, 3).map((patch, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-900/50 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-300">{patch.patchName}</span>
                          <div className="flex gap-1">
                            {patch.languages.map((lang, j) => (
                              <span key={j} className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">{lang}</span>
                            ))}
                          </div>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          patch.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'
                        }`}>
                          {patch.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {result.existingTools.recommendations.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-yellow-300 mb-2">Raccomandazioni</h4>
                  <div className="space-y-1">
                    {result.existingTools.recommendations.map((rec, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <ArrowRight className="w-3 h-3 text-yellow-400 mt-0.5 flex-shrink-0" />
                        <span className="text-xs text-slate-300 leading-relaxed">{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No Tools Found */}
              {!result.existingTools.hasTranslationFiles && 
               result.existingTools.localizationTools.length === 0 && 
               !result.existingTools.hasCommunityPatches && (
                <p className="text-xs text-slate-500 italic">Nessuno strumento di traduzione esistente rilevato. La traduzione dovrà essere creata da zero.</p>
              )}
            </div>

            {/* Selected Tools */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" /> Tool Selezionati Automaticamente
              </h3>
              
              {/* Primary Text Tool */}
              {result.selectedTools.primaryTextTool && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-green-300 mb-2">Tool Primario - Estrazione Testo</h4>
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-200">{result.selectedTools.primaryTextTool.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                          Score: {result.selectedTools.primaryTextTool.compatibilityScore}
                        </span>
                        <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                          {result.selectedTools.primaryTextTool.cost}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 mb-2">{result.selectedTools.primaryTextTool.description}</p>
                    <p className="text-xs text-slate-500">{result.selectedTools.primaryTextTool.recommendedUsage}</p>
                  </div>
                </div>
              )}

              {/* Alternative Tools */}
              {result.selectedTools.alternativeTextTools.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-orange-300 mb-2">Tool Alternativi</h4>
                  <div className="space-y-2">
                    {result.selectedTools.alternativeTextTools.slice(0, 3).map((tool, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-900/30 rounded-lg px-3 py-2">
                        <div>
                          <span className="text-xs text-slate-300">{tool.name}</span>
                          <span className="text-[10px] text-slate-500 ml-2">Score: {tool.compatibilityScore}</span>
                        </div>
                        <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">
                          {tool.cost}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Archive Tools */}
              {result.selectedTools.archiveTools.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-purple-300 mb-2">Tool Archivi</h4>
                  <div className="space-y-1">
                    {result.selectedTools.archiveTools.map((tool, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-900/30 rounded-lg px-3 py-2">
                        <span className="text-xs text-slate-300">{tool.name}</span>
                        <span className="text-[10px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">
                          {tool.cost}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Audio/Graphics Tools */}
              {(result.selectedTools.audioTools.length > 0 || result.selectedTools.graphicsTools.length > 0) && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-cyan-300 mb-2">Tool Multimedia</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {result.selectedTools.audioTools.slice(0, 2).map((tool, i) => (
                      <div key={`audio-${i}`} className="bg-slate-900/30 rounded-lg px-3 py-2">
                        <span className="text-xs text-slate-300">{tool.name}</span>
                        <span className="text-[10px] text-cyan-400 block mt-1">Audio</span>
                      </div>
                    ))}
                    {result.selectedTools.graphicsTools.slice(0, 2).map((tool, i) => (
                      <div key={`graphics-${i}`} className="bg-slate-900/30 rounded-lg px-3 py-2">
                        <span className="text-xs text-slate-300">{tool.name}</span>
                        <span className="text-[10px] text-pink-400 block mt-1">Grafica</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Workflow Recommendations */}
              {result.selectedTools.workflowRecommendations.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-yellow-300 mb-2">Workflow Consigliato</h4>
                  <div className="space-y-1">
                    {result.selectedTools.workflowRecommendations.slice(0, 4).map((rec, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <ArrowRight className="w-3 h-3 text-yellow-400 mt-0.5 flex-shrink-0" />
                        <span className="text-xs text-slate-300 leading-relaxed">{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Selection Score */}
              <div className="mt-4 pt-3 border-t border-slate-700/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Score Selezione Tool</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-yellow-500 rounded-full transition-all" 
                        style={{ width: `${result.selectedTools.selectionScore}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-yellow-400">{result.selectedTools.selectionScore}/100</span>
                  </div>
                </div>
              </div>
            </div>

            {/* LLM Chains */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <Brain className="w-4 h-4 text-blue-400" /> Chain LLM Ottimizzate
              </h3>
              
              {/* Top 3 Chains */}
              <div className="space-y-3">
                {result.llmChains.slice(0, 3).map((chain, i) => (
                  <div key={i} className="bg-slate-900/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-slate-200">#{i + 1}</span>
                          <div className="px-2 py-1 rounded-full text-[10px] font-medium"
                            style={{
                              backgroundColor: getChainTypeColor(chain.chainType),
                              color: 'white'
                            }}
                          >
                            {getChainTypeLabel(chain.chainType)}
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-slate-200">{chain.chainName}</h4>
                          <p className="text-xs text-slate-400">{chain.bestFor}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-green-400">${chain.estimatedCostUsd.toFixed(2)}</span>
                          <span className="text-xs text-blue-400">{chain.estimatedTimeHours.toFixed(1)}h</span>
                          <span className="text-xs text-purple-400">Q{chain.finalQualityScore}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-12 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" 
                              style={{ width: `${chain.chainScore}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">{chain.chainScore}</span>
                        </div>
                      </div>
                    </div>

                    {/* Models in Chain */}
                    <div className="mb-3">
                      <div className="flex flex-wrap gap-1">
                        {chain.models.map((model, j) => (
                          <div key={j} className="flex items-center gap-1 bg-slate-800/50 rounded px-2 py-1">
                            <span className="text-[10px] font-medium text-slate-300">{model.modelName}</span>
                            <span className="text-[8px] text-slate-500">{model.workloadPercentage}%</span>
                            <span className="text-[8px] px-1 rounded bg-slate-700 text-slate-400">
                              {getRoleLabel(model.role)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Advantages/Disadvantages */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-green-400 font-medium">✓ </span>
                        <span className="text-slate-300">{chain.advantages.slice(0, 2).join(', ')}</span>
                      </div>
                      <div>
                        <span className="text-orange-400 font-medium">⚠ </span>
                        <span className="text-slate-300">{chain.disadvantages.slice(0, 1).join(', ')}</span>
                      </div>
                    </div>

                    {/* Confidence */}
                    <div className="mt-2 pt-2 border-t border-slate-700/50 flex items-center justify-between">
                      <span className="text-xs text-slate-400">Confidence</span>
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-400 rounded-full" 
                            style={{ width: `${chain.predictionConfidence}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-blue-400">{chain.predictionConfidence}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Budget Options */}
              <div className="mt-4">
                <h4 className="text-xs font-medium text-yellow-300 mb-2">Opzioni Budget</h4>
                <div className="grid grid-cols-3 gap-2">
                  {result.llmChains.filter(c => c.targetBudget).slice(0, 3).map((chain, i) => (
                    <div key={i} className="bg-slate-900/30 rounded-lg px-3 py-2 text-center">
                      <div className="text-xs font-medium text-slate-300">${chain.targetBudget}</div>
                      <div className="text-[10px] text-slate-500">Q{chain.finalQualityScore}</div>
                      <div className="text-[10px] text-green-400">{chain.estimatedTimeHours.toFixed(1)}h</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chain Type Legend */}
              <div className="mt-4 pt-3 border-t border-slate-700/50">
                <div className="flex flex-wrap gap-2">
                  {(['Free', 'Balanced', 'Premium', 'Fast', 'Hybrid', 'BudgetOptimized'] as ChainType[]).map(type => (
                    <div key={type} className="flex items-center gap-1">
                      <div 
                        className="w-2 h-2 rounded-full" 
                        style={{ backgroundColor: getChainTypeColor(type) }}
                      />
                      <span className="text-[10px] text-slate-400">{getChainTypeLabel(type)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Multimedia Analysis */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <Music className="w-4 h-4 text-cyan-400" /> Analisi Multimedia
              </h3>
              
              {/* Multimedia Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Music className="w-3 h-3 text-cyan-400" />
                    <span className="text-xs font-medium text-slate-300">Audio</span>
                  </div>
                  <div className="text-lg font-bold text-white">{result.multimediaAnalysis.audioStats.totalAudioFiles}</div>
                  <div className="text-xs text-slate-400">{result.multimediaAnalysis.audioStats.totalAudioSizeMb.toFixed(1)} MB</div>
                </div>
                
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Image className="w-3 h-3 text-emerald-400" />
                    <span className="text-xs font-medium text-slate-300">Grafica</span>
                  </div>
                  <div className="text-lg font-bold text-white">{result.multimediaAnalysis.graphicsStats.totalGraphicsFiles}</div>
                  <div className="text-xs text-slate-400">{result.multimediaAnalysis.graphicsStats.totalGraphicsSizeMb.toFixed(1)} MB</div>
                </div>
                
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-3 h-3 text-purple-400" />
                    <span className="text-xs font-medium text-slate-300">Tempo</span>
                  </div>
                  <div className="text-lg font-bold text-white">
                    {(result.multimediaAnalysis.multimediaEstimates.audioEditingHours + result.multimediaAnalysis.multimediaEstimates.graphicsEditingHours).toFixed(1)}h
                  </div>
                  <div className="text-xs text-slate-400">Editing stimato</div>
                </div>
                
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-3 h-3 text-yellow-400" />
                    <span className="text-xs font-medium text-slate-300">Costi</span>
                  </div>
                  <div className="text-lg font-bold text-white">${result.multimediaAnalysis.multimediaEstimates.toolCostsUsd.toFixed(0)}</div>
                  <div className="text-xs text-slate-400">Tool professionali</div>
                </div>
              </div>

              {/* Audio Details */}
              <div className="mb-4">
                <h4 className="text-xs font-medium text-cyan-300 mb-2">Audio ({result.multimediaAnalysis.audioStats.totalAudioFiles} file)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="bg-slate-900/30 rounded-lg p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400">Localizzabili</span>
                      <span className="text-xs font-mono text-cyan-400">{result.multimediaAnalysis.audioStats.localizableAudioFiles}</span>
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400">Musica/Ambient</span>
                      <span className="text-xs font-mono text-slate-300">{result.multimediaAnalysis.audioStats.musicAmbientFiles}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Compressi</span>
                      <span className="text-xs font-mono text-orange-400">{result.multimediaAnalysis.audioStats.compressedAudioFiles}</span>
                    </div>
                  </div>
                  
                  <div className="bg-slate-900/30 rounded-lg p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400">Qualità</span>
                      <div className="flex items-center gap-1">
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: getAudioQualityColor(result.multimediaAnalysis.audioStats.predominantQuality) }}
                        />
                        <span className="text-xs font-mono text-slate-300">
                          {getAudioQualityLabel(result.multimediaAnalysis.audioStats.predominantQuality)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400">Durata tot.</span>
                      <span className="text-xs font-mono text-slate-300">{result.multimediaAnalysis.audioStats.estimatedTotalMinutes.toFixed(0)} min</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Streaming</span>
                      <span className="text-xs font-mono text-purple-400">{result.multimediaAnalysis.audioStats.streamingAudioFiles}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Graphics Details */}
              <div className="mb-4">
                <h4 className="text-xs font-medium text-emerald-300 mb-2">Grafica ({result.multimediaAnalysis.graphicsStats.totalGraphicsFiles} file)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="bg-slate-900/30 rounded-lg p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400">Con testo</span>
                      <span className="text-xs font-mono text-emerald-400">{result.multimediaAnalysis.graphicsStats.textContainingGraphics}</span>
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400">UI/Interfaccia</span>
                      <span className="text-xs font-mono text-slate-300">{result.multimediaAnalysis.graphicsStats.uiInterfaceFiles}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Texture/Sprite</span>
                      <span className="text-xs font-mono text-slate-300">{result.multimediaAnalysis.graphicsStats.textureSpriteFiles}</span>
                    </div>
                  </div>
                  
                  <div className="bg-slate-900/30 rounded-lg p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400">Testo embedded</span>
                      <span className="text-xs font-mono text-orange-400">{result.multimediaAnalysis.graphicsStats.embeddedTextFiles}</span>
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400">Animati</span>
                      <span className="text-xs font-mono text-purple-400">{result.multimediaAnalysis.graphicsStats.animatedFiles}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Risoluzione</span>
                      <span className="text-xs font-mono text-slate-300">{result.multimediaAnalysis.graphicsStats.predominantResolution}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recommended Tools */}
              <div className="mb-4">
                <h4 className="text-xs font-medium text-purple-300 mb-2">Tool Raccomandati</h4>
                <div className="space-y-2">
                  {/* Audio Tools */}
                  {result.multimediaAnalysis.recommendedTools.audioTools.length > 0 && (
                    <div className="bg-slate-900/30 rounded-lg p-2">
                      <div className="text-xs font-medium text-cyan-300 mb-1">Audio</div>
                      <div className="flex flex-wrap gap-1">
                        {result.multimediaAnalysis.recommendedTools.audioTools.slice(0, 3).map((tool, i) => (
                          <div key={i} className="flex items-center gap-1 bg-slate-800/50 rounded px-2 py-1">
                            <span className="text-[10px] font-medium text-slate-300">{tool.name}</span>
                            <span className="text-[8px] px-1 rounded bg-slate-700 text-slate-400">
                              {getLearningCurveLabel(tool.learningCurve)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Graphics Tools */}
                  {result.multimediaAnalysis.recommendedTools.graphicsTools.length > 0 && (
                    <div className="bg-slate-900/30 rounded-lg p-2">
                      <div className="text-xs font-medium text-emerald-300 mb-1">Grafica</div>
                      <div className="flex flex-wrap gap-1">
                        {result.multimediaAnalysis.recommendedTools.graphicsTools.slice(0, 3).map((tool, i) => (
                          <div key={i} className="flex items-center gap-1 bg-slate-800/50 rounded px-2 py-1">
                            <span className="text-[10px] font-medium text-slate-300">{tool.name}</span>
                            <span className="text-[8px] px-1 rounded bg-slate-700 text-slate-400">
                              {getLearningCurveLabel(tool.learningCurve)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Problematic Files */}
              {result.multimediaAnalysis.problematicFiles.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-orange-300 mb-2">File Problematici</h4>
                  <div className="space-y-1">
                    {result.multimediaAnalysis.problematicFiles.slice(0, 3).map((problem, i) => (
                      <div key={i} className="bg-slate-900/30 rounded-lg p-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-slate-300">{problem.filePath}</span>
                          <div className="flex items-center gap-1">
                            <div 
                              className="w-2 h-2 rounded-full" 
                              style={{ backgroundColor: getProblemSeverityColor(problem.severity) }}
                            />
                            <span className="text-[8px] text-slate-400">
                              {getProblemSeverityLabel(problem.severity)}
                            </span>
                          </div>
                        </div>
                        <div className="text-xs text-slate-400">{problem.description}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {problem.suggestedSolutions.slice(0, 2).map((solution, j) => (
                            <span key={j} className="text-[8px] bg-slate-700/50 rounded px-1 text-slate-300">
                              {solution}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Complexity Score */}
              <div className="pt-3 border-t border-slate-700/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Complessità Multimediale</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full" 
                        style={{ width: `${result.multimediaAnalysis.multimediaComplexityScore}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-orange-400">{result.multimediaAnalysis.multimediaComplexityScore}/100</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2: Languages + Formats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Languages */}
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-emerald-400" /> Lingue Rilevate
                </h3>
                {result.detectedLanguages.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">Nessuna lingua rilevata nei file — le stringhe potrebbero essere in file binari</p>
                ) : (
                  <div className="space-y-2">
                    {result.detectedLanguages.map(lang => (
                      <div key={lang.code} className="flex items-center justify-between bg-slate-900/50 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">{lang.code}</span>
                          <span className="text-sm text-slate-300">{lang.name}</span>
                          {lang.code === targetLang && (
                            <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full">TARGET</span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-slate-400">{lang.fileCount} file</span>
                          {lang.totalSizeKb > 0 && (
                            <span className="text-xs text-slate-500 ml-2">{lang.totalSizeKb} KB</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* File Formats */}
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-400" /> Formati File
                </h3>
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-2">
                  {result.fileFormats.map(fmt => (
                    <div key={fmt.extension} className="flex items-center gap-2 text-xs">
                      <span className={`w-2 h-2 rounded-full ${fmt.translatable ? 'bg-green-500' : 'bg-slate-600'}`} />
                      <span className="font-mono text-slate-300 w-16">.{fmt.extension}</span>
                      <span className="text-slate-500 flex-1 truncate">{fmt.description}</span>
                      <span className="text-slate-400 tabular-nums">{fmt.count}</span>
                      <span className="text-slate-600 w-16 text-right">{fmt.totalSizeKb > 1024 ? `${(fmt.totalSizeKb/1024).toFixed(1)} MB` : `${fmt.totalSizeKb} KB`}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 mt-3 pt-3 border-t border-slate-700/50 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Traducibile</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-600" /> Binario</span>
                </div>
              </div>
            </div>

            {/* Row 3: Largest Files */}
            {result.textStats.largestFiles.length > 0 && (
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-yellow-400" /> File di Testo più Grandi
                </h3>
                <div className="space-y-1.5">
                  {result.textStats.largestFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs bg-slate-900/30 rounded-lg px-3 py-2">
                      <span className="text-slate-500 w-5">{i + 1}.</span>
                      <span className="font-mono text-slate-300 flex-1 truncate">{f.path}</span>
                      <span className="font-mono text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded">.{f.format}</span>
                      <span className="text-slate-400 tabular-nums w-20 text-right font-semibold">
                        {f.sizeKb > 1024 ? `${(f.sizeKb/1024).toFixed(1)} MB` : `${f.sizeKb} KB`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Row 4: Time Estimates per Model */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" /> Stima Tempo per Modello
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {result.timeEstimates.map(te => (
                  <div key={te.modelName} className="bg-slate-900/50 border border-slate-700/30 rounded-xl p-3.5">
                    <div className="flex items-center gap-2 mb-2">
                      {te.provider.includes('locale') ? <Server className="w-3.5 h-3.5 text-cyan-400" /> : <Cloud className="w-3.5 h-3.5 text-blue-400" />}
                      <span className="text-xs font-bold text-slate-200">{te.modelName}</span>
                    </div>
                    <p className="text-[10px] text-slate-500">{te.modelSize} • {te.provider}</p>
                    <div className="mt-2.5">
                      <p className="text-lg font-black text-slate-200">
                        {te.estimatedHours < 1 ? `${Math.round(te.estimatedHours * 60)}m` : `${te.estimatedHours.toFixed(1)}h`}
                      </p>
                      <p className="text-[10px] text-slate-500">{te.speedStringsPerMin}/min</p>
                    </div>
                    <div className="mt-2">
                      <p className="text-[10px] text-slate-500 mb-0.5">Qualità</p>
                      <QualityBar score={te.qualityScore} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Row 5: Chain Estimates */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" /> Chain di Traduzione
              </h3>
              <div className="space-y-3">
                {result.chainEstimates.map(ce => {
                  const isExpanded = expandedChain === ce.chainName;
                  const isRecommended = ce.chainName.includes('Consigliato');
                  return (
                    <div key={ce.chainName}
                      className={`border rounded-xl overflow-hidden transition-all cursor-pointer ${
                        isRecommended ? 'border-purple-500/40 bg-purple-900/10' : 'border-slate-700/40 bg-slate-900/30'
                      }`}
                      onClick={() => setExpandedChain(isExpanded ? null : ce.chainName)}
                    >
                      <div className="px-4 py-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-200">{ce.chainName}</span>
                            {isRecommended && (
                              <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                <Star className="w-2.5 h-2.5" /> Consigliato
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 truncate">{ce.description}</p>
                        </div>
                        <div className="flex items-center gap-4 text-right shrink-0">
                          <div>
                            <p className="text-sm font-bold text-slate-200">
                              {ce.estimatedHours < 1 ? `${Math.round(ce.estimatedHours * 60)}m` : `${ce.estimatedHours.toFixed(1)}h`}
                            </p>
                            <p className="text-[10px] text-slate-500">tempo</p>
                          </div>
                          <div className="w-16">
                            <QualityBar score={ce.qualityScore} />
                            <p className="text-[10px] text-slate-500 text-center">qualità</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-emerald-400">{ce.costEstimate}</p>
                            <p className="text-[10px] text-slate-500">costo</p>
                          </div>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="px-4 pb-3 pt-1 border-t border-slate-700/30">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Pipeline</p>
                          <div className="space-y-1.5">
                            {ce.steps.map((step, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs text-slate-400">
                                <span className="text-purple-400 mt-0.5">▸</span>
                                <span>{step}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Row 6: Recommended Method */}
            <div className="bg-gradient-to-r from-purple-900/20 to-indigo-900/20 border border-purple-500/20 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-purple-300 mb-2 flex items-center gap-2">
                <Info className="w-4 h-4" /> Metodo Consigliato
              </h3>
              <p className="text-sm text-slate-300">{result.recommendedMethod}</p>
              {result.textStats.localizationFolders.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Cartelle Localizzazione Trovate</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.textStats.localizationFolders.map((f, i) => (
                      <span key={i} className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">{f}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
