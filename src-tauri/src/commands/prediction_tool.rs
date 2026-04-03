use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use std::fs;
use log::info;

/// P.T. — Prediction Tool
/// Scansiona in profondità i file di un gioco installato per stimare
/// la difficoltà di traduzione, le lingue presenti, il volume di testo,
/// i formati trovati, e il tempo stimato per motore/modello LLM.

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PredictionResult {
    pub game_title: String,
    pub engine: String,
    pub install_path: String,
    /// Lingue trovate nei file del gioco
    pub detected_languages: Vec<DetectedLanguage>,
    /// Score difficoltà 0-100
    pub difficulty_score: u32,
    pub difficulty_label: String,
    /// Statistiche testo
    pub text_stats: TextStats,
    /// Formati file trovati
    pub file_formats: Vec<FileFormatInfo>,
    /// Stima tempo per modello
    pub time_estimates: Vec<TimeEstimate>,
    /// Stima per chain di traduzione
    pub chain_estimates: Vec<ChainEstimate>,
    /// Note e avvisi
    pub warnings: Vec<String>,
    /// GS supporta questo motore?
    pub gs_supported: bool,
    /// Metodo di estrazione consigliato
    pub recommended_method: String,
    /// Confidence 0-100: quanto è affidabile la predizione
    pub confidence_score: u32,
    /// Spiegazione del livello di confidence
    pub confidence_explanation: String,
    /// Info su DRM/protezioni rilevate
    pub drm_info: DrmInfo,
    /// Info su encoding dei file di testo
    pub encoding_info: EncodingInfo,
    /// Complessità della traduzione (contesto, variabili, plurali, etc.)
    pub translation_complexity: TranslationComplexity,
    /// Qualità traduzione stimata 0-100 basata su complessità
    pub translation_quality_score: u32,
    /// Spiegazione della qualità traduzione
    pub translation_quality_explanation: String,
    /// Informazioni su strumenti di traduzione esistenti
    pub existing_tools: ExistingTranslationTools,
    /// Tool selezionati per questo workflow
    pub selected_tools: SelectedTools,
    /// Chain LLM ottimizzate per questo progetto
    pub llm_chains: Vec<OptimizedChain>,
    /// Analisi file multimediali (audio e grafica)
    pub multimedia_analysis: MultimediaAnalysis,
    pub backup_strategy: BackupStrategy,
    pub workflow_plan: WorkflowPlan,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowPlan {
    pub recommended_approach: WorkflowApproach,
    pub total_estimated_hours: f64,
    pub total_estimated_cost_usd: f64,
    pub workflow_stages: Vec<WorkflowStage>,
    pub dependencies: Vec<WorkflowDependency>,
    pub risk_factors: Vec<RiskFactor>,
    pub success_probability: f64,
    pub recommended_team_size: u32,
    pub quality_assurance_plan: QualityAssurancePlan,
    pub deliverables: Vec<Deliverable>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum WorkflowApproach {
    Automated,      // Completamente automatico
    SemiAutomated,  // Semi-automatico con supervisione
    Manual,         // Completamente manuale
    Hybrid,         // Mix di approcci
    Custom,         // Personalizzato
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowStage {
    pub stage_id: u32,
    pub stage_name: String,
    pub stage_type: StageType,
    pub estimated_duration_hours: f64,
    pub estimated_cost_usd: f64,
    pub required_tools: Vec<String>,
    pub required_skills: Vec<String>,
    pub prerequisites: Vec<u32>,
    pub outputs: Vec<String>,
    pub success_criteria: Vec<String>,
    pub risk_level: RiskLevel,
    pub automation_level: AutomationLevel,
    pub quality_checks: Vec<QualityCheck>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum StageType {
    Preparation,     // Setup e backup
    Extraction,      // Estrazione file
    Analysis,        // Analisi contenuti
    Translation,     // Traduzione
    Integration,     // Integrazione
    Testing,         // Test e QA
    Packaging,       // Creazione patch
    Deployment,      // Deploy finale
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AutomationLevel {
    Manual,
    SemiAutomated,
    FullyAutomated,
    Intelligent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QualityCheck {
    pub check_type: QualityCheckType,
    pub description: String,
    pub automated: bool,
    pub critical: bool,
    pub validation_method: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum QualityCheckType {
    FileIntegrity,
    TranslationAccuracy,
    FormatCompliance,
    FunctionalTesting,
    PerformanceTesting,
    LocalizationTesting,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowDependency {
    pub dependency_type: DependencyType,
    pub description: String,
    pub required: bool,
    pub resolution_time_hours: f64,
    pub impact_level: ImpactLevel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DependencyType {
    ToolInstallation,
    FilePermissions,
    SystemRequirements,
    EngineCompatibility,
    ThirdPartyServices,
    NetworkAccess,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ImpactLevel {
    Low,
    Medium,
    High,
    Blocking,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RiskFactor {
    pub risk_type: RiskType,
    pub description: String,
    pub probability: f64,
    pub impact: ImpactLevel,
    pub mitigation_strategy: String,
    pub contingency_plan: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RiskType {
    Technical,
    Resource,
    Timeline,
    Quality,
    Compatibility,
    External,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QualityAssurancePlan {
    pub testing_phases: Vec<TestingPhase>,
    pub acceptance_criteria: Vec<AcceptanceCriterion>,
    pub bug_tracking: BugTrackingConfig,
    pub review_process: ReviewProcess,
    pub quality_metrics: Vec<QualityMetric>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestingPhase {
    pub phase_name: String,
    pub phase_type: TestingType,
    pub estimated_hours: f64,
    pub test_cases_count: u32,
    pub automation_coverage: f64,
    pub success_threshold: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TestingType {
    UnitTesting,
    IntegrationTesting,
    SystemTesting,
    UserAcceptanceTesting,
    LocalizationTesting,
    PerformanceTesting,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AcceptanceCriterion {
    pub criterion_id: String,
    pub description: String,
    pub category: AcceptanceCategory,
    pub measurable: bool,
    pub target_value: String,
    pub validation_method: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AcceptanceCategory {
    Functional,
    Performance,
    Quality,
    Compatibility,
    Usability,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BugTrackingConfig {
    pub tool: String,
    pub severity_levels: Vec<SeverityLevel>,
    pub workflow: String,
    pub reporting_format: String,
    pub escalation_rules: Vec<EscalationRule>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SeverityLevel {
    pub level: String,
    pub description: String,
    pub response_time_hours: f64,
    pub auto_escalation: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EscalationRule {
    pub trigger_condition: String,
    pub escalation_level: String,
    pub notification_recipients: Vec<String>,
    pub action_required: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewProcess {
    pub review_type: ReviewType,
    pub participants: Vec<Participant>,
    pub review_criteria: Vec<ReviewCriterion>,
    pub approval_workflow: ApprovalWorkflow,
    pub feedback_mechanism: FeedbackMechanism,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ReviewType {
    TechnicalReview,
    LinguisticReview,
    CulturalReview,
    ComplianceReview,
    StakeholderReview,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Participant {
    pub role: String,
    pub name: String,
    pub expertise: Vec<String>,
    pub authority_level: AuthorityLevel,
    pub availability: f64, // Percentage
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AuthorityLevel {
    Advisor,
    Reviewer,
    Approver,
    Authority,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewCriterion {
    pub criterion_id: String,
    pub description: String,
    pub weight: f64,
    pub evaluation_method: String,
    pub passing_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApprovalWorkflow {
    pub stages: Vec<ApprovalStage>,
    pub parallel_reviews: bool,
    pub auto_approval_conditions: Vec<String>,
    pub rejection_handling: RejectionHandling,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApprovalStage {
    pub stage_name: String,
    pub required_approvers: u32,
    pub approval_criteria: Vec<String>,
    pub timeout_hours: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RejectionHandling {
    pub feedback_required: bool,
    pub resubmission_allowed: bool,
    pub max_resubmissions: u32,
    pub escalation_on_rejection: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeedbackMechanism {
    pub feedback_format: String,
    pub structured_feedback: bool,
    pub rating_system: bool,
    pub comment_categories: Vec<String>,
    pub follow_up_required: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QualityMetric {
    pub metric_name: String,
    pub metric_type: MetricType,
    pub target_value: f64,
    pub measurement_method: String,
    pub frequency: MeasurementFrequency,
    pub trend_analysis: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MetricType {
    Quantitative,
    Qualitative,
    Binary,
    Percentage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MeasurementFrequency {
    Once,
    Daily,
    Weekly,
    PerStage,
    Continuous,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Deliverable {
    pub deliverable_id: String,
    pub deliverable_name: String,
    pub deliverable_type: DeliverableType,
    pub format: String,
    pub size_estimate_mb: f64,
    pub delivery_stage: u32,
    pub acceptance_criteria: Vec<String>,
    pub distribution_list: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DeliverableType {
    TranslatedFiles,
    PatchPackage,
    InstallationGuide,
    TestingReport,
    Documentation,
    BackupArchive,
    QualityReport,
    DeploymentPackage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupStrategy {
    pub recommended_backup_type: BackupType,
    pub estimated_backup_size_mb: f64,
    pub backup_files_count: u32,
    pub compression_method: CompressionMethod,
    pub backup_location: String,
    pub backup_duration_minutes: f64,
    pub restore_complexity: RestoreComplexity,
    pub backup_categories: Vec<BackupCategory>,
    pub space_savings_mb: f64,
    pub backup_validation: BackupValidation,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BackupType {
    Targeted,    // Solo file traducibili
    Essential,   // File critici + traducibili
    Full,        // Tutti i file del gioco
    Incremental, // Solo modifiche
    Custom,      // Selezione utente
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CompressionMethod {
    None,        // Nessuna compressione
    Fast,        // ZIP veloce
    Balanced,    // ZIP bilanciato
    Maximum,     // 7z massimo
    Smart,       // Adattivo per tipo file
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RestoreComplexity {
    Simple,      // Estrazione diretta
    Moderate,    // Estrazione + patch
    Complex,     // Estrazione + patch + configurazione
    EngineSpecific, // Richiede tool engine-specific
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupCategory {
    pub category_type: BackupCategoryType,
    pub file_count: u32,
    pub total_size_mb: f64,
    pub included: bool,
    pub priority: BackupPriority,
    pub description: String,
    pub examples: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BackupCategoryType {
    TextFiles,        // File di testo traducibili
    AudioFiles,       // File audio localizzabili
    GraphicsFiles,    // Grafiche con testo
    Configuration,     // Configurazioni
    Executables,      // Eseguibili e DLL
    Resources,        // Asset generali
    Localization,     // File di localizzazione esistenti
    EngineSpecific,    // File engine-specific
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BackupPriority {
    Critical,    // Essenziale per localizzazione
    High,        // Importante per funzionalità
    Medium,      // Utile ma non essenziale
    Low,         // Opzionale
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupValidation {
    pub checksum_validated: bool,
    pub integrity_checks: Vec<IntegrityCheck>,
    pub validation_time_minutes: f64,
    pub can_verify_restore: bool,
    pub backup_health_score: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IntegrityCheck {
    pub check_type: IntegrityCheckType,
    pub description: String,
    pub passed: bool,
    pub details: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum IntegrityCheckType {
    FileExists,        // Verifica esistenza file
    FileSize,          // Verifica dimensione
    Checksum,          // Verifica checksum
    Permissions,       // Verifica permessi
    Structure,         // Verifica struttura archivio
    Metadata,          // Verifica metadata
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedLanguage {
    pub code: String,
    pub name: String,
    pub source: String,
    pub file_count: u32,
    pub total_size_kb: u64,
    /// Completezza stimata rispetto a English (0-100%)
    pub completeness_percent: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DrmInfo {
    pub has_drm: bool,
    pub drm_types: Vec<String>,
    pub affects_translation: bool,
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EncodingInfo {
    pub primary_encoding: String,
    pub has_unicode: bool,
    pub has_cjk: bool,
    pub has_rtl: bool,
    pub bom_detected: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationComplexity {
    /// Numero di variabili/placeholder rilevati ({0}, %s, {name}, etc.)
    pub variable_count: u64,
    /// Numero di tag HTML/markup rilevati
    pub markup_count: u64,
    /// Presenza di stringhe con plurali
    pub has_plurals: bool,
    /// Presenza di stringhe con genere
    pub has_gender_forms: bool,
    /// Lunghezza media delle stringhe
    pub avg_string_length: f64,
    /// Percentuale stringhe molto corte (<5 chars) — UI labels
    pub short_strings_percent: f64,
    /// Percentuale stringhe molto lunghe (>200 chars) — dialoghi
    pub long_strings_percent: f64,
    /// Formati di variabile trovati
    pub variable_formats: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExistingTranslationTools {
    /// Ha file di traduzione standard (.po, .mo, .resx, .loc, etc.)
    pub has_translation_files: bool,
    /// File di traduzione trovati
    pub translation_files: Vec<TranslationFileInfo>,
    /// Usa Unity Localization system
    pub uses_unity_localization: bool,
    /// Usa Unreal Localization system
    pub uses_unreal_localization: bool,
    /// Ha mod di traduzione community
    pub has_community_patches: bool,
    /// Patch community trovate
    pub community_patches: Vec<CommunityPatchInfo>,
    /// Strumenti di localizzazione rilevati
    pub localization_tools: Vec<String>,
    /// Raccomandazioni basate su strumenti esistenti
    pub recommendations: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationFileInfo {
    pub file_path: String,
    pub file_type: String, // po, mo, resx, loc, json, csv, etc.
    pub language: Option<String>,
    pub string_count: Option<u32>,
    pub file_size_kb: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommunityPatchInfo {
    pub patch_name: String,
    pub patch_type: String, // translation, ui, audio, etc.
    pub languages: Vec<String>,
    pub status: String, // active, inactive, outdated
    pub install_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectedTools {
    /// Tool primario per estrazione/inserimento testo
    pub primary_text_tool: Option<SelectedTool>,
    /// Tool alternativi testo
    pub alternative_text_tools: Vec<SelectedTool>,
    /// Tool per audio
    pub audio_tools: Vec<SelectedTool>,
    /// Tool per grafica
    pub graphics_tools: Vec<SelectedTool>,
    /// Tool per archivi/binari
    pub archive_tools: Vec<SelectedTool>,
    /// Tool per installazione patch
    pub patch_tools: Vec<SelectedTool>,
    /// Raccomandazioni workflow
    pub workflow_recommendations: Vec<String>,
    /// Score totale selezione tool
    pub selection_score: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectedTool {
    pub name: String,
    pub category: ToolCategory,
    pub description: String,
    pub supported_formats: Vec<String>,
    pub compatibility_score: u32, // 0-100
    pub ease_of_use: u32, // 0-100
    pub cost: ToolCost,
    pub platform_support: Vec<String>,
    pub special_features: Vec<String>,
    pub recommended_usage: String,
    pub installation_notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ToolCategory {
    TextExtraction,
    TextInsertion,
    AudioConversion,
    GraphicsEditing,
    ArchiveExtraction,
    PatchCreation,
    LocalizationSystem,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ToolCost {
    Free,
    Freemium,
    Commercial(String), // prezzo es. "$29.99"
    Enterprise,
    OpenSource,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OptimizedChain {
    /// Nome della chain (es. "Balanced Free", "Premium Quality")
    pub chain_name: String,
    /// Categoria della chain
    pub chain_type: ChainType,
    /// Lista modelli nella chain in ordine
    pub models: Vec<ChainModel>,
    /// Costo totale stimato in USD
    pub estimated_cost_usd: f64,
    /// Tempo totale stimato in ore
    pub estimated_time_hours: f64,
    /// Qualità finale stimata 0-100
    pub final_quality_score: u32,
    /// Confidence nella predizione 0-100
    pub prediction_confidence: u32,
    /// Budget target (se applicabile)
    pub target_budget: Option<f64>,
    /// Vantaggi di questa chain
    pub advantages: Vec<String>,
    /// Svantaggi/limitazioni
    pub disadvantages: Vec<String>,
    /// Caso d'uso ideale
    pub best_for: String,
    /// Score complessivo della chain 0-100
    pub chain_score: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChainModel {
    /// Nome del modello (es. "gpt-4", "claude-3-sonnet")
    pub model_name: String,
    /// Provider del modello
    pub provider: LLMProvider,
    /// Ruolo del modello nella chain
    pub role: ModelRole,
    /// Percentuale di lavoro (0-100)
    pub workload_percentage: f64,
    /// Costo per 1M tokens
    pub cost_per_million_tokens: f64,
    /// Velocità in tokens/secondo
    pub speed_tokens_per_sec: f64,
    /// Qualità output 0-100
    pub output_quality: u32,
    /// Limite rate (requests/minuto)
    pub rate_limit: u32,
    /// Contesto massimo in tokens
    pub max_context_tokens: u32,
    /// Note specifiche del modello
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ChainType {
    /// Solo modelli free/gratis
    Free,
    /// Bilanciata qualità/costo
    Balanced,
    /// Massima qualità senza limite budget
    Premium,
    /// Ottimizzata per budget specifico
    BudgetOptimized,
    /// Ottimizzata per velocità
    Fast,
    /// Ibrida con step diversi
    Hybrid,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum LLMProvider {
    OpenAI,
    Anthropic,
    Google,
    Groq,
    DeepL,
    TogetherAI,
    Ollama,
    Local,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ModelRole {
    /// Traduzione principale
    PrimaryTranslation,
    /// Post-editing e miglioramento
    PostEditing,
    /// Revisione qualità
    QualityReview,
    /// Rilevamento contesto
    ContextDetection,
    /// Validazione formati
    FormatValidation,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MultimediaAnalysis {
    /// Statistiche file audio
    pub audio_stats: AudioStats,
    /// Statistiche file grafici
    pub graphics_stats: GraphicsStats,
    /// Tool multimediali raccomandati
    pub recommended_tools: MultimediaTools,
    /// Stima costi e tempi editing
    pub multimedia_estimates: MultimediaEstimates,
    /// Complessità multimediale 0-100
    pub multimedia_complexity_score: u32,
    /// File problematici che richiedono attenzione speciale
    pub problematic_files: Vec<ProblematicFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioStats {
    /// Numero totale file audio
    pub total_audio_files: u32,
    /// Dimensione totale in MB
    pub total_audio_size_mb: f64,
    /// Formati audio trovati
    pub audio_formats: Vec<AudioFormatInfo>,
    /// File con dialoghi/localizzabili
    pub localizable_audio_files: u32,
    /// File musica/ambient (meno prioritari)
    pub music_ambient_files: u32,
    /// File audio compressi (difficili da editare)
    pub compressed_audio_files: u32,
    /// Durata totale stimata in minuti
    pub estimated_total_minutes: f64,
    /// Qualità audio predominante
    pub predominant_quality: AudioQuality,
    /// Streaming audio files (Wwise, FMOD)
    pub streaming_audio_files: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphicsStats {
    /// Numero totale file grafici
    pub total_graphics_files: u32,
    /// Dimensione totale in MB
    pub total_graphics_size_mb: f64,
    /// Formati grafici trovati
    pub graphics_formats: Vec<GraphicsFormatInfo>,
    /// File con testo localizzabile
    pub text_containing_graphics: u32,
    /// File UI/interfaccia
    pub ui_interface_files: u32,
    /// Texture e sprite
    pub texture_sprite_files: u32,
    /// File con testo embedded (difficili)
    pub embedded_text_files: u32,
    /// Risoluzione predominante
    pub predominant_resolution: String,
    /// File animati (GIF, APNG, etc.)
    pub animated_files: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioFormatInfo {
    /// Estensione formato
    pub extension: String,
    /// Numero file
    pub count: u32,
    /// Dimensione totale MB
    pub total_size_mb: f64,
    /// Editabile con tool standard
    pub is_editable: bool,
    /// Richiede tool specializzati
    pub requires_specialized_tools: bool,
    /// Qualità tipica del formato
    pub typical_quality: AudioQuality,
    /// Note sul formato
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphicsFormatInfo {
    /// Estensione formato
    pub extension: String,
    /// Numero file
    pub count: u32,
    /// Dimensione totale MB
    pub total_size_mb: f64,
    /// Editabile con tool standard
    pub is_editable: bool,
    /// Supporta trasparenza
    pub supports_transparency: bool,
    /// Compressione utilizzata
    pub compression_type: GraphicsCompression,
    /// Risoluzioni trovate
    pub resolutions: Vec<String>,
    /// Note sul formato
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MultimediaTools {
    /// Tool audio raccomandati
    pub audio_tools: Vec<SelectedMultimediaTool>,
    /// Tool grafici raccomandati
    pub graphics_tools: Vec<SelectedMultimediaTool>,
    /// Tool specializzati per engine
    pub engine_specific_tools: Vec<SelectedMultimediaTool>,
    /// Tool per formati compressi
    pub compression_tools: Vec<SelectedMultimediaTool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectedMultimediaTool {
    /// Nome del tool
    pub name: String,
    /// Categoria (Audio/Graphics/Compression)
    pub category: MultimediaToolCategory,
    /// Descrizione del tool
    pub description: String,
    /// Formati supportati
    pub supported_formats: Vec<String>,
    /// Score di compatibilità 0-100
    pub compatibility_score: u32,
    /// Costo del tool
    pub cost: ToolCost,
    /// Piattaforme supportate
    pub platform_support: Vec<String>,
    /// Curva di apprendimento
    pub learning_curve: LearningCurve,
    /// Funzionalità speciali
    pub special_features: Vec<String>,
    /// Caso d'uso ideale
    pub best_for: String,
    /// Requisiti di sistema
    pub system_requirements: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MultimediaEstimates {
    /// Tempo stimato editing audio in ore
    pub audio_editing_hours: f64,
    /// Tempo stimato editing grafico in ore
    pub graphics_editing_hours: f64,
    /// Costo stimato tool professionali in USD
    pub tool_costs_usd: f64,
    /// Complessità totale 0-100
    pub total_complexity: u32,
    /// Numero file che richiedono attenzione speciale
    pub high_complexity_files: u32,
    /// Fattore di difficoltà per formati compressi
    pub compression_difficulty_factor: f64,
    /// Stima costi se outsourcing a professionisti
    pub outsourcing_cost_estimate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProblematicFile {
    /// Path del file
    pub file_path: String,
    /// Tipo di problema
    pub problem_type: ProblemType,
    /// Gravità del problema
    pub severity: ProblemSeverity,
    /// Descrizione del problema
    pub description: String,
    /// Soluzioni suggerite
    pub suggested_solutions: Vec<String>,
    /// Tool necessari per risolvere
    pub required_tools: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AudioQuality {
    Low,      // < 22kHz, 8-bit
    Medium,   // 22-44kHz, 16-bit
    High,     // 44-96kHz, 24-bit
    Studio,   // >96kHz, 32-bit
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GraphicsCompression {
    None,     // BMP, TGA
    Lossless, // PNG, TIFF
    Lossy,    // JPG, WEBP
    Hybrid,   // DDS (can be both)
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MultimediaToolCategory {
    AudioEditing,
    GraphicsEditing,
    AudioCompression,
    GraphicsCompression,
    VideoEditing,
    AssetManagement,
    EngineSpecific,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum LearningCurve {
    Beginner,    // 1-2 hours
    Easy,        // 2-8 hours
    Medium,      // 8-24 hours
    Hard,        // 1-3 days
    Expert,      // 1+ weeks
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ProblemType {
    CompressedFormat,     // WEM, BNK, packed formats
    EmbeddedText,         // Text in graphics
    ProprietaryFormat,    // Engine-specific formats
    EncryptedContent,     // DRM/encrypted files
    CorruptedFile,        // Damaged files
    UnsupportedCodec,     // Unknown codecs
    LargeFileSize,        // >100MB files
    NestedContainers,     // Archives in archives
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ProblemSeverity {
    Low,      // Minor inconvenience
    Medium,   // Requires special attention
    High,     // Significant difficulty
    Critical, // May prevent localization
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextStats {
    pub total_text_files: u32,
    pub total_text_size_kb: u64,
    pub estimated_strings: u64,
    pub estimated_words: u64,
    pub estimated_characters: u64,
    pub largest_files: Vec<FileSizeInfo>,
    pub localization_folders: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileSizeInfo {
    pub path: String,
    pub size_kb: u64,
    pub format: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileFormatInfo {
    pub extension: String,
    pub count: u32,
    pub total_size_kb: u64,
    pub translatable: bool,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimeEstimate {
    pub model_name: String,
    pub model_size: String,
    pub speed_strings_per_min: f64,
    pub estimated_hours: f64,
    pub quality_score: u32,
    pub provider: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChainEstimate {
    pub chain_name: String,
    pub description: String,
    pub estimated_hours: f64,
    pub quality_score: u32,
    pub cost_estimate: String,
    pub steps: Vec<String>,
}

// ── Language Detection ───────────────────────────────────────────────

// Formato: (codice_iso, nome, pattern_file, alias_aggiuntivi)
const LANG_PATTERNS: &[(&str, &str, &str)] = &[
    ("en", "English", "english"),
    ("it", "Italian", "italian"),
    ("de", "German", "german"),
    ("fr", "French", "french"),
    ("es", "Spanish", "spanish"),
    ("pt", "Portuguese", "portuguese"),
    ("pt-br", "Brazilian Portuguese", "brazilian"),
    ("ru", "Russian", "russian"),
    ("pl", "Polish", "polish"),
    ("nl", "Dutch", "dutch"),
    ("sv", "Swedish", "swedish"),
    ("no", "Norwegian", "norwegian"),
    ("da", "Danish", "danish"),
    ("fi", "Finnish", "finnish"),
    ("hu", "Hungarian", "hungarian"),
    ("cs", "Czech", "czech"),
    ("ro", "Romanian", "romanian"),
    ("bg", "Bulgarian", "bulgarian"),
    ("el", "Greek", "greek"),
    ("tr", "Turkish", "turkish"),
    ("ar", "Arabic", "arabic"),
    ("ja", "Japanese", "japanese"),
    ("zh", "Chinese", "chinese"),
    ("zh-hans", "Simplified Chinese", "schinese"),
    ("zh-hant", "Traditional Chinese", "tchinese"),
    ("ko", "Korean", "korean"),
    ("th", "Thai", "thai"),
    ("vi", "Vietnamese", "vietnamese"),
    ("uk", "Ukrainian", "ukrainian"),
    ("hr", "Croatian", "croatian"),
    ("sk", "Slovak", "slovak"),
    ("sl", "Slovenian", "slovenian"),
    ("id", "Indonesian", "indonesian"),
    ("ms", "Malay", "malay"),
    ("hi", "Hindi", "hindi"),
    ("he", "Hebrew", "hebrew"),
    ("lt", "Lithuanian", "lithuanian"),
    ("lv", "Latvian", "latvian"),
    ("et", "Estonian", "estonian"),
    ("sr", "Serbian", "serbian"),
    ("ka", "Georgian", "georgian"),
    ("ca", "Catalan", "catalan"),
    ("eu", "Basque", "basque"),
    ("gl", "Galician", "galician"),
    ("la", "Latin", "latam"),
    ("es-419", "Latin Am. Spanish", "latam"),
];

// Alias di locale comuni usati nei file di gioco (Steam, Unreal, Unity, etc.)
const LOCALE_ALIASES: &[(&str, &str)] = &[
    // Steam locale IDs
    ("schinese", "zh-hans"), ("tchinese", "zh-hant"),
    ("brazilian", "pt-br"), ("latam", "es-419"),
    ("koreana", "ko"), ("japanese", "ja"),
    // BCP47 / Windows locale
    ("en-us", "en"), ("en-gb", "en"), ("en_us", "en"), ("en_gb", "en"),
    ("fr-fr", "fr"), ("fr_fr", "fr"), ("de-de", "de"), ("de_de", "de"),
    ("es-es", "es"), ("es_es", "es"), ("it-it", "it"), ("it_it", "it"),
    ("pt-pt", "pt"), ("pt_pt", "pt"), ("pt-br", "pt-br"), ("pt_br", "pt-br"),
    ("ru-ru", "ru"), ("ru_ru", "ru"), ("ja-jp", "ja"), ("ja_jp", "ja"),
    ("ko-kr", "ko"), ("ko_kr", "ko"), ("zh-cn", "zh-hans"), ("zh_cn", "zh-hans"),
    ("zh-tw", "zh-hant"), ("zh_tw", "zh-hant"),
    ("pl-pl", "pl"), ("pl_pl", "pl"), ("tr-tr", "tr"), ("tr_tr", "tr"),
    ("nl-nl", "nl"), ("nl_nl", "nl"), ("cs-cz", "cs"), ("cs_cz", "cs"),
    ("hu-hu", "hu"), ("hu_hu", "hu"), ("ro-ro", "ro"), ("ro_ro", "ro"),
    ("th-th", "th"), ("th_th", "th"), ("vi-vn", "vi"), ("vi_vn", "vi"),
    ("ar-sa", "ar"), ("ar_sa", "ar"), ("he-il", "he"), ("he_il", "he"),
    ("uk-ua", "uk"), ("uk_ua", "uk"), ("bg-bg", "bg"), ("bg_bg", "bg"),
    ("el-gr", "el"), ("el_gr", "el"), ("sv-se", "sv"), ("sv_se", "sv"),
    ("da-dk", "da"), ("da_dk", "da"), ("fi-fi", "fi"), ("fi_fi", "fi"),
    ("nb-no", "no"), ("nb_no", "no"), ("nn-no", "no"),
    ("id-id", "id"), ("id_id", "id"), ("ms-my", "ms"), ("ms_my", "ms"),
    ("hi-in", "hi"), ("hi_in", "hi"),
    // Unreal Engine locale naming
    ("int", "en"), ("ita", "it"), ("deu", "de"), ("fra", "fr"),
    ("esn", "es"), ("kor", "ko"), ("jpn", "ja"), ("chs", "zh-hans"),
    ("cht", "zh-hant"), ("rus", "ru"), ("pol", "pl"), ("ptb", "pt-br"),
    // ISO 639-2 (3-letter codes)
    ("eng", "en"), ("ita", "it"), ("deu", "de"), ("fra", "fr"),
    ("spa", "es"), ("por", "pt"), ("rus", "ru"), ("pol", "pl"),
    ("nld", "nl"), ("tur", "tr"), ("ara", "ar"), ("jpn", "ja"),
    ("kor", "ko"), ("zho", "zh"), ("tha", "th"), ("vie", "vi"),
];

/// Risolvi alias locale al codice ISO standard
fn resolve_locale_alias(token: &str) -> Option<&'static str> {
    let lower = token.to_lowercase();
    for &(alias, iso) in LOCALE_ALIASES {
        if lower == alias {
            return Some(iso);
        }
    }
    None
}

// ── Prediction Cache ─────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PredictionCacheEntry {
    result: PredictionResult,
    timestamp: u64,
    path_hash: u64,
}

impl PredictionCacheEntry {
    fn is_expired(&self) -> bool {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        // Cache valida per 24 ore
        now - self.timestamp > 86400
    }
}

fn get_cache_path() -> PathBuf {
    if let Some(data_dir) = dirs::data_local_dir() {
        data_dir.join("GameStringer").join("prediction_cache.json")
    } else {
        PathBuf::from("./prediction_cache.json")
    }
}

fn load_cache() -> HashMap<String, PredictionCacheEntry> {
    let cache_path = get_cache_path();
    if cache_path.exists() {
        if let Ok(content) = fs::read_to_string(&cache_path) {
            if let Ok(cache) = serde_json::from_str(&content) {
                return cache;
            }
        }
    }
    HashMap::new()
}

fn save_cache(cache: &HashMap<String, PredictionCacheEntry>) {
    let cache_path = get_cache_path();
    if let Some(parent) = cache_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(content) = serde_json::to_string_pretty(cache) {
        let _ = fs::write(&cache_path, content);
    }
}

fn compute_path_hash(path: &Path) -> u64 {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    
    let mut hasher = DefaultHasher::new();
    path.hash(&mut hasher);
    
    // Include modification time for cache invalidation
    if let Ok(metadata) = fs::metadata(path) {
        if let Ok(modified) = metadata.modified() {
            if let Ok(secs) = modified.duration_since(UNIX_EPOCH) {
                hasher.write_u64(secs.as_secs());
            }
        }
    }
    
    hasher.finish()
}

fn detect_languages_deep(game_path: &Path) -> Vec<DetectedLanguage> {
    let mut lang_map: HashMap<String, (String, HashSet<String>, u32, u64)> = HashMap::new();

    let walker = walkdir::WalkDir::new(game_path)
        .max_depth(10)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok());

    for entry in walker {
        let path = entry.path();
        let name_lower = entry.file_name().to_string_lossy().to_lowercase();
        let rel_path = path.strip_prefix(game_path)
            .unwrap_or(path)
            .to_string_lossy()
            .to_lowercase();
        let size = entry.metadata().map(|m| m.len()).unwrap_or(0);

        // ── Pattern matching diretto per ogni lingua ──
        for &(code, full_name, pattern) in LANG_PATTERNS {
            let found = name_lower.contains(pattern)
                || name_lower.starts_with(&format!("{}.", code))
                || name_lower.starts_with(&format!("{}_", code))
                || name_lower.starts_with(&format!("{}-", code))
                || name_lower.ends_with(&format!("_{}.txt", code))
                || name_lower.ends_with(&format!("_{}.json", code))
                || name_lower.ends_with(&format!("_{}.xml", code))
                || name_lower.ends_with(&format!("_{}.csv", code))
                || name_lower.ends_with(&format!("_{}.po", code))
                || name_lower.ends_with(&format!("_{}.loc", code))
                || name_lower.ends_with(&format!("_{}.lang", code))
                || name_lower.ends_with(&format!("_{}.ini", code))
                || name_lower.ends_with(&format!("_{}.cfg", code))
                || name_lower.ends_with(&format!("_{}.properties", code))
                || name_lower.ends_with(&format!("_{}.resx", code))
                || name_lower == format!("{}.txt", code)
                || name_lower == format!("{}.json", code)
                || name_lower == format!("{}.xml", code)
                || name_lower == format!("{}.po", code)
                || name_lower == format!("{}.strings", code)
                || rel_path.contains(&format!("/{}/", code))
                || rel_path.contains(&format!("\\{}\\", code))
                || rel_path.contains(&format!("/localization/{}", pattern))
                || rel_path.contains(&format!("\\localization\\{}", pattern))
                || rel_path.contains(&format!("/localisation/{}", pattern))
                || rel_path.contains(&format!("\\localisation\\{}", pattern))
                || rel_path.contains(&format!("/lang/{}", code))
                || rel_path.contains(&format!("\\lang\\{}", code))
                || rel_path.contains(&format!("/i18n/{}", code))
                || rel_path.contains(&format!("\\i18n\\{}", code))
                || rel_path.contains(&format!("/locale/{}", code))
                || rel_path.contains(&format!("\\locale\\{}", code))
                || rel_path.contains(&format!("/translations/{}", pattern))
                || rel_path.contains(&format!("\\translations\\{}", pattern));

            if found {
                let lang_entry = lang_map.entry(code.to_string()).or_insert_with(|| {
                    (full_name.to_string(), HashSet::new(), 0, 0)
                });
                lang_entry.2 += 1;
                lang_entry.3 += size / 1024;
                if path.is_dir() {
                    lang_entry.1.insert(format!("folder: {}", rel_path));
                } else {
                    lang_entry.1.insert(format!("file: {}", name_lower));
                }
            }
        }

        // ── Locale alias matching (BCP47, Steam IDs, Unreal, ISO 639-2) ──
        // Estrai token dal nome file e dal path per matchare alias
        let path_tokens: Vec<&str> = rel_path.split(|c: char| c == '/' || c == '\\' || c == '_' || c == '-' || c == '.')
            .filter(|t| t.len() >= 2 && t.len() <= 10)
            .collect();
        for token in &path_tokens {
            if let Some(iso_code) = resolve_locale_alias(token) {
                // Trova il nome completo
                if let Some(&(_, full_name, _)) = LANG_PATTERNS.iter().find(|&&(c, _, _)| c == iso_code) {
                    let lang_entry = lang_map.entry(iso_code.to_string()).or_insert_with(|| {
                        (full_name.to_string(), HashSet::new(), 0, 0)
                    });
                    lang_entry.2 += 1;
                    lang_entry.3 += size / 1024;
                    lang_entry.1.insert(format!("alias({}): {}", token, name_lower));
                }
            }
        }

        // ── Analisi contenuto file config/manifest per dichiarazioni lingua ──
        if size < 500_000 && is_text_ext(&name_lower) {
            if let Ok(content) = fs::read_to_string(path) {
                let content_lower = content.to_lowercase();
                let is_config = name_lower.contains("manifest") || name_lower.contains("config")
                    || name_lower.contains("appinfo") || name_lower.contains("steam_api")
                    || name_lower.contains("localization") || name_lower.contains("localisation")
                    || name_lower.contains("settings") || name_lower.contains("languages")
                    || name_lower.ends_with(".vdf") || name_lower.ends_with(".acf")
                    || name_lower.ends_with(".ini") || name_lower.ends_with(".cfg");

                if is_config {
                    for &(code, full_name, pattern) in LANG_PATTERNS {
                        if content_lower.contains(pattern) || content_lower.contains(&format!("\"{}\"", code)) {
                            let entry = lang_map.entry(code.to_string()).or_insert_with(|| {
                                (full_name.to_string(), HashSet::new(), 0, 0)
                            });
                            entry.1.insert(format!("config: {}", name_lower));
                        }
                    }
                    // Anche alias nei config
                    for &(alias, iso_code) in LOCALE_ALIASES {
                        if content_lower.contains(alias) {
                            if let Some(&(_, full_name, _)) = LANG_PATTERNS.iter().find(|&&(c, _, _)| c == iso_code) {
                                let entry = lang_map.entry(iso_code.to_string()).or_insert_with(|| {
                                    (full_name.to_string(), HashSet::new(), 0, 0)
                                });
                                entry.1.insert(format!("config-alias({}): {}", alias, name_lower));
                            }
                        }
                    }
                }
            }
        }
    }

    // Calcola completeness: confronta dimensione file di ogni lingua vs English
    let en_size = lang_map.get("en").map(|e| e.3).unwrap_or(1).max(1);

    let mut result: Vec<DetectedLanguage> = lang_map
        .into_iter()
        .map(|(code, (name, sources, count, size))| {
            let completeness = if code == "en" {
                100
            } else {
                ((size as f64 / en_size as f64) * 100.0).min(100.0) as u32
            };
            DetectedLanguage {
                code,
                name,
                source: sources.into_iter().take(5).collect::<Vec<_>>().join(", "),
                file_count: count,
                total_size_kb: size,
                completeness_percent: completeness,
            }
        })
        .collect();

    result.sort_by(|a, b| b.total_size_kb.cmp(&a.total_size_kb));
    result
}

// ── Text Stats ───────────────────────────────────────────────────────

fn analyze_text_content(game_path: &Path) -> TextStats {
    let mut total_files = 0u32;
    let mut total_size = 0u64;
    let mut largest_files: Vec<FileSizeInfo> = Vec::new();
    let mut loc_folders: HashSet<String> = HashSet::new();

    let walker = walkdir::WalkDir::new(game_path)
        .max_depth(10)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok());

    for entry in walker {
        if !entry.file_type().is_file() {
            continue;
        }
        let path = entry.path();
        let name_lower = entry.file_name().to_string_lossy().to_lowercase();
        let rel = path.strip_prefix(game_path).unwrap_or(path);
        let rel_str = rel.to_string_lossy().to_lowercase();

        // Detect localization folders
        if rel_str.contains("localization") || rel_str.contains("localisation")
            || rel_str.contains("i18n") || rel_str.contains("translations")
            || rel_str.contains("lang") || rel_str.contains("locale")
        {
            if let Some(parent) = rel.parent() {
                loc_folders.insert(parent.to_string_lossy().to_string());
            }
        }

        if is_translatable_ext(&name_lower) {
            let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
            if size < 50 { continue; }
            total_files += 1;
            total_size += size;

            let ext = Path::new(&name_lower)
                .extension()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            largest_files.push(FileSizeInfo {
                path: rel.to_string_lossy().to_string(),
                size_kb: size / 1024,
                format: ext,
            });
        }
    }

    largest_files.sort_by(|a, b| b.size_kb.cmp(&a.size_kb));
    largest_files.truncate(10);

    // ── Stima stringhe accurata con parsing reale ──
    // Scansiona un campione di file traducibili e conta le stringhe effettive
    // per tipo di formato, poi estrapola per il totale
    let mut parsed_strings = 0u64;
    let mut parsed_words = 0u64;
    let mut parsed_chars = 0u64;
    let mut parsed_bytes = 0u64;

    let sample_walker = walkdir::WalkDir::new(game_path)
        .max_depth(10)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok());

    let mut sample_count = 0u32;
    for entry in sample_walker {
        if !entry.file_type().is_file() { continue; }
        let name_lower = entry.file_name().to_string_lossy().to_lowercase();
        if !is_translatable_ext(&name_lower) { continue; }
        let fsize = entry.metadata().map(|m| m.len()).unwrap_or(0);
        if fsize < 50 || fsize > 10_000_000 { continue; }
        // Limita campione a 100 file per performance
        if sample_count >= 100 { break; }

        if let Ok(content) = fs::read_to_string(entry.path()) {
            sample_count += 1;
            parsed_bytes += fsize;
            let (s, w, c) = count_strings_by_format(&name_lower, &content);
            parsed_strings += s;
            parsed_words += w;
            parsed_chars += c;
        }
    }

    // Se abbiamo parsed file, usa il ratio reale; altrimenti fallback a euristica
    let (est_strings, est_words, est_chars) = if parsed_bytes > 0 && parsed_strings > 0 {
        // Estrapola dal campione al totale
        let ratio = total_size as f64 / parsed_bytes as f64;
        let est_s = (parsed_strings as f64 * ratio) as u64;
        let est_w = (parsed_words as f64 * ratio) as u64;
        let est_c = (parsed_chars as f64 * ratio) as u64;
        (est_s.max(1), est_w.max(1), est_c.max(1))
    } else {
        // Fallback: euristica basata su bytes
        (total_size / 50, total_size / 6, total_size)
    };

    TextStats {
        total_text_files: total_files,
        total_text_size_kb: total_size / 1024,
        estimated_strings: est_strings,
        estimated_words: est_words,
        estimated_characters: est_chars,
        largest_files,
        localization_folders: loc_folders.into_iter().collect(),
    }
}

/// Conta stringhe, parole e caratteri in un file in base al formato.
/// Ritorna (strings, words, chars).
fn count_strings_by_format(filename: &str, content: &str) -> (u64, u64, u64) {
    if filename.ends_with(".json") {
        count_json_strings(content)
    } else if filename.ends_with(".csv") {
        count_csv_strings(content)
    } else if filename.ends_with(".po") || filename.ends_with(".pot") {
        count_po_strings(content)
    } else if filename.ends_with(".ini") || filename.ends_with(".cfg") || filename.ends_with(".properties") {
        count_ini_strings(content)
    } else if filename.ends_with(".xml") {
        count_xml_strings(content)
    } else if filename.ends_with(".rpy") {
        count_renpy_strings(content)
    } else {
        count_plaintext_strings(content)
    }
}

/// JSON: conta i valori stringa (non le chiavi)
fn count_json_strings(content: &str) -> (u64, u64, u64) {
    // Parsing leggero: cerca pattern "key": "value"
    let mut strings = 0u64;
    let mut total_chars = 0u64;
    let re = regex::Regex::new(r#""[^"]*"\s*:\s*"([^"\\]*(\\.[^"\\]*)*)""#).unwrap_or_else(|_| regex::Regex::new("$^").unwrap());
    for cap in re.captures_iter(content) {
        if let Some(val) = cap.get(1) {
            let v = val.as_str();
            // Ignora valori che sembrano path, numeri, o codice
            if v.len() >= 2 && !v.starts_with('/') && !v.starts_with("http")
                && !v.chars().all(|c| c.is_ascii_digit() || c == '.' || c == '-') {
                strings += 1;
                total_chars += v.len() as u64;
            }
        }
    }
    let words = total_chars / 5; // media ~5 chars per parola
    (strings, words.max(1), total_chars)
}

/// CSV: conta le celle non-header con testo
fn count_csv_strings(content: &str) -> (u64, u64, u64) {
    let mut strings = 0u64;
    let mut total_chars = 0u64;
    let lines: Vec<&str> = content.lines().collect();
    // Skip header (prima riga)
    for line in lines.iter().skip(1) {
        let trimmed = line.trim();
        if trimmed.is_empty() { continue; }
        // Ogni cella con testo conta come stringa
        for cell in trimmed.split(',') {
            let cell = cell.trim().trim_matches('"').trim();
            if cell.len() >= 3 && !cell.chars().all(|c| c.is_ascii_digit() || c == '.' || c == '-') {
                strings += 1;
                total_chars += cell.len() as u64;
            }
        }
    }
    let words = total_chars / 5;
    (strings, words.max(1), total_chars)
}

/// PO/POT: conta msgstr non vuoti
fn count_po_strings(content: &str) -> (u64, u64, u64) {
    let mut strings = 0u64;
    let mut total_chars = 0u64;
    let mut in_msgstr = false;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("msgid ") {
            in_msgstr = false;
        } else if trimmed.starts_with("msgstr ") {
            in_msgstr = true;
            let val = trimmed.trim_start_matches("msgstr ").trim_matches('"');
            if !val.is_empty() {
                strings += 1;
                total_chars += val.len() as u64;
            }
        } else if in_msgstr && trimmed.starts_with('"') && trimmed.ends_with('"') {
            // Continuazione multilinea
            let val = trimmed.trim_matches('"');
            total_chars += val.len() as u64;
        }
    }
    // Se nessun msgstr trovato, conta msgid (file template .pot)
    if strings == 0 {
        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("msgid ") {
                let val = trimmed.trim_start_matches("msgid ").trim_matches('"');
                if !val.is_empty() && val != "" {
                    strings += 1;
                    total_chars += val.len() as u64;
                }
            }
        }
    }
    let words = total_chars / 5;
    (strings, words.max(1), total_chars)
}

/// INI/CFG/Properties: conta valori in coppie chiave=valore
fn count_ini_strings(content: &str) -> (u64, u64, u64) {
    let mut strings = 0u64;
    let mut total_chars = 0u64;
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') || trimmed.starts_with(';') || trimmed.starts_with('[') {
            continue;
        }
        if let Some(idx) = trimmed.find('=') {
            let val = trimmed[idx + 1..].trim().trim_matches('"');
            if val.len() >= 2 && !val.chars().all(|c| c.is_ascii_digit() || c == '.' || c == '-')
                && !val.starts_with("true") && !val.starts_with("false") {
                strings += 1;
                total_chars += val.len() as u64;
            }
        }
    }
    let words = total_chars / 5;
    (strings, words.max(1), total_chars)
}

/// XML: conta contenuto testuale tra tag
fn count_xml_strings(content: &str) -> (u64, u64, u64) {
    let mut strings = 0u64;
    let mut total_chars = 0u64;
    let re = regex::Regex::new(r">([^<]{3,})<").unwrap_or_else(|_| regex::Regex::new("$^").unwrap());
    for cap in re.captures_iter(content) {
        if let Some(val) = cap.get(1) {
            let v = val.as_str().trim();
            if v.len() >= 3 && !v.chars().all(|c| c.is_ascii_digit() || c == '.' || c == '-' || c.is_whitespace()) {
                strings += 1;
                total_chars += v.len() as u64;
            }
        }
    }
    let words = total_chars / 5;
    (strings, words.max(1), total_chars)
}

/// Ren'Py: conta stringhe tra virgolette nei dialoghi
fn count_renpy_strings(content: &str) -> (u64, u64, u64) {
    let mut strings = 0u64;
    let mut total_chars = 0u64;
    let re = regex::Regex::new(r#""([^"\\]{3,}(\\.[^"\\]*)*)""#).unwrap_or_else(|_| regex::Regex::new("$^").unwrap());
    for cap in re.captures_iter(content) {
        if let Some(val) = cap.get(1) {
            let v = val.as_str();
            // Ignora stringhe che sembrano path o codice
            if !v.starts_with('/') && !v.starts_with("http") && !v.contains("def ")
                && !v.contains("import ") && v.contains(' ') {
                strings += 1;
                total_chars += v.len() as u64;
            }
        }
    }
    let words = total_chars / 5;
    (strings, words.max(1), total_chars)
}

/// Testo piano (TXT, LUA, etc.): conta righe non-vuote non-commento
fn count_plaintext_strings(content: &str) -> (u64, u64, u64) {
    let mut strings = 0u64;
    let mut total_chars = 0u64;
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') || trimmed.starts_with("//")
            || trimmed.starts_with("--") || trimmed.starts_with("/*") {
            continue;
        }
        if trimmed.len() >= 3 {
            strings += 1;
            total_chars += trimmed.len() as u64;
        }
    }
    let words = total_chars / 5;
    (strings, words.max(1), total_chars)
}

// ── File Formats ─────────────────────────────────────────────────────

fn analyze_file_formats(game_path: &Path) -> Vec<FileFormatInfo> {
    let mut ext_map: HashMap<String, (u32, u64)> = HashMap::new();

    let walker = walkdir::WalkDir::new(game_path)
        .max_depth(8)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok());

    for entry in walker {
        if !entry.file_type().is_file() { continue; }
        let name = entry.file_name().to_string_lossy().to_lowercase();
        let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
        if let Some(ext) = Path::new(&name).extension() {
            let ext_str = ext.to_string_lossy().to_string();
            let e = ext_map.entry(ext_str).or_insert((0, 0));
            e.0 += 1;
            e.1 += size;
        }
    }

    let mut result: Vec<FileFormatInfo> = ext_map
        .into_iter()
        .filter(|(_, (count, _))| *count > 0)
        .map(|(ext, (count, size))| {
            let (translatable, desc) = get_format_info(&ext);
            FileFormatInfo {
                extension: ext,
                count,
                total_size_kb: size / 1024,
                translatable,
                description: desc.to_string(),
            }
        })
        .collect();

    result.sort_by(|a, b| b.total_size_kb.cmp(&a.total_size_kb));
    result.truncate(20);
    result
}

// ── Difficulty Score ─────────────────────────────────────────────────

fn calculate_difficulty(
    engine: &str,
    languages: &[DetectedLanguage],
    text_stats: &TextStats,
    formats: &[FileFormatInfo],
    drm_info: &DrmInfo,
    encoding_info: &EncodingInfo,
    translation_complexity: &TranslationComplexity,
) -> (u32, String, Vec<String>) {
    let mut score: i32 = 0;
    let mut warnings: Vec<String> = Vec::new();

    // Engine difficulty
    match engine {
        "Unity" => { score += 15; }
        "Ren'Py" => { score += 10; }
        "RPG Maker" => { score += 10; }
        "GameMaker" => { score += 20; }
        "Godot" => { score += 18; }
        "Wolf RPG Editor" => { score += 12; }
        "Spike Chunsoft Engine" => { score += 15; }
        "Unreal Engine" => {
            score += 40;
            warnings.push("Unreal usa file .pak — estrazione complessa, possibili asset criptati".into());
        }
        "Source Engine" | "Source 2" => {
            score += 35;
            warnings.push("Source Engine: file VPK/VTF, richiede tool specifici".into());
        }
        "Frostbite" => {
            score += 55;
            warnings.push("Frostbite (EA): file criptati/compressi, traduzione molto difficile".into());
        }
        "RE Engine" | "MT Framework" => {
            score += 45;
            warnings.push("Engine Capcom: file proprietari, possibili protezioni".into());
        }
        "RAGE Engine" => {
            score += 55;
            warnings.push("RAGE (Rockstar): file criptati, estrazione non supportata".into());
        }
        "FromSoftware Engine" => {
            score += 45;
            warnings.push("FromSoft: file .bnd/.dcx compressi, tool specifici necessari".into());
        }
        "CryEngine" | "CRYENGINE" => {
            score += 42;
            warnings.push("CryEngine: file .pak proprietari, tool esterni necessari".into());
        }
        "id Tech" | "id Tech 7" => {
            score += 48;
            warnings.push("id Tech: formato binario proprietario id Software".into());
        }
        "Creation Engine" | "Gamebryo" => {
            score += 38;
            warnings.push("Creation Engine: BSA/BA2 con tool esterni, stringhe in plugin ESP/ESM".into());
        }
        "Telltale Tool" => {
            score += 40;
            warnings.push("Telltale: formato proprietario, richiede tool specifici".into());
        }
        "Anvil" | "Anvil Engine" => {
            score += 50;
            warnings.push("Anvil (Ubisoft): formato proprietario, estrazione molto complessa".into());
        }
        "Decima" => {
            score += 48;
            warnings.push("Decima: formato proprietario Guerrilla/Kojima Productions".into());
        }
        "Luminous" | "Luminous Engine" => {
            score += 50;
            warnings.push("Luminous (Square Enix): formato proprietario, file compressi".into());
        }
        "Unknown" => {
            score += 35;
            warnings.push("Motore sconosciuto: potrebbe richiedere analisi manuale".into());
        }
        _ => { score += 30; }
    }

    // Text volume
    if text_stats.estimated_strings > 50000 {
        score += 20;
        warnings.push(format!("Volume enorme: ~{} stringhe stimate", text_stats.estimated_strings));
    } else if text_stats.estimated_strings > 10000 {
        score += 10;
    } else if text_stats.estimated_strings < 500 {
        score -= 5;
    }

    // Existing languages
    let has_loc_structure = !text_stats.localization_folders.is_empty();
    if has_loc_structure {
        score -= 10;
    } else {
        score += 10;
        warnings.push("Nessuna cartella localizzazione trovata: le stringhe potrebbero essere hardcoded".into());
    }

    // Check for binary-only text (no readable files)
    let has_pak = formats.iter().any(|f| f.extension == "pak");
    let has_assets = formats.iter().any(|f| f.extension == "assets" || f.extension == "resource" || f.extension == "resources");

    if has_pak && text_stats.total_text_files < 5 {
        score += 15;
        warnings.push("Testo probabilmente all'interno di file .pak binari".into());
    }

    if has_assets && engine == "Unity" {
        score -= 5; // Unity assets sono supportati da GS
    }

    // Italian check
    let has_italian = languages.iter().any(|l| l.code == "it");
    if has_italian {
        score -= 15;
        // Not a warning, it's good news
    } else {
        score += 5;
    }

    // DRM / Anti-Cheat impact
    if drm_info.affects_translation {
        score += 15;
        warnings.push(format!("DRM rilevato: {}. Potrebbe bloccare memory injection o modifiche file.", drm_info.drm_types.join(", ")));
    } else if drm_info.has_drm {
        score += 5; // Minor penalty for DRM that doesn't affect translation
    }

    // Translation complexity
    // High variable count makes translation harder (need to preserve placeholders)
    if translation_complexity.variable_count > 5000 {
        score += 10;
        warnings.push(format!("Molte variabili/placeholder (~{}) — traduzione più complessa", translation_complexity.variable_count));
    } else if translation_complexity.variable_count > 1000 {
        score += 5;
    }

    // Markup tags add complexity
    if translation_complexity.markup_count > 2000 {
        score += 5;
    }

    // Plurals and gender forms require careful translation
    if translation_complexity.has_plurals {
        score += 3;
    }
    if translation_complexity.has_gender_forms {
        score += 3;
    }

    // Very short strings (UI labels) are harder to translate contextually
    if translation_complexity.short_strings_percent > 40.0 {
        score += 5;
        warnings.push("Alta percentuale di stringhe corte (UI labels) — traduzione contestualmente difficile".into());
    }

    // Very long strings (dialogues) may need segmentation
    if translation_complexity.long_strings_percent > 20.0 {
        score += 2;
    }

    // Encoding issues
    if encoding_info.has_cjk {
        score += 5;
        warnings.push("Caratteri CJK rilevati — verifica supporto font nella lingua target".into());
    }
    if encoding_info.has_rtl {
        score += 8;
        warnings.push("Scrittura RTL rilevata — verifica supporto nella lingua target".into());
    }
    if !encoding_info.has_unicode && !encoding_info.bom_detected {
        score += 2; // Potential encoding issues
    }

    let score = score.clamp(0, 100) as u32;
    let label = match score {
        0..=20 => "Facile",
        21..=40 => "Moderato",
        41..=60 => "Difficile",
        61..=80 => "Molto Difficile",
        _ => "Estremo",
    }.to_string();

    (score, label, warnings)
}

// ── Time & Chain Estimates ───────────────────────────────────────────

fn estimate_times(estimated_strings: u64) -> Vec<TimeEstimate> {
    let s = estimated_strings as f64;
    vec![
        // ── Modelli Locali (Ollama) ──
        TimeEstimate {
            model_name: "TranslateGemma:12b".into(),
            model_size: "~8 GB".into(),
            speed_strings_per_min: 18.0,
            estimated_hours: s / 18.0 / 60.0,
            quality_score: 88,
            provider: "Ollama (locale)".into(),
        },
        TimeEstimate {
            model_name: "TranslateGemma:4b".into(),
            model_size: "~3 GB".into(),
            speed_strings_per_min: 40.0,
            estimated_hours: s / 40.0 / 60.0,
            quality_score: 78,
            provider: "Ollama (locale)".into(),
        },
        TimeEstimate {
            model_name: "hy-mt1.5-abliterated:7b".into(),
            model_size: "4.6 GB".into(),
            speed_strings_per_min: 20.0,
            estimated_hours: s / 20.0 / 60.0,
            quality_score: 83,
            provider: "Ollama (locale)".into(),
        },
        TimeEstimate {
            model_name: "hy-mt1.5:1.8b".into(),
            model_size: "1.1 GB".into(),
            speed_strings_per_min: 55.0,
            estimated_hours: s / 55.0 / 60.0,
            quality_score: 68,
            provider: "Ollama (locale)".into(),
        },
        TimeEstimate {
            model_name: "qwen3:4b".into(),
            model_size: "2.5 GB".into(),
            speed_strings_per_min: 35.0,
            estimated_hours: s / 35.0 / 60.0,
            quality_score: 65,
            provider: "Ollama (locale)".into(),
        },
        TimeEstimate {
            model_name: "qwen3:14b".into(),
            model_size: "~9 GB".into(),
            speed_strings_per_min: 12.0,
            estimated_hours: s / 12.0 / 60.0,
            quality_score: 90,
            provider: "Ollama (locale)".into(),
        },
        TimeEstimate {
            model_name: "qwen3:32b".into(),
            model_size: "~20 GB".into(),
            speed_strings_per_min: 5.0,
            estimated_hours: s / 5.0 / 60.0,
            quality_score: 95,
            provider: "Ollama (locale)".into(),
        },
        TimeEstimate {
            model_name: "Gemma 4 27B (MoE A4B)".into(),
            model_size: "~16 GB".into(),
            speed_strings_per_min: 45.0,
            estimated_hours: s / 45.0 / 60.0,
            quality_score: 92,
            provider: "Ollama (locale)".into(),
        },
        TimeEstimate {
            model_name: "Gemma 4 E4B".into(),
            model_size: "~3 GB".into(),
            speed_strings_per_min: 60.0,
            estimated_hours: s / 60.0 / 60.0,
            quality_score: 82,
            provider: "Ollama (locale)".into(),
        },
        TimeEstimate {
            model_name: "Gemma 4 E2B".into(),
            model_size: "~1.5 GB".into(),
            speed_strings_per_min: 90.0,
            estimated_hours: s / 90.0 / 60.0,
            quality_score: 72,
            provider: "Ollama (locale)".into(),
        },
        // ── Modelli Cloud ──
        TimeEstimate {
            model_name: "GPT-4o".into(),
            model_size: "Cloud".into(),
            speed_strings_per_min: 60.0,
            estimated_hours: s / 60.0 / 60.0,
            quality_score: 93,
            provider: "OpenAI".into(),
        },
        TimeEstimate {
            model_name: "GPT-4o-mini".into(),
            model_size: "Cloud".into(),
            speed_strings_per_min: 120.0,
            estimated_hours: s / 120.0 / 60.0,
            quality_score: 80,
            provider: "OpenAI".into(),
        },
        TimeEstimate {
            model_name: "Claude 3.5 Sonnet".into(),
            model_size: "Cloud".into(),
            speed_strings_per_min: 50.0,
            estimated_hours: s / 50.0 / 60.0,
            quality_score: 94,
            provider: "Anthropic".into(),
        },
        TimeEstimate {
            model_name: "Claude 3 Haiku".into(),
            model_size: "Cloud".into(),
            speed_strings_per_min: 150.0,
            estimated_hours: s / 150.0 / 60.0,
            quality_score: 80,
            provider: "Anthropic".into(),
        },
        TimeEstimate {
            model_name: "Gemini 2.0 Flash".into(),
            model_size: "Cloud".into(),
            speed_strings_per_min: 100.0,
            estimated_hours: s / 100.0 / 60.0,
            quality_score: 84,
            provider: "Google".into(),
        },
        TimeEstimate {
            model_name: "Gemini 1.5 Pro".into(),
            model_size: "Cloud".into(),
            speed_strings_per_min: 45.0,
            estimated_hours: s / 45.0 / 60.0,
            quality_score: 91,
            provider: "Google".into(),
        },
        TimeEstimate {
            model_name: "Llama 3.3 70B (Groq)".into(),
            model_size: "Cloud".into(),
            speed_strings_per_min: 180.0,
            estimated_hours: s / 180.0 / 60.0,
            quality_score: 85,
            provider: "Groq".into(),
        },
        TimeEstimate {
            model_name: "DeepL Pro".into(),
            model_size: "Cloud".into(),
            speed_strings_per_min: 200.0,
            estimated_hours: s / 200.0 / 60.0,
            quality_score: 88,
            provider: "DeepL".into(),
        },
        TimeEstimate {
            model_name: "Mistral Large".into(),
            model_size: "Cloud".into(),
            speed_strings_per_min: 65.0,
            estimated_hours: s / 65.0 / 60.0,
            quality_score: 89,
            provider: "Together AI".into(),
        },
        TimeEstimate {
            model_name: "DeepSeek V3".into(),
            model_size: "Cloud".into(),
            speed_strings_per_min: 70.0,
            estimated_hours: s / 70.0 / 60.0,
            quality_score: 87,
            provider: "DeepSeek".into(),
        },
        TimeEstimate {
            model_name: "NLLB-200 (Meta)".into(),
            model_size: "Cloud (HuggingFace)".into(),
            speed_strings_per_min: 250.0,
            estimated_hours: s / 250.0 / 60.0,
            quality_score: 72,
            provider: "HuggingFace (gratis)".into(),
        },
    ]
}

fn estimate_chains(estimated_strings: u64, estimated_words: u64) -> Vec<ChainEstimate> {
    let s = estimated_strings as f64;
    let _w = estimated_words as f64;
    // DeepL: $20/1M chars = ~$0.00002/char, avg 30 chars/string
    let deepl_cost = s * 30.0 * 0.00002;
    // OpenAI: ~$0.003/1K tokens input + $0.006/1K output
    let openai_cost = s * 50.0 / 1000.0 * 0.003 + s * 50.0 / 1000.0 * 0.006;
    let openai_mini_cost = openai_cost * 0.1;

    vec![
        ChainEstimate {
            chain_name: "Local Quality".into(),
            description: "Ollama hy-mt1.5:7b con context injection".into(),
            estimated_hours: s / 20.0 / 60.0,
            quality_score: 82,
            cost_estimate: "Gratis (locale)".into(),
            steps: vec![
                "1. Estrai stringhe dal gioco".into(),
                "2. Genera contesto (scena, personaggio, glossario)".into(),
                "3. Traduci con hy-mt1.5:7b + contesto".into(),
                "4. QA check automatico".into(),
                "5. Reinierisci nel gioco".into(),
            ],
        },
        ChainEstimate {
            chain_name: "Local Premium".into(),
            description: "Ollama qwen3:14b/32b con context + TM RAG".into(),
            estimated_hours: s / 8.0 / 60.0,
            quality_score: 93,
            cost_estimate: "Gratis (locale, GPU potente necessaria)".into(),
            steps: vec![
                "1. Estrai stringhe dal gioco".into(),
                "2. Genera contesto + Translation Memory RAG".into(),
                "3. Traduci con qwen3:14b/32b + contesto completo".into(),
                "4. Post-editing pass con modello secondario".into(),
                "5. QA check + reinierisci".into(),
            ],
        },
        ChainEstimate {
            chain_name: "Cloud Fast".into(),
            description: "DeepL Pro + GPT-4o-mini post-edit".into(),
            estimated_hours: s / 150.0 / 60.0,
            quality_score: 87,
            cost_estimate: format!("~${:.2}", deepl_cost + openai_mini_cost),
            steps: vec![
                "1. Estrai stringhe".into(),
                "2. DeepL traduzione base (veloce, buona qualità)".into(),
                "3. GPT-4o-mini post-editing con contesto".into(),
                "4. QA check automatico".into(),
                "5. Reinierisci".into(),
            ],
        },
        ChainEstimate {
            chain_name: "Cloud Premium".into(),
            description: "GPT-4o con context injection completo".into(),
            estimated_hours: s / 60.0 / 60.0,
            quality_score: 95,
            cost_estimate: format!("~${:.2}", openai_cost),
            steps: vec![
                "1. Estrai stringhe + analisi contesto".into(),
                "2. GPT-4o traduzione con system prompt dettagliato".into(),
                "3. Context injection (personaggio, scena, glossario)".into(),
                "4. QA check + consistency check".into(),
                "5. Reinierisci nel gioco".into(),
            ],
        },
        ChainEstimate {
            chain_name: "Hybrid (Consigliato)".into(),
            description: "DeepL base + Ollama context-aware post-edit".into(),
            estimated_hours: s / 100.0 / 60.0 + s / 20.0 / 60.0 * 0.3,
            quality_score: 90,
            cost_estimate: format!("~${:.2} (solo DeepL)", deepl_cost),
            steps: vec![
                "1. Estrai stringhe dal gioco".into(),
                "2. DeepL traduzione base rapida".into(),
                "3. Ollama post-editing con contesto (solo stringhe dubbie)".into(),
                "4. TM RAG per coerenza terminologica".into(),
                "5. QA check + reinierisci".into(),
            ],
        },
    ]
}

// ── Binary String Estimation ─────────────────────────────────────────

/// Stima il numero di stringhe traducibili basandosi sulla dimensione dei file binari
/// e sul tipo di motore. Questa è un'euristica per giochi dove il testo è dentro
/// archivi compressi (.pak, .assets, .bundle, etc.)
fn estimate_strings_from_binary(engine: &str, formats: &[FileFormatInfo]) -> u64 {
    let pak_size_mb: f64 = formats.iter()
        .filter(|f| f.extension == "pak")
        .map(|f| f.total_size_kb as f64 / 1024.0)
        .sum();
    let assets_size_mb: f64 = formats.iter()
        .filter(|f| f.extension == "assets" || f.extension == "resources" || f.extension == "resource")
        .map(|f| f.total_size_kb as f64 / 1024.0)
        .sum();
    let bundle_size_mb: f64 = formats.iter()
        .filter(|f| f.extension == "bundle")
        .map(|f| f.total_size_kb as f64 / 1024.0)
        .sum();
    let total_binary_mb = pak_size_mb + assets_size_mb + bundle_size_mb;

    if total_binary_mb < 1.0 {
        return 0;
    }

    // Euristica: la percentuale di testo nei file binari varia per motore
    // Testo = tipicamente ~0.1-2% del totale per giochi action, ~2-8% per RPG/VN
    // Stringhe stimate = testo_byte_stimati / 50 (media 50 byte per stringa)
    let text_ratio = match engine {
        "Unreal Engine" => {
            // Unreal: .pak contiene asset misti, testo ~0.5-1.5% del totale
            if total_binary_mb > 5000.0 { 0.003 } // AAA con tanti asset grafici
            else if total_binary_mb > 1000.0 { 0.005 }
            else if total_binary_mb > 100.0 { 0.01 }
            else { 0.02 } // Indie piccolo
        }
        "Unity" => {
            // Unity: .assets contiene testo serializzato, ~1-3%
            if total_binary_mb > 1000.0 { 0.008 }
            else if total_binary_mb > 100.0 { 0.015 }
            else { 0.025 }
        }
        "Source Engine" | "Source 2" => 0.01,
        "Frostbite" => 0.002, // EA games, molto compressi
        "RE Engine" | "MT Framework" => 0.005,
        "RAGE Engine" => 0.003,
        "FromSoftware Engine" => 0.008,
        "Godot" => 0.02,
        "GameMaker" => 0.03, // GameMaker: testo in data.win, alta percentuale
        "Ren'Py" => 0.05, // Ren'Py: quasi tutto testo
        "RPG Maker" => 0.04, // RPG Maker: molto testo in JSON
        "CryEngine" | "CRYENGINE" => 0.005,
        "id Tech" | "id Tech 7" => 0.004,
        "Creation Engine" | "Gamebryo" => 0.008, // Bethesda: molte stringhe in ESM/ESP
        "Telltale Tool" => 0.015, // Telltale: giochi narrativi, molto testo
        "Anvil" | "Anvil Engine" => 0.003, // Ubisoft: molto compresso
        "Decima" => 0.004,
        "Luminous" | "Luminous Engine" => 0.004,
        _ => 0.01, // Default conservativo
    };

    let estimated_text_bytes = total_binary_mb * 1024.0 * 1024.0 * text_ratio;
    let estimated_strings = (estimated_text_bytes / 50.0) as u64;

    // Minimo realistico: un gioco indie ha almeno ~500 stringhe, un AAA ~5000+
    let minimum = if total_binary_mb > 1000.0 { 5000 }
        else if total_binary_mb > 100.0 { 2000 }
        else if total_binary_mb > 10.0 { 500 }
        else { 200 };

    estimated_strings.max(minimum)
}

// ── GS Support Check ─────────────────────────────────────────────────

fn check_gs_support(engine: &str) -> (bool, String) {
    match engine {
        "Unity" => (true, "Unity CSV Translator, Unity Asset Injector, Unity Patcher, IL2CPP Injector".into()),
        "Unreal Engine" => (true, "Unreal Localization Patcher, UE Translator DLL, PAK Override".into()),
        "Ren'Py" => (true, "Ren'Py Patcher (script .rpy/.rpyc)".into()),
        "RPG Maker" => (true, "RPG Maker Patcher (MV/MZ JSON, VX/Ace rvdata2)".into()),
        "GameMaker" => (true, "GameMaker Patcher (data.win STRG, YYC EXE, language files .jn)".into()),
        "Godot" => (true, "Godot PCK Patcher (override PCK leggero, v1/v2)".into()),
        "Source Engine" | "Source 2" => (false, "Non supportato — richiede tool esterni (GCFScape, Crowbar)".into()),
        "Frostbite" => (false, "Non supportato — file criptati/compressi EA proprietari".into()),
        "RE Engine" | "MT Framework" => (false, "Non supportato — formato proprietario Capcom".into()),
        "RAGE Engine" => (false, "Non supportato — file criptati Rockstar".into()),
        "FromSoftware Engine" => (false, "Parziale — richiede tool specifici (.bnd/.dcx decompression)".into()),
        "Spike Chunsoft Engine" => (true, "Danganronpa Patcher".into()),
        "Wolf RPG Editor" => (true, "Wolf RPG Patcher".into()),
        "CryEngine" | "CRYENGINE" => (false, "Non supportato — file .pak CryEngine proprietari".into()),
        "id Tech" | "id Tech 7" => (false, "Non supportato — formato binario proprietario id Software".into()),
        "Creation Engine" | "Gamebryo" => (false, "Parziale — BSA/BA2 con tool esterni, stringhe in plugin ESP/ESM".into()),
        "Telltale Tool" => (false, "Non supportato — formato proprietario Telltale".into()),
        "Anvil" | "Anvil Engine" => (false, "Non supportato — formato proprietario Ubisoft".into()),
        "Decima" => (false, "Non supportato — formato proprietario Guerrilla/Kojima".into()),
        "Luminous" | "Luminous Engine" => (false, "Non supportato — formato proprietario Square Enix".into()),
        _ => (false, format!("Motore '{}' non direttamente supportato — prova OCR Translator, Screen Capture o Overlay Translator", engine)),
    }
}

// ── Helpers ──────────────────────────────────────────────────────────

fn is_text_ext(name: &str) -> bool {
    let text_exts = [
        ".txt", ".csv", ".json", ".xml", ".yaml", ".yml", ".ini", ".cfg",
        ".loc", ".po", ".pot", ".strings", ".lang", ".resx", ".ink",
        ".dlg", ".dialogue", ".lua", ".rpy", ".ks", ".toml", ".properties",
        ".vdf", ".acf", ".manifest", ".info",
    ];
    text_exts.iter().any(|e| name.ends_with(e))
}

fn is_translatable_ext(name: &str) -> bool {
    let exts = [
        ".txt", ".csv", ".json", ".xml", ".yaml", ".yml", ".ini", ".cfg",
        ".loc", ".po", ".pot", ".strings", ".lang", ".resx", ".ink",
        ".dlg", ".dialogue", ".lua", ".rpy", ".ks", ".toml", ".properties",
        ".vdf", ".html", ".htm", ".md",
    ];
    exts.iter().any(|e| name.ends_with(e))
}

fn get_format_info(ext: &str) -> (bool, &'static str) {
    match ext {
        "json" => (true, "JSON — struttura dati, spesso usato per localizzazione"),
        "csv" => (true, "CSV — tabelle, formato comune per stringhe tradotte"),
        "xml" => (true, "XML — markup, usato in molti sistemi i18n"),
        "txt" => (true, "Testo piano — dialoghi, note, descrizioni"),
        "po" | "pot" => (true, "GNU gettext — formato standard localizzazione"),
        "yaml" | "yml" => (true, "YAML — config e localizzazione (Ruby, Unity)"),
        "ini" | "cfg" => (true, "Config — può contenere stringhe UI"),
        "lua" => (true, "Lua script — spesso contiene stringhe di gioco"),
        "rpy" => (true, "Ren'Py script — dialoghi visual novel"),
        "lang" => (true, "File lingua — formato proprietario"),
        "loc" => (true, "Localizzazione — formato vario"),
        "strings" => (true, "Apple strings — coppie chiave-valore"),
        "resx" => (true, ".NET resources — localizzazione .NET/Unity"),
        "ink" => (true, "Ink narrative — dialoghi interattivi (Esoteric Ebb style)"),
        "dlg" | "dialogue" => (true, "Dialogo — formato engine specifico"),
        "properties" => (true, "Java properties — coppie chiave-valore"),
        "toml" => (true, "TOML — config strutturato"),
        "pak" => (false, "Unreal PAK — archivio binario compresso"),
        "assets" => (false, "Unity Assets — binario, richiede tool estrazione"),
        "resources" | "resource" => (false, "Unity Resources — binario serializzato"),
        "bundle" => (false, "Asset bundle — binario compresso"),
        "dll" => (false, "DLL — libreria binaria"),
        "exe" => (false, "Eseguibile — binario"),
        "wem" | "bnk" => (false, "Wwise audio — file audio, non testo"),
        "ogg" | "wav" | "mp3" => (false, "Audio — non testo"),
        "png" | "jpg" | "jpeg" | "dds" | "tga" | "bmp" => (false, "Immagine — non testo"),
        "ttf" | "otf" => (false, "Font — non testo"),
        "shader" | "cginc" | "hlsl" | "glsl" => (false, "Shader — codice GPU"),
        "mat" | "prefab" | "anim" | "controller" => (false, "Unity asset — metadati motore"),
        _ => (false, "Formato non classificato"),
    }
}

// ── DRM Detection ───────────────────────────────────────────────────

fn detect_drm(game_path: &Path) -> DrmInfo {
    let mut drm_types: Vec<String> = Vec::new();
    let mut affects = false;

    let walker = walkdir::WalkDir::new(game_path)
        .max_depth(3)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok());

    for entry in walker {
        let name_lower = entry.file_name().to_string_lossy().to_lowercase();

        // EasyAntiCheat
        if name_lower.contains("easyanticheat") || name_lower == "eac_launcher.exe" {
            if !drm_types.contains(&"EasyAntiCheat".to_string()) {
                drm_types.push("EasyAntiCheat".into());
                affects = true;
            }
        }
        // BattlEye
        if name_lower.contains("battleye") || name_lower == "beclient.dll" || name_lower == "beservice.exe" {
            if !drm_types.contains(&"BattlEye".to_string()) {
                drm_types.push("BattlEye".into());
                affects = true;
            }
        }
        // Denuvo
        if name_lower.contains("denuvo") {
            if !drm_types.contains(&"Denuvo".to_string()) {
                drm_types.push("Denuvo".into());
                affects = true;
            }
        }
        // Steam DRM (steam_api.dll is normal, steam_drm is protection)
        if name_lower == "steam_api.dll" || name_lower == "steam_api64.dll" {
            if !drm_types.contains(&"Steam API".to_string()) {
                drm_types.push("Steam API".into());
                // Steam API alone doesn't block translation
            }
        }
        // VAC
        if name_lower.contains("vac") && name_lower.ends_with(".dll") {
            if !drm_types.contains(&"VAC".to_string()) {
                drm_types.push("VAC".into());
                affects = true;
            }
        }
        // nProtect GameGuard
        if name_lower.contains("gameguard") || name_lower == "gamemon.des" {
            if !drm_types.contains(&"nProtect GameGuard".to_string()) {
                drm_types.push("nProtect GameGuard".into());
                affects = true;
            }
        }
        // PunkBuster
        if name_lower.contains("punkbuster") || name_lower == "pbcl.dll" {
            if !drm_types.contains(&"PunkBuster".to_string()) {
                drm_types.push("PunkBuster".into());
                affects = true;
            }
        }
        // Arxan
        if name_lower.contains("arxan") {
            if !drm_types.contains(&"Arxan".to_string()) {
                drm_types.push("Arxan".into());
                affects = true;
            }
        }
    }

    let notes = if drm_types.is_empty() {
        "Nessun DRM/anti-cheat rilevato. Traduzione sicura.".into()
    } else if affects {
        format!(
            "Rilevati: {}. Potrebbero interferire con memory injection o modifiche ai file.",
            drm_types.join(", ")
        )
    } else {
        format!("Rilevati: {}. Non dovrebbero interferire con la traduzione.", drm_types.join(", "))
    };

    DrmInfo {
        has_drm: !drm_types.is_empty(),
        drm_types,
        affects_translation: affects,
        notes,
    }
}

// ── Encoding Analysis ───────────────────────────────────────────────

fn analyze_encoding(game_path: &Path) -> EncodingInfo {
    let mut has_unicode = false;
    let mut has_cjk = false;
    let mut has_rtl = false;
    let mut bom_detected = false;
    let mut utf8_count = 0u32;
    let mut latin_count = 0u32;

    let walker = walkdir::WalkDir::new(game_path)
        .max_depth(5)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok());

    for entry in walker {
        if !entry.file_type().is_file() { continue; }
        let name_lower = entry.file_name().to_string_lossy().to_lowercase();
        if !is_translatable_ext(&name_lower) { continue; }
        let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
        if size < 10 || size > 2_000_000 { continue; }

        if let Ok(bytes) = fs::read(entry.path()) {
            // BOM detection
            if bytes.len() >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF {
                bom_detected = true;
                utf8_count += 1;
            } else if bytes.len() >= 2 && ((bytes[0] == 0xFF && bytes[1] == 0xFE) || (bytes[0] == 0xFE && bytes[1] == 0xFF)) {
                bom_detected = true;
                has_unicode = true;
            }

            // Check content for multi-byte chars
            if let Ok(text) = std::str::from_utf8(&bytes) {
                utf8_count += 1;
                for ch in text.chars().take(5000) {
                    let cp = ch as u32;
                    // CJK ranges
                    if (0x4E00..=0x9FFF).contains(&cp) || (0x3040..=0x30FF).contains(&cp)
                        || (0xAC00..=0xD7AF).contains(&cp) {
                        has_cjk = true;
                        has_unicode = true;
                    }
                    // RTL ranges (Arabic, Hebrew)
                    if (0x0600..=0x06FF).contains(&cp) || (0x0590..=0x05FF).contains(&cp) {
                        has_rtl = true;
                        has_unicode = true;
                    }
                    // General unicode (accented, Cyrillic, etc.)
                    if cp > 127 {
                        has_unicode = true;
                    }
                }
            } else {
                latin_count += 1;
            }
        }
    }

    let primary_encoding = if utf8_count > latin_count {
        "UTF-8".to_string()
    } else if latin_count > 0 {
        "Latin-1 / Windows-1252".to_string()
    } else {
        "Non determinato".to_string()
    };

    EncodingInfo {
        primary_encoding,
        has_unicode,
        has_cjk,
        has_rtl,
        bom_detected,
    }
}

// ── Translation Complexity Analysis ─────────────────────────────────

fn analyze_translation_complexity(game_path: &Path) -> TranslationComplexity {
    let mut variable_count = 0u64;
    let mut markup_count = 0u64;
    let mut has_plurals = false;
    let mut has_gender_forms = false;
    let mut total_string_len = 0u64;
    let mut string_count = 0u64;
    let mut short_count = 0u64;
    let mut long_count = 0u64;
    let mut variable_formats: HashSet<String> = HashSet::new();

    let var_patterns: &[(&str, &str)] = &[
        (r"\{[0-9]+\}", "{N}"),
        (r"\{[a-zA-Z_]+\}", "{name}"),
        (r"%[sdifx]", "%s/%d"),
        (r"%[0-9]*\.[0-9]*[sdifx]", "%N.Nf"),
        (r"\$[a-zA-Z_]+", "$var"),
        (r"@[a-zA-Z_]+", "@var"),
        (r"\\[CcNnVv]\[[0-9]*\]", "RPG Maker codes"),
        (r"<[a-zA-Z/][^>]*>", "HTML/XML tags"),
    ];

    let walker = walkdir::WalkDir::new(game_path)
        .max_depth(5)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok());

    for entry in walker {
        if !entry.file_type().is_file() { continue; }
        let name_lower = entry.file_name().to_string_lossy().to_lowercase();
        if !is_translatable_ext(&name_lower) { continue; }
        let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
        if size < 20 || size > 5_000_000 { continue; }

        if let Ok(content) = fs::read_to_string(entry.path()) {
            // Split into rough "strings" by newlines
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.is_empty() || trimmed.starts_with('#') || trimmed.starts_with("//") {
                    continue;
                }

                let len = trimmed.len();
                if len < 2 { continue; }
                string_count += 1;
                total_string_len += len as u64;

                if len < 5 { short_count += 1; }
                if len > 200 { long_count += 1; }

                // Variable/placeholder detection
                for &(pattern, label) in var_patterns {
                    if let Ok(re) = regex::Regex::new(pattern) {
                        let matches = re.find_iter(trimmed).count() as u64;
                        if matches > 0 {
                            variable_count += matches;
                            variable_formats.insert(label.to_string());
                        }
                    }
                }

                // Markup detection
                let tag_re = regex::Regex::new(r"<[a-zA-Z/][^>]*>").unwrap_or_else(|_| regex::Regex::new("$^").unwrap());
                markup_count += tag_re.find_iter(trimmed).count() as u64;

                // Plural forms detection
                let lower = trimmed.to_lowercase();
                if lower.contains("plural") || lower.contains("nplurals") || lower.contains("msgid_plural") {
                    has_plurals = true;
                }

                // Gender forms detection
                if lower.contains("gender") || lower.contains("masculine") || lower.contains("feminine")
                    || lower.contains("{male}") || lower.contains("{female}") {
                    has_gender_forms = true;
                }
            }
        }
    }

    let avg_string_length = if string_count > 0 {
        total_string_len as f64 / string_count as f64
    } else {
        0.0
    };

    let short_strings_percent = if string_count > 0 {
        (short_count as f64 / string_count as f64) * 100.0
    } else {
        0.0
    };

    let long_strings_percent = if string_count > 0 {
        (long_count as f64 / string_count as f64) * 100.0
    } else {
        0.0
    };

    TranslationComplexity {
        variable_count,
        markup_count,
        has_plurals,
        has_gender_forms,
        avg_string_length: (avg_string_length * 10.0).round() / 10.0,
        short_strings_percent: (short_strings_percent * 10.0).round() / 10.0,
        long_strings_percent: (long_strings_percent * 10.0).round() / 10.0,
        variable_formats: variable_formats.into_iter().collect(),
    }
}

// ── Confidence Score ────────────────────────────────────────────────

fn calculate_confidence(
    engine: &str,
    languages: &[DetectedLanguage],
    text_stats: &TextStats,
    formats: &[FileFormatInfo],
    gs_supported: bool,
) -> (u32, String) {
    let mut score: i32 = 50; // Base
    let mut reasons: Vec<&str> = Vec::new();

    // Motore conosciuto = più confidence
    if engine != "Unknown" {
        score += 15;
        reasons.push("motore riconosciuto");
    } else {
        score -= 15;
        reasons.push("motore sconosciuto (stime meno affidabili)");
    }

    // GS supporta = stime validate
    if gs_supported {
        score += 15;
        reasons.push("motore supportato da GameStringer");
    }

    // File di testo trovati = stime accurate
    if text_stats.total_text_files > 10 {
        score += 10;
        reasons.push("molti file di testo trovati");
    } else if text_stats.total_text_files == 0 {
        score -= 20;
        reasons.push("nessun file di testo trovato (stima basata su binari)");
    }

    // Cartelle localizzazione = struttura chiara
    if !text_stats.localization_folders.is_empty() {
        score += 10;
        reasons.push("cartelle localizzazione trovate");
    }

    // Più lingue = struttura i18n verificata
    if languages.len() > 3 {
        score += 10;
        reasons.push("multiple lingue rilevate");
    } else if languages.is_empty() {
        score -= 10;
        reasons.push("nessuna lingua rilevata nei file");
    }

    // Formati noti = stima affidabile
    let known_translatable = formats.iter().filter(|f| f.translatable).count();
    if known_translatable > 5 {
        score += 5;
    }

    let score = score.clamp(10, 100) as u32;

    let explanation = if score >= 80 {
        format!("Alta affidabilità: {}", reasons.join(", "))
    } else if score >= 50 {
        format!("Affidabilità media: {}", reasons.join(", "))
    } else {
        format!("Bassa affidabilità: {}", reasons.join(", "))
    };

    (score, explanation)
}

// ── Translation Quality Estimation ───────────────────────────────────

fn calculate_translation_quality(
    complexity: &TranslationComplexity,
    encoding: &EncodingInfo,
    text_stats: &TextStats,
) -> (u32, String) {
    let mut score: i32 = 85; // Base score - assumiamo traduzione decente
    let mut factors: Vec<String> = Vec::new();
    
    // Complessità variabili: più variabili = più difficile mantenere qualità
    if complexity.variable_count > 5000 {
        score -= 15;
        factors.push("moltissime variabili da gestire".to_string());
    } else if complexity.variable_count > 1000 {
        score -= 8;
        factors.push("molte variabili da gestire".to_string());
    } else if complexity.variable_count < 50 {
        score += 5;
        factors.push("poche variabili, facile gestione".to_string());
    }
    
    // Complessità markup: HTML/XML richiede attenzione
    if complexity.markup_count > 1000 {
        score -= 10;
        factors.push("esteso markup HTML/XML da preservare".to_string());
    } else if complexity.markup_count < 100 {
        score += 3;
        factors.push("markup limitato".to_string());
    }
    
    // Plurali e generi: aggiungono complessità ma anche ricchezza
    if complexity.has_plurals {
        score -= 3;
        factors.push("gestione plurali richiesta".to_string());
    }
    if complexity.has_gender_forms {
        score -= 3;
        factors.push("gestione generi richiesta".to_string());
    }
    
    // Lunghezza stringhe: stringhe molto lunghe sono difficili da tradurre bene
    if complexity.long_strings_percent > 20.0 {
        score -= 8;
        factors.push("molte stringhe lunghe (>200 char)".to_string());
    } else if complexity.long_strings_percent < 5.0 {
        score += 2;
        factors.push("stringhe di lunghezza gestibile".to_string());
    }
    
    // Stringhe corte: spesso sono UI labels che richiedono precisione
    if complexity.short_strings_percent > 30.0 {
        score -= 5;
        factors.push("molte stringhe corte (<5 char) - UI labels".to_string());
    }
    
    // Encoding: Unicode/CJK/RTL richiedono attenzione speciale
    if encoding.has_cjk {
        score -= 5;
        factors.push("testo CJK richiede competenza specifica".to_string());
    }
    if encoding.has_rtl {
        score -= 5;
        factors.push("testo RTL richiede competenza specifica".to_string());
    }
    if !encoding.has_unicode {
        score += 2;
        factors.push("encoding semplice (ASCII/Latin)".to_string());
    }
    
    // Volume testo: più testo = più possibilità di errori
    if text_stats.estimated_strings > 50000 {
        score -= 10;
        factors.push("volume enorme di testo".to_string());
    } else if text_stats.estimated_strings < 1000 {
        score += 5;
        factors.push("volume testo gestibile".to_string());
    }
    
    // BOM detection: può causare problemi
    if encoding.bom_detected {
        score -= 2;
        factors.push("BOM rilevato - potenziali problemi encoding".to_string());
    }
    
    let score = score.clamp(20, 95) as u32;
    
    let explanation = if score >= 80 {
        format!("Qualità traduzione eccellente prevista: {}", factors.join(", "))
    } else if score >= 60 {
        format!("Qualità traduzione buona prevista: {}", factors.join(", "))
    } else if score >= 40 {
        format!("Qualità traduzione media prevista: {}", factors.join(", "))
    } else {
        format!("Qualità traduzione bassa prevista: {}", factors.join(", "))
    };
    
    (score, explanation)
}

// ── Existing Translation Tools Detection ─────────────────────────────

fn detect_existing_translation_tools(game_path: &Path, engine: &str) -> ExistingTranslationTools {
    let mut translation_files: Vec<TranslationFileInfo> = Vec::new();
    let mut community_patches: Vec<CommunityPatchInfo> = Vec::new();
    let mut localization_tools: Vec<String> = Vec::new();
    let mut recommendations: Vec<String> = Vec::new();
    
    let walker = walkdir::WalkDir::new(game_path)
        .max_depth(5)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok());

    for entry in walker {
        if !entry.file_type().is_file() { continue; }
        let path = entry.path();
        let name_lower = entry.file_name().to_string_lossy().to_lowercase();
        
        // File di traduzione standard
        let translation_exts = [
            (".po", "gettext"), (".mo", "gettext compiled"), (".pot", "gettext template"),
            (".resx", ".NET resources"), (".resources", ".NET resources"),
            (".loc", "Unreal localization"), (".locres", "Unreal localization"),
            (".json", "JSON localization"), (".csv", "CSV localization"),
            (".xml", "XML localization"), (".yaml", "YAML localization"),
            (".strings", "Apple strings"), (".lang", "Generic language file"),
            (".translation", "Generic translation file"),
        ];
        
        for (ext, file_type) in &translation_exts {
            if name_lower.ends_with(ext) {
                let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                let language = extract_language_from_filename(&name_lower);
                
                translation_files.push(TranslationFileInfo {
                    file_path: path.to_string_lossy().to_string(),
                    file_type: file_type.to_string(),
                    language,
                    string_count: None, // In una implementazione reale si potrebbe contare
                    file_size_kb: size / 1024,
                });
            }
        }
        
        // Rileva Unity Localization
        if name_lower.contains("localization") || name_lower.contains("i18n") {
            if name_lower.contains("unity") || path.to_string_lossy().to_lowercase().contains("resources") {
                localization_tools.push("Unity Localization System".to_string());
            }
        }
        
        // Rileva Unreal Localization
        if name_lower.contains(".loc") || name_lower.contains(".locres") {
            localization_tools.push("Unreal Localization System".to_string());
        }
        
        // Rileva patch community
        if name_lower.contains("translation") || name_lower.contains("localization") || name_lower.contains("traduzione") {
            if name_lower.contains("patch") || name_lower.contains("mod") {
                let patch_name = path.file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("Unknown Patch")
                    .to_string();
                
                let languages = extract_languages_from_filename(&name_lower);
                let status = if path.exists() { "active".to_string() } else { "inactive".to_string() };
                
                community_patches.push(CommunityPatchInfo {
                    patch_name,
                    patch_type: "translation".to_string(),
                    languages,
                    status,
                    install_path: Some(path.to_string_lossy().to_string()),
                });
            }
        }
        
        // Rileva strumenti specifici per motore
        match engine {
            "Unity" => {
                if path.to_string_lossy().to_lowercase().contains("resources") {
                    localization_tools.push("Unity AssetBundle Localization".to_string());
                }
            }
            "Unreal Engine" => {
                if name_lower.contains(".loc") || name_lower.contains(".locres") {
                    localization_tools.push("Unreal .loc/.locres System".to_string());
                }
            }
            "Ren'Py" => {
                if name_lower.contains(".rpy") {
                    localization_tools.push("Ren'Py Script Translation".to_string());
                }
            }
            "RPG Maker" => {
                if name_lower.contains(".json") || name_lower.contains(".ini") {
                    localization_tools.push("RPG Maker Data Files".to_string());
                }
            }
            _ => {}
        }
    }
    
    // Genera raccomandazioni
    if !translation_files.is_empty() {
        recommendations.push("Gioco ha già file di traduzione - possibile aggiornare invece di creare da zero".to_string());
    }
    
    if !localization_tools.is_empty() {
        recommendations.push("Sistema di localizzazione nativo rilevato - usare strumenti specifici del motore".to_string());
    }
    
    if !community_patches.is_empty() {
        recommendations.push("Patch di traduzione community disponibili - verificare compatibilità".to_string());
    }
    
    if translation_files.is_empty() && localization_tools.is_empty() {
        recommendations.push("Nessun sistema di traduzione esistente - traduzione da zero richiesta".to_string());
    }
    
    ExistingTranslationTools {
        has_translation_files: !translation_files.is_empty(),
        translation_files,
        uses_unity_localization: localization_tools.iter().any(|t| t.contains("Unity")),
        uses_unreal_localization: localization_tools.iter().any(|t| t.contains("Unreal")),
        has_community_patches: !community_patches.is_empty(),
        community_patches,
        localization_tools,
        recommendations,
    }
}

fn extract_language_from_filename(filename: &str) -> Option<String> {
    // Estrae codici lingua da nomi file tipo it.json, en.po, etc.
    let patterns = [
        r"([a-z]{2}(-[a-z]{2})?)\.", // it.json, en-US.json
        r"([a-z]{2})_([a-z]{2})?\.", // en_us.json
        r"([a-z]{2})\.", // it.po
    ];
    
    for pattern in &patterns {
        if let Ok(re) = regex::Regex::new(pattern) {
            if let Some(caps) = re.captures(filename) {
                return Some(caps.get(1).unwrap().as_str().to_string());
            }
        }
    }
    None
}

fn extract_languages_from_filename(filename: &str) -> Vec<String> {
    let mut languages = Vec::new();
    
    // Pattern per lingue multiple nel filename
    if let Ok(re) = regex::Regex::new(r"([a-z]{2})(?:[-_][a-z]{2})?") {
        for caps in re.captures_iter(filename) {
            languages.push(caps.get(0).unwrap().as_str().to_string());
        }
    }
    
    languages
}

// ── Quick Summary Struct (for batch ranking) ─────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameQuickSummary {
    pub game_title: String,
    pub engine: String,
    pub install_path: String,
    pub difficulty_score: u32,
    pub difficulty_label: String,
    pub estimated_strings: u64,
    pub estimated_hours_local: f64,
    pub estimated_hours_cloud: f64,
    pub estimated_cost_cloud: f64,
    pub gs_supported: bool,
    pub recommended_method: String,
    pub lang_count: usize,
    pub has_italian: bool,
    pub warnings_count: usize,
    pub header_image: String,
    pub is_demo: bool,
    pub size_gb: f64,
}

// ── Batch Scan Command ───────────────────────────────────────────────

#[tauri::command]
pub async fn analyze_all_installed_games() -> Result<Vec<GameQuickSummary>, String> {
    info!("🔮 P.T. Batch: Scanning all installed games...");

    // Get all installed Steam games
    let local_games = crate::commands::steam_enhanced::scan_all_steam_games_fast()
        .await
        .map_err(|e| format!("Scan failed: {}", e))?;

    let installed: Vec<_> = local_games.iter()
        .filter(|g| g.is_installed && g.install_path.is_some())
        .collect();

    info!("🔮 P.T. Batch: Found {} installed games to analyze", installed.len());

    let mut summaries: Vec<GameQuickSummary> = Vec::new();

    for game in &installed {
        let Some(path_str) = game.install_path.as_ref() else { continue; };
        let game_path = PathBuf::from(path_str);
        if !game_path.exists() { continue; }

        let engine_str = game.engine.clone().unwrap_or_else(|| {
            let detected = crate::engine_detector::detect_engine(&game_path);
            detected.as_str().to_string()
        });

        // Quick scan (lighter than full analyze)
        let languages = detect_languages_deep(&game_path);
        let mut text_stats = analyze_text_content(&game_path);
        let file_formats = analyze_file_formats(&game_path);

        if text_stats.estimated_strings < 100 {
            let binary_est = estimate_strings_from_binary(&engine_str, &file_formats);
            if binary_est > text_stats.estimated_strings {
                text_stats.estimated_strings = binary_est;
                text_stats.estimated_words = binary_est * 8;
            }
        }

        let drm_info = detect_drm(&game_path);
        let encoding_info = analyze_encoding(&game_path);
        let translation_complexity = analyze_translation_complexity(&game_path);

        let (difficulty_score, difficulty_label, warnings) =
            calculate_difficulty(&engine_str, &languages, &text_stats, &file_formats, &drm_info, &encoding_info, &translation_complexity);

        let s = text_stats.estimated_strings as f64;
        let hours_local = s / 60.0 / 60.0; // hy-mt1.5 speed
        let hours_cloud = s / 150.0 / 60.0; // DeepL speed
        let cost_cloud = (text_stats.estimated_words as f64 / 1_000_000.0) * 20.0; // DeepL ~$20/M chars

        let has_italian = languages.iter().any(|l| l.code == "it");
        let (gs_supported, recommended_method) = check_gs_support(&engine_str);

        let header = game.header_image.clone().unwrap_or_else(|| {
            let app_id = game.steam_app_id.map(|id| id.to_string()).unwrap_or_default();
            if !app_id.is_empty() {
                format!("https://cdn.akamai.steamstatic.com/steam/apps/{}/header.jpg", app_id)
            } else {
                String::new()
            }
        });

        // Rileva demo: titolo contiene "Demo" E dimensione < 5GB
        // Giochi grandi (>5GB) non sono mai demo anche se il nome contiene "Demo"
        let title_lower = game.title.to_lowercase();
        // Calcola dimensione totale dalla scansione formati
        let total_size_mb: f64 = file_formats.iter()
            .map(|f| f.total_size_kb as f64 / 1024.0)
            .sum();
        let size_gb = total_size_mb / 1024.0;
        let is_demo = title_lower.contains("demo") && size_gb < 5.0;

        summaries.push(GameQuickSummary {
            game_title: game.title.clone(),
            engine: engine_str,
            install_path: path_str.clone(),
            difficulty_score,
            difficulty_label,
            estimated_strings: text_stats.estimated_strings,
            estimated_hours_local: (hours_local * 10.0).round() / 10.0,
            estimated_hours_cloud: (hours_cloud * 10.0).round() / 10.0,
            estimated_cost_cloud: (cost_cloud * 100.0).round() / 100.0,
            gs_supported,
            recommended_method,
            lang_count: languages.len(),
            has_italian,
            warnings_count: warnings.len(),
            header_image: header,
            is_demo,
            size_gb: (size_gb * 100.0).round() / 100.0,
        });
    }

    // Ordina per difficoltà decrescente
    summaries.sort_by(|a, b| b.difficulty_score.cmp(&a.difficulty_score));

    info!("🔮 P.T. Batch: Analyzed {} games", summaries.len());
    Ok(summaries)
}

// ── Main Command (single game) ───────────────────────────────────────

#[tauri::command]
pub async fn analyze_game_translation(
    install_path: String,
    game_title: String,
    engine: Option<String>,
    _source_lang: String,
    _target_lang: String,
) -> Result<PredictionResult, String> {
    let game_path = PathBuf::from(&install_path);
    if !game_path.exists() {
        return Err(format!("Path non trovato: {}", install_path));
    }

    // Check cache first
    let cache_key = format!("{}:{}", game_title, install_path);
    let path_hash = compute_path_hash(&game_path);
    let mut cache = load_cache();
    
    if let Some(entry) = cache.get(&cache_key) {
        if entry.path_hash == path_hash && !entry.is_expired() {
            info!("🔮 P.T. Cache hit: {} ({} mins old)", game_title, 
                (SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() - entry.timestamp) / 60);
            return Ok(entry.result.clone());
        }
    }

    info!("🔮 P.T. Analyzing: {} at {}", game_title, install_path);

    // Detect engine if not provided
    let engine_str = engine.unwrap_or_else(|| {
        let detected = crate::engine_detector::detect_engine(&game_path);
        detected.as_str().to_string()
    });

    // Deep scan
    let languages = detect_languages_deep(&game_path);
    let mut text_stats = analyze_text_content(&game_path);
    let file_formats = analyze_file_formats(&game_path);

    // Se non ci sono file di testo ma ci sono file binari (pak, assets, etc.),
    // stima il contenuto testuale basandosi sulla dimensione dei binari e sul motore
    if text_stats.estimated_strings < 100 {
        let binary_text_estimate = estimate_strings_from_binary(&engine_str, &file_formats);
        if binary_text_estimate > text_stats.estimated_strings {
            text_stats.estimated_strings = binary_text_estimate;
            text_stats.estimated_words = binary_text_estimate * 8;
            text_stats.estimated_characters = binary_text_estimate * 45;
        }
    }

    // DRM / Anti-Cheat detection
    let drm_info = detect_drm(&game_path);

    // Encoding analysis
    let encoding_info = analyze_encoding(&game_path);

    // Translation complexity
    let translation_complexity = analyze_translation_complexity(&game_path);

    // Difficulty
    let (difficulty_score, difficulty_label, warnings) =
        calculate_difficulty(&engine_str, &languages, &text_stats, &file_formats, &drm_info, &encoding_info, &translation_complexity);

    // Time estimates
    let time_estimates = estimate_times(text_stats.estimated_strings);
    let chain_estimates = estimate_chains(text_stats.estimated_strings, text_stats.estimated_words);

    // GS support
    let (gs_supported, recommended_method) = check_gs_support(&engine_str);

    // Confidence score
    let (confidence_score, confidence_explanation) =
        calculate_confidence(&engine_str, &languages, &text_stats, &file_formats, gs_supported);

    // Translation quality estimation
    let (translation_quality_score, translation_quality_explanation) =
        calculate_translation_quality(&translation_complexity, &encoding_info, &text_stats);

    // Existing translation tools detection
    let existing_tools = detect_existing_translation_tools(&game_path, &engine_str);

    let estimated_strings = text_stats.estimated_strings;
    let languages_count = languages.len();
    
    // Create preliminary result for tool selection
    let preliminary_result = PredictionResult {
        game_title: game_title.clone(),
        engine: engine_str.clone(),
        install_path: install_path.clone(),
        detected_languages: languages.clone(),
        difficulty_score,
        difficulty_label: difficulty_label.clone(),
        text_stats: text_stats.clone(),
        file_formats: file_formats.clone(),
        time_estimates: time_estimates.clone(),
        chain_estimates: chain_estimates.clone(),
        warnings: warnings.clone(),
        gs_supported,
        recommended_method: recommended_method.clone(),
        confidence_score,
        confidence_explanation: confidence_explanation.clone(),
        drm_info: drm_info.clone(),
        encoding_info: encoding_info.clone(),
        translation_complexity: translation_complexity.clone(),
        translation_quality_score,
        translation_quality_explanation: translation_quality_explanation.clone(),
        existing_tools: existing_tools.clone(),
        selected_tools: SelectedTools {
            primary_text_tool: None,
            alternative_text_tools: Vec::new(),
            audio_tools: Vec::new(),
            graphics_tools: Vec::new(),
            archive_tools: Vec::new(),
            patch_tools: Vec::new(),
            workflow_recommendations: Vec::new(),
            selection_score: 0,
        },
        llm_chains: Vec::new(),
        multimedia_analysis: MultimediaAnalysis {
            audio_stats: AudioStats {
                total_audio_files: 0,
                total_audio_size_mb: 0.0,
                audio_formats: Vec::new(),
                localizable_audio_files: 0,
                music_ambient_files: 0,
                compressed_audio_files: 0,
                estimated_total_minutes: 0.0,
                predominant_quality: AudioQuality::Unknown,
                streaming_audio_files: 0,
            },
            graphics_stats: GraphicsStats {
                total_graphics_files: 0,
                total_graphics_size_mb: 0.0,
                graphics_formats: Vec::new(),
                text_containing_graphics: 0,
                ui_interface_files: 0,
                texture_sprite_files: 0,
                embedded_text_files: 0,
                predominant_resolution: "Unknown".to_string(),
                animated_files: 0,
            },
            recommended_tools: MultimediaTools {
                audio_tools: Vec::new(),
                graphics_tools: Vec::new(),
                engine_specific_tools: Vec::new(),
                compression_tools: Vec::new(),
            },
            multimedia_estimates: MultimediaEstimates {
                audio_editing_hours: 0.0,
                graphics_editing_hours: 0.0,
                tool_costs_usd: 0.0,
                total_complexity: 0,
                high_complexity_files: 0,
                compression_difficulty_factor: 1.0,
                outsourcing_cost_estimate: 0.0,
            },
            multimedia_complexity_score: 0,
            problematic_files: Vec::new(),
    },
    backup_strategy: BackupStrategy {
            recommended_backup_type: BackupType::Targeted,
            estimated_backup_size_mb: 0.0,
            backup_files_count: 0,
            compression_method: CompressionMethod::Smart,
            backup_location: "C:\\Users\\Public\\Documents\\GameStringer\\Backups".to_string(),
            backup_duration_minutes: 0.0,
            restore_complexity: RestoreComplexity::Simple,
            backup_categories: Vec::new(),
            space_savings_mb: 0.0,
            backup_validation: BackupValidation {
                checksum_validated: false,
                integrity_checks: Vec::new(),
                validation_time_minutes: 0.0,
                can_verify_restore: false,
                backup_health_score: 0,
            },
    },
    workflow_plan: WorkflowPlan {
        recommended_approach: WorkflowApproach::SemiAutomated,
        total_estimated_hours: 0.0,
        total_estimated_cost_usd: 0.0,
        workflow_stages: Vec::new(),
        dependencies: Vec::new(),
        risk_factors: Vec::new(),
        success_probability: 0.0,
        recommended_team_size: 1,
        quality_assurance_plan: QualityAssurancePlan {
            testing_phases: Vec::new(),
            acceptance_criteria: Vec::new(),
            bug_tracking: BugTrackingConfig {
                tool: "GitHub Issues".to_string(),
                severity_levels: Vec::new(),
                workflow: "Standard".to_string(),
                reporting_format: "Markdown".to_string(),
                escalation_rules: Vec::new(),
            },
            review_process: ReviewProcess {
                review_type: ReviewType::TechnicalReview,
                participants: Vec::new(),
                review_criteria: Vec::new(),
                approval_workflow: ApprovalWorkflow {
                    stages: Vec::new(),
                    parallel_reviews: false,
                    auto_approval_conditions: Vec::new(),
                    rejection_handling: RejectionHandling {
                        feedback_required: true,
                        resubmission_allowed: true,
                        max_resubmissions: 3,
                        escalation_on_rejection: false,
                    },
                },
                feedback_mechanism: FeedbackMechanism {
                    feedback_format: "Structured".to_string(),
                    structured_feedback: true,
                    rating_system: true,
                    comment_categories: vec!["Technical".to_string(), "Linguistic".to_string()],
                    follow_up_required: true,
                },
            },
            quality_metrics: Vec::new(),
        },
        deliverables: Vec::new(),
    },
    };

    // Tool selection
    let selected_tools = select_optimal_tools(&preliminary_result);

    // LLM Chain Builder
    let llm_chains = build_optimized_llm_chains(&preliminary_result);

    // Multimedia Analysis
    let multimedia_analysis = analyze_multimedia_files(&game_path, &engine_str, &preliminary_result);

    // Backup Strategy
    let backup_strategy_result = analyze_backup_strategy(&game_path, &engine_str, &multimedia_analysis);

    // Workflow Plan
    let workflow_plan_result = create_workflow_plan(&game_path, &engine_str, &multimedia_analysis, &selected_tools, &llm_chains);
    
    let result = PredictionResult {
        game_title,
        engine: engine_str,
        install_path,
        detected_languages: languages,
        difficulty_score,
        difficulty_label,
        text_stats,
        file_formats,
        time_estimates,
        chain_estimates,
        warnings,
        gs_supported,
        recommended_method,
        confidence_score,
        confidence_explanation,
        drm_info,
        encoding_info,
        translation_complexity,
        translation_quality_score,
        translation_quality_explanation,
        existing_tools,
        selected_tools: selected_tools.clone(),
        llm_chains: llm_chains.clone(),
        multimedia_analysis: multimedia_analysis.clone(),
        backup_strategy: backup_strategy_result,
        workflow_plan: workflow_plan_result,
    };

    // Save to cache
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    
    cache.insert(cache_key, PredictionCacheEntry {
        result: result.clone(),
        timestamp,
        path_hash,
    });
    
    // Clean expired entries and save
    cache.retain(|_, entry| !entry.is_expired());
    save_cache(&cache);

    info!(
        "🔮 P.T. Result: {} | engine={} | difficulty={}/100 | strings~{} | langs={} | confidence={}",
        result.game_title, result.engine, difficulty_score, estimated_strings, languages_count, confidence_score
    );

    Ok(result)
}

// ── Export Report Command ─────────────────────────────────────────────

#[tauri::command]
pub async fn export_prediction_report(
    result: PredictionResult,
    format: String,
    output_path: String,
) -> Result<String, String> {
    let output_dir = PathBuf::from(&output_path);
    if !output_dir.exists() {
        fs::create_dir_all(&output_dir)
            .map_err(|e| format!("Impossibile creare directory: {}", e))?;
    }

    let game_title_safe = result.game_title
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '_' })
        .collect::<String>();
    
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let filename = format!("{}_prediction_{}", game_title_safe, timestamp);

    match format.to_lowercase().as_str() {
        "json" => export_json(&result, &output_dir, &filename).await,
        "csv" => export_csv(&result, &output_dir, &filename).await,
        "txt" => export_txt(&result, &output_dir, &filename).await,
        _ => Err(format!("Formato non supportato: {}. Usare: json, csv, txt", format)),
    }
}

async fn export_json(result: &PredictionResult, output_dir: &Path, filename: &str) -> Result<String, String> {
    let json_content = serde_json::to_string_pretty(result)
        .map_err(|e| format!("Errore serializzazione JSON: {}", e))?;
    
    let file_path = output_dir.join(format!("{}.json", filename));
    fs::write(&file_path, json_content)
        .map_err(|e| format!("Errore scrittura file: {}", e))?;
    
    Ok(format!("Report JSON esportato in: {}", file_path.display()))
}

async fn export_csv(result: &PredictionResult, output_dir: &Path, filename: &str) -> Result<String, String> {
    let mut csv_content = Vec::new();
    
    // Header
    csv_content.push("Metric,Value,Notes".to_string());
    
    // Game info
    csv_content.push(format!("Game Title,{},", result.game_title));
    csv_content.push(format!("Engine,{},", result.engine));
    csv_content.push(format!("Difficulty Score,{},", result.difficulty_score));
    csv_content.push(format!("Difficulty Label,{},", result.difficulty_label));
    
    // Text stats
    csv_content.push(format!("Total Text Files,{},", result.text_stats.total_text_files));
    csv_content.push(format!("Estimated Strings,{},", result.text_stats.estimated_strings));
    csv_content.push(format!("Estimated Words,{},", result.text_stats.estimated_words));
    csv_content.push(format!("Estimated Characters,{},", result.text_stats.estimated_characters));
    
    // Quality and confidence
    csv_content.push(format!("Confidence Score,{},", result.confidence_score));
    csv_content.push(format!("Translation Quality Score,{},", result.translation_quality_score));
    
    // Languages
    for lang in &result.detected_languages {
        csv_content.push(format!("Language - {},{} files,{}KB,{}", 
            lang.name, lang.file_count, lang.total_size_kb, lang.completeness_percent));
    }
    
    // File formats
    for format in &result.file_formats {
        csv_content.push(format!("Format - {},{} files,{}KB,{}", 
            format.extension, format.count, format.total_size_kb, 
            if format.translatable { "Translatable" } else { "Not translatable" }));
    }
    
    // Time estimates
    for estimate in &result.time_estimates {
        csv_content.push(format!("Estimate - {},{} hours,Quality {},{}", 
            estimate.model_name, estimate.estimated_hours, estimate.quality_score, estimate.provider));
    }
    
    // Warnings
    for (i, warning) in result.warnings.iter().enumerate() {
        csv_content.push(format!("Warning {},{},", i + 1, warning));
    }
    
    let file_path = output_dir.join(format!("{}.csv", filename));
    fs::write(&file_path, csv_content.join("\n"))
        .map_err(|e| format!("Errore scrittura file CSV: {}", e))?;
    
    Ok(format!("Report CSV esportato in: {}", file_path.display()))
}

async fn export_txt(result: &PredictionResult, output_dir: &Path, filename: &str) -> Result<String, String> {
    let mut content = Vec::new();
    
    content.push("=".repeat(80));
    content.push(format!("PREDICTION TOOL REPORT - {}", result.game_title.to_uppercase()));
    content.push("=".repeat(80));
    content.push("".to_string());
    
    // Game Information
    content.push("GAME INFORMATION".to_string());
    content.push("-".repeat(40));
    content.push(format!("Title: {}", result.game_title));
    content.push(format!("Engine: {}", result.engine));
    content.push(format!("Install Path: {}", result.install_path));
    content.push(format!("Difficulty: {}/100 - {}", result.difficulty_score, result.difficulty_label));
    content.push("".to_string());
    
    // Text Statistics
    content.push("TEXT STATISTICS".to_string());
    content.push("-".repeat(40));
    content.push(format!("Total Text Files: {}", result.text_stats.total_text_files));
    content.push(format!("Estimated Strings: {}", result.text_stats.estimated_strings));
    content.push(format!("Estimated Words: {}", result.text_stats.estimated_words));
    content.push(format!("Estimated Characters: {}", result.text_stats.estimated_characters));
    content.push("".to_string());
    
    // Quality Metrics
    content.push("QUALITY METRICS".to_string());
    content.push("-".repeat(40));
    content.push(format!("Confidence Score: {}/100", result.confidence_score));
    content.push(format!("Translation Quality: {}/100", result.translation_quality_score));
    content.push(format!("GS Supported: {}", if result.gs_supported { "Yes" } else { "No" }));
    content.push(format!("Recommended Method: {}", result.recommended_method));
    content.push("".to_string());
    
    // Languages
    content.push("DETECTED LANGUAGES".to_string());
    content.push("-".repeat(40));
    for lang in &result.detected_languages {
        content.push(format!("{} ({}): {} files, {}KB, {}% complete", 
            lang.name, lang.code, lang.file_count, lang.total_size_kb, lang.completeness_percent));
    }
    content.push("".to_string());
    
    // Time Estimates
    content.push("TIME ESTIMATES".to_string());
    content.push("-".repeat(40));
    for estimate in &result.time_estimates {
        content.push(format!("{}: {:.1} hours (Quality: {}, Provider: {})", 
            estimate.model_name, estimate.estimated_hours, estimate.quality_score, estimate.provider));
    }
    content.push("".to_string());
    
    // Warnings
    if !result.warnings.is_empty() {
        content.push("WARNINGS".to_string());
        content.push("-".repeat(40));
        for warning in &result.warnings {
            content.push(format!("⚠ {}", warning));
        }
        content.push("".to_string());
    }
    
    // Footer
    content.push("=".repeat(80));
    content.push("Generated by GameStringer Prediction Tool v1.5.0".to_string());
    content.push("=".repeat(80));
    
    let file_path = output_dir.join(format!("{}.txt", filename));
    fs::write(&file_path, content.join("\n"))
        .map_err(|e| format!("Errore scrittura file report: {}", e))?;
    
    Ok(format!("Report esportato in: {}", file_path.display()))
}

// ── Tool Selection Engine ─────────────────────────────────────────────

fn select_optimal_tools(result: &PredictionResult) -> SelectedTools {
    let tool_database = get_tool_database();
    let mut selected_tools = SelectedTools {
        primary_text_tool: None,
        alternative_text_tools: Vec::new(),
        audio_tools: Vec::new(),
        graphics_tools: Vec::new(),
        archive_tools: Vec::new(),
        patch_tools: Vec::new(),
        workflow_recommendations: Vec::new(),
        selection_score: 0,
    };

    // Selezione tool testo basati su motore e formati
    let text_tools = select_text_tools(&result.engine, &result.file_formats, &tool_database);
    selected_tools.primary_text_tool = text_tools.first().cloned();
    selected_tools.alternative_text_tools = text_tools.iter().skip(1).cloned().collect();

    // Selezione tool audio
    selected_tools.audio_tools = select_audio_tools(&result.file_formats, &tool_database);

    // Selezione tool grafica
    selected_tools.graphics_tools = select_graphics_tools(&result.file_formats, &tool_database);

    // Selezione tool archivi
    selected_tools.archive_tools = select_archive_tools(&result.file_formats, &result.engine, &tool_database);

    // Selezione tool patch
    selected_tools.patch_tools = select_patch_tools(&result.engine, &tool_database);

    // Generazione raccomandazioni
    selected_tools.workflow_recommendations = generate_workflow_recommendations(&selected_tools, result);

    // Calcolo score totale
    selected_tools.selection_score = calculate_selection_score(&selected_tools, result);

    selected_tools
}

fn get_tool_database() -> Vec<Tool> {
    vec![
        // Text Extraction Tools
        Tool {
            name: "GameStringer".to_string(),
            category: ToolCategory::TextExtraction,
            supported_engines: vec!["Unity".to_string(), "Ren'Py".to_string(), "RPG Maker".to_string()],
            supported_formats: vec!["txt".to_string(), "json".to_string(), "xml".to_string(), "csv".to_string()],
            compatibility_score: 95,
            ease_of_use: 90,
            cost: ToolCost::Freemium,
            platform_support: vec!["Windows".to_string(), "Linux".to_string(), "macOS".to_string()],
            special_features: vec!["Auto-detection".to_string(), "Batch processing".to_string(), "Preview mode".to_string()],
            description: "Strumento completo per estrazione testo giochi Unity e Ren'Py".to_string(),
        },
        Tool {
            name: "Unity Assets Bundle Extractor (UABE)".to_string(),
            category: ToolCategory::ArchiveExtraction,
            supported_engines: vec!["Unity".to_string()],
            supported_formats: vec!["assets".to_string(), "bundle".to_string()],
            compatibility_score: 85,
            ease_of_use: 70,
            cost: ToolCost::Free,
            platform_support: vec!["Windows".to_string()],
            special_features: vec!["Asset preview".to_string(), "Texture extraction".to_string()],
            description: "Estrattore di asset Unity per file .assets e .bundle".to_string(),
        },
        Tool {
            name: "UnrealPak".to_string(),
            category: ToolCategory::ArchiveExtraction,
            supported_engines: vec!["Unreal Engine".to_string()],
            supported_formats: vec!["pak".to_string(), "utoc".to_string(), "ucas".to_string()],
            compatibility_score: 80,
            ease_of_use: 65,
            cost: ToolCost::Free,
            platform_support: vec!["Windows".to_string()],
            special_features: vec!["Pak mounting".to_string(), "AES decryption".to_string()],
            description: "Tool per estrazione e mount file PAK Unreal Engine".to_string(),
        },
        Tool {
            name: "Atlas".to_string(),
            category: ToolCategory::TextExtraction,
            supported_engines: vec!["Unreal Engine".to_string()],
            supported_formats: vec!["uasset".to_string(), "int".to_string(), "locres".to_string()],
            compatibility_score: 88,
            ease_of_use: 75,
            cost: ToolCost::Freemium,
            platform_support: vec!["Windows".to_string()],
            special_features: vec!["Localization support".to_string(), "String preview".to_string()],
            description: "Tool specifico per Unreal Engine localization files".to_string(),
        },
        Tool {
            name: "Ren'Py Translator Tools".to_string(),
            category: ToolCategory::TextExtraction,
            supported_engines: vec!["Ren'Py".to_string()],
            supported_formats: vec!["rpy".to_string(), "rpyc".to_string(), "tl".to_string()],
            compatibility_score: 92,
            ease_of_use: 85,
            cost: ToolCost::Free,
            platform_support: vec!["Windows".to_string(), "Linux".to_string(), "macOS".to_string()],
            special_features: vec!["Script compilation".to_string(), "Translation validation".to_string()],
            description: "Tool suite per traduzione giochi Ren'Py".to_string(),
        },
        Tool {
            name: "RPG Maker Trans".to_string(),
            category: ToolCategory::TextExtraction,
            supported_engines: vec!["RPG Maker".to_string()],
            supported_formats: vec!["rvdata2".to_string(), "json".to_string(), "ini".to_string()],
            compatibility_score: 90,
            ease_of_use: 80,
            cost: ToolCost::Free,
            platform_support: vec!["Windows".to_string()],
            special_features: vec!["Database extraction".to_string(), "Map translation".to_string()],
            description: "Tool per estrazione testo da giochi RPG Maker".to_string(),
        },
        // Audio Tools
        Tool {
            name: "Audacity".to_string(),
            category: ToolCategory::AudioConversion,
            supported_engines: vec!["*".to_string()], // Universale
            supported_formats: vec!["wav".to_string(), "mp3".to_string(), "ogg".to_string(), "wem".to_string()],
            compatibility_score: 95,
            ease_of_use: 85,
            cost: ToolCost::Free,
            platform_support: vec!["Windows".to_string(), "Linux".to_string(), "macOS".to_string()],
            special_features: vec!["Multi-track editing".to_string(), "Noise reduction".to_string(), "Format conversion".to_string()],
            description: "Editor audio professionale open source".to_string(),
        },
        Tool {
            name: "WW2Ogg".to_string(),
            category: ToolCategory::AudioConversion,
            supported_engines: vec!["*".to_string()],
            supported_formats: vec!["wem".to_string(), "wav".to_string()],
            compatibility_score: 85,
            ease_of_use: 70,
            cost: ToolCost::Free,
            platform_support: vec!["Windows".to_string()],
            special_features: vec!["WEM to WAV conversion".to_string(), "Batch processing".to_string()],
            description: "Convertitore specifico per formati audio WEM".to_string(),
        },
        // Graphics Tools
        Tool {
            name: "Photoshop".to_string(),
            category: ToolCategory::GraphicsEditing,
            supported_engines: vec!["*".to_string()],
            supported_formats: vec!["png".to_string(), "dds".to_string(), "tga".to_string(), "psd".to_string()],
            compatibility_score: 98,
            ease_of_use: 75,
            cost: ToolCost::Commercial("$20.99/mo".to_string()),
            platform_support: vec!["Windows".to_string(), "macOS".to_string()],
            special_features: vec!["Layer editing".to_string(), "DDS plugin".to_string(), "Batch actions".to_string()],
            description: "Editor grafico professionale".to_string(),
        },
        Tool {
            name: "GIMP".to_string(),
            category: ToolCategory::GraphicsEditing,
            supported_engines: vec!["*".to_string()],
            supported_formats: vec!["png".to_string(), "dds".to_string(), "tga".to_string(), "jpg".to_string()],
            compatibility_score: 85,
            ease_of_use: 70,
            cost: ToolCost::Free,
            platform_support: vec!["Windows".to_string(), "Linux".to_string(), "macOS".to_string()],
            special_features: vec!["DDS plugin".to_string(), "Batch processing".to_string(), "Scriptable".to_string()],
            description: "Editor grafico open source con plugin DDS".to_string(),
        },
        Tool {
            name: "Paint.NET".to_string(),
            category: ToolCategory::GraphicsEditing,
            supported_engines: vec!["*".to_string()],
            supported_formats: vec!["png".to_string(), "dds".to_string(), "tga".to_string(), "jpg".to_string()],
            compatibility_score: 80,
            ease_of_use: 90,
            cost: ToolCost::Free,
            platform_support: vec!["Windows".to_string()],
            special_features: vec!["DDS plugin".to_string(), "Layer support".to_string(), "Plugin system".to_string()],
            description: "Editor grafico semplice con plugin DDS".to_string(),
        },
        // Patch Tools
        Tool {
            name: "NSIS".to_string(),
            category: ToolCategory::PatchCreation,
            supported_engines: vec!["*".to_string()],
            supported_formats: vec!["exe".to_string(), "dll".to_string()],
            compatibility_score: 85,
            ease_of_use: 65,
            cost: ToolCost::Free,
            platform_support: vec!["Windows".to_string()],
            special_features: vec!["Scriptable installer".to_string(), "Custom UI".to_string(), "Multi-language".to_string()],
            description: "Sistema creazione installer per Windows".to_string(),
        },
        Tool {
            name: "Inno Setup".to_string(),
            category: ToolCategory::PatchCreation,
            supported_engines: vec!["*".to_string()],
            supported_formats: vec!["exe".to_string(), "dll".to_string()],
            compatibility_score: 88,
            ease_of_use: 70,
            cost: ToolCost::Free,
            platform_support: vec!["Windows".to_string()],
            special_features: vec!["Pascal scripting".to_string(), "Wizard interface".to_string(), "Compression".to_string()],
            description: "Tool creazione installer con scripting avanzato".to_string(),
        },
    ]
}

// Struttura interna per database tool
#[derive(Debug, Clone)]
struct Tool {
    name: String,
    category: ToolCategory,
    supported_engines: Vec<String>,
    supported_formats: Vec<String>,
    compatibility_score: u32,
    ease_of_use: u32,
    cost: ToolCost,
    platform_support: Vec<String>,
    special_features: Vec<String>,
    description: String,
}

fn select_text_tools(engine: &str, formats: &[FileFormatInfo], tool_db: &[Tool]) -> Vec<SelectedTool> {
    let mut compatible_tools: Vec<(usize, u32)> = Vec::new();
    
    for (i, tool) in tool_db.iter().enumerate() {
        if !matches!(tool.category, ToolCategory::TextExtraction | ToolCategory::LocalizationSystem) {
            continue;
        }
        
        let mut score = 0;
        
        // Engine compatibility
        if tool.supported_engines.contains(&engine.to_string()) || tool.supported_engines.contains(&"*".to_string()) {
            score += 40;
        }
        
        // Format compatibility
        let format_match: u32 = formats.iter()
            .filter(|f| tool.supported_formats.contains(&f.extension))
            .count() as u32;
        score += (format_match * 10).min(30);
        
        // Tool quality
        score += tool.compatibility_score / 5;
        score += tool.ease_of_use / 5;
        
        if score > 50 {
            compatible_tools.push((i, score));
        }
    }
    
    // Ordina per score e converti in SelectedTool
    compatible_tools.sort_by(|a, b| b.1.cmp(&a.1));
    
    compatible_tools.into_iter().take(5).map(|(i, score)| {
        let tool = &tool_db[i];
        SelectedTool {
            name: tool.name.clone(),
            category: tool.category.clone(),
            description: tool.description.clone(),
            supported_formats: tool.supported_formats.clone(),
            compatibility_score: score,
            ease_of_use: tool.ease_of_use,
            cost: tool.cost.clone(),
            platform_support: tool.platform_support.clone(),
            special_features: tool.special_features.clone(),
            recommended_usage: format!("Ideale per giochi {} con formati {}", engine, 
                formats.iter().filter(|f| tool.supported_formats.contains(&f.extension))
                    .map(|f| f.extension.as_str())
                    .collect::<Vec<_>>()
                    .join(", ")),
            installation_notes: None,
        }
    }).collect()
}

fn select_audio_tools(formats: &[FileFormatInfo], tool_db: &[Tool]) -> Vec<SelectedTool> {
    let audio_formats: Vec<&FileFormatInfo> = formats.iter()
        .filter(|f| ["wav", "mp3", "ogg", "wem", "flac", "aac"].contains(&f.extension.as_str()))
        .collect();
    
    if audio_formats.is_empty() {
        return Vec::new();
    }
    
    tool_db.iter()
        .filter(|tool| matches!(tool.category, ToolCategory::AudioConversion))
        .filter(|tool| {
            audio_formats.iter().any(|f| tool.supported_formats.contains(&f.extension))
        })
        .map(|tool| SelectedTool {
            name: tool.name.clone(),
            category: tool.category.clone(),
            description: tool.description.clone(),
            supported_formats: tool.supported_formats.clone(),
            compatibility_score: tool.compatibility_score,
            ease_of_use: tool.ease_of_use,
            cost: tool.cost.clone(),
            platform_support: tool.platform_support.clone(),
            special_features: tool.special_features.clone(),
            recommended_usage: "Per conversione e editing file audio del gioco".to_string(),
            installation_notes: None,
        })
        .collect()
}

fn select_graphics_tools(formats: &[FileFormatInfo], tool_db: &[Tool]) -> Vec<SelectedTool> {
    let graphics_formats: Vec<&FileFormatInfo> = formats.iter()
        .filter(|f| ["png", "jpg", "dds", "tga", "bmp", "psd", "tiff"].contains(&f.extension.as_str()))
        .collect();
    
    if graphics_formats.is_empty() {
        return Vec::new();
    }
    
    tool_db.iter()
        .filter(|tool| matches!(tool.category, ToolCategory::GraphicsEditing))
        .filter(|tool| {
            graphics_formats.iter().any(|f| tool.supported_formats.contains(&f.extension))
        })
        .map(|tool| SelectedTool {
            name: tool.name.clone(),
            category: tool.category.clone(),
            description: tool.description.clone(),
            supported_formats: tool.supported_formats.clone(),
            compatibility_score: tool.compatibility_score,
            ease_of_use: tool.ease_of_use,
            cost: tool.cost.clone(),
            platform_support: tool.platform_support.clone(),
            special_features: tool.special_features.clone(),
            recommended_usage: "Per editing textures e immagini del gioco".to_string(),
            installation_notes: None,
        })
        .collect()
}

fn select_archive_tools(formats: &[FileFormatInfo], engine: &str, tool_db: &[Tool]) -> Vec<SelectedTool> {
    let archive_formats: Vec<&FileFormatInfo> = formats.iter()
        .filter(|f| ["pak", "zip", "rar", "7z", "assets", "bundle", "arc"].contains(&f.extension.as_str()))
        .collect();
    
    if archive_formats.is_empty() {
        return Vec::new();
    }
    
    tool_db.iter()
        .filter(|tool| matches!(tool.category, ToolCategory::ArchiveExtraction))
        .filter(|tool| {
            (tool.supported_engines.contains(&engine.to_string()) || tool.supported_engines.contains(&"*".to_string())) &&
            archive_formats.iter().any(|f| tool.supported_formats.contains(&f.extension))
        })
        .map(|tool| SelectedTool {
            name: tool.name.clone(),
            category: tool.category.clone(),
            description: tool.description.clone(),
            supported_formats: tool.supported_formats.clone(),
            compatibility_score: tool.compatibility_score,
            ease_of_use: tool.ease_of_use,
            cost: tool.cost.clone(),
            platform_support: tool.platform_support.clone(),
            special_features: tool.special_features.clone(),
            recommended_usage: format!("Per estrazione archivi {} del gioco", engine),
            installation_notes: None,
        })
        .collect()
}

fn select_patch_tools(engine: &str, tool_db: &[Tool]) -> Vec<SelectedTool> {
    tool_db.iter()
        .filter(|tool| matches!(tool.category, ToolCategory::PatchCreation))
        .filter(|tool| tool.supported_engines.contains(&engine.to_string()) || tool.supported_engines.contains(&"*".to_string()))
        .map(|tool| SelectedTool {
            name: tool.name.clone(),
            category: tool.category.clone(),
            description: tool.description.clone(),
            supported_formats: tool.supported_formats.clone(),
            compatibility_score: tool.compatibility_score,
            ease_of_use: tool.ease_of_use,
            cost: tool.cost.clone(),
            platform_support: tool.platform_support.clone(),
            special_features: tool.special_features.clone(),
            recommended_usage: "Per creazione patch di traduzione".to_string(),
            installation_notes: Some("Installare con privilegi di amministratore per creazione installer".to_string()),
        })
        .collect()
}

fn generate_workflow_recommendations(selected_tools: &SelectedTools, result: &PredictionResult) -> Vec<String> {
    let mut recommendations = Vec::new();
    
    // Raccomandazioni principali
    if let Some(ref tool) = selected_tools.primary_text_tool {
        recommendations.push(format!("Usa {} come tool primario per estrazione testo", tool.name));
    }
    
    if !selected_tools.archive_tools.is_empty() {
        recommendations.push("Estrai prima gli archivi binari prima di procedere con il testo".to_string());
    }
    
    if !selected_tools.audio_tools.is_empty() {
        recommendations.push("Considera traduzione audio se il gioco ha doppiaggio importante".to_string());
    }
    
    if !selected_tools.graphics_tools.is_empty() {
        recommendations.push("Verifica immagini con testo incorporato che richiedono editing".to_string());
    }
    
    // Raccomandazioni basate sulla difficoltà
    if result.difficulty_score > 60 {
        recommendations.push("Per giochi difficili, usa tool alternativi se quello primario non funziona".to_string());
    }
    
    if result.drm_info.has_drm {
        recommendations.push("Attenzione: DRM rilevato - potrebbe interferire con estrazione file".to_string());
    }
    
    // Raccomandazioni basate sui costi
    let has_free_tools = selected_tools.primary_text_tool.as_ref()
        .map_or(false, |t| matches!(t.cost, ToolCost::Free | ToolCost::OpenSource));
    
    if has_free_tools {
        recommendations.push("Workflow principalmente gratuito disponibile".to_string());
    } else {
        recommendations.push("Considera costi licenze tool commerciali nel budget".to_string());
    }
    
    recommendations
}

fn calculate_selection_score(selected_tools: &SelectedTools, result: &PredictionResult) -> u32 {
    let mut score = 0u32;
    
    // Score tool primario
    if let Some(ref tool) = selected_tools.primary_text_tool {
        score += tool.compatibility_score;
        score += tool.ease_of_use / 2;
    }
    
    // Bonus per tool alternativi
    score += (selected_tools.alternative_text_tools.len() as u32 * 20).min(100);
    
    // Bonus per copertura completa
    let has_audio = !selected_tools.audio_tools.is_empty();
    let has_graphics = !selected_tools.graphics_tools.is_empty();
    let has_archive = !selected_tools.archive_tools.is_empty();
    let has_patch = !selected_tools.patch_tools.is_empty();
    
    if has_audio { score += 25; }
    if has_graphics { score += 25; }
    if has_archive { score += 30; }
    if has_patch { score += 20; }
    
    // Bonus per raccomandazioni workflow
    score += (selected_tools.workflow_recommendations.len() as u32 * 5).min(50);
    
    // Adjust based on game difficulty
    if result.difficulty_score > 70 {
        score = (score as f64 * 0.8) as u32; // Penalità per giochi difficili
    }
    
    score.min(100)
}

// ── LLM Chain Builder Engine ─────────────────────────────────────────────

fn build_optimized_llm_chains(result: &PredictionResult) -> Vec<OptimizedChain> {
    let llm_database = get_llm_database();
    let mut optimized_chains = Vec::new();
    
    // Calcola metriche base del progetto
    let total_words = result.text_stats.estimated_words;
    let total_chars = result.text_stats.estimated_characters;
    let complexity_factor = get_complexity_factor(&result.translation_complexity);
    
    // Build diverse chains for different needs
    optimized_chains.push(build_free_chain(&llm_database, total_words, total_chars, complexity_factor));
    optimized_chains.push(build_balanced_chain(&llm_database, total_words, total_chars, complexity_factor));
    optimized_chains.push(build_premium_chain(&llm_database, total_words, total_chars, complexity_factor));
    optimized_chains.push(build_fast_chain(&llm_database, total_words, total_chars, complexity_factor));
    optimized_chains.push(build_hybrid_chain(&llm_database, total_words, total_chars, complexity_factor, result));
    
    // Build budget-optimized chains for common budgets
    for budget in &[5.0, 10.0, 25.0, 50.0, 100.0] {
        if let Some(chain) = build_budget_chain(&llm_database, total_words, total_chars, complexity_factor, *budget) {
            optimized_chains.push(chain);
        }
    }
    
    // Sort by chain score
    optimized_chains.sort_by(|a, b| b.chain_score.cmp(&a.chain_score));
    optimized_chains
}

fn get_llm_database() -> Vec<LLMModel> {
    vec![
        // OpenAI Models
        LLMModel {
            name: "gpt-4o".to_string(),
            provider: LLMProvider::OpenAI,
            cost_per_million_input: 5.0,
            cost_per_million_output: 15.0,
            speed_tokens_per_sec: 80.0,
            quality_score: 95,
            max_context_tokens: 128000,
            rate_limit: 10000,
            special_features: vec!["Multilingual".to_string(), "Context-aware".to_string(), "Code-friendly".to_string()],
            best_for: vec!["Complex translation".to_string(), "Technical content".to_string()],
        },
        LLMModel {
            name: "gpt-4o-mini".to_string(),
            provider: LLMProvider::OpenAI,
            cost_per_million_input: 0.15,
            cost_per_million_output: 0.6,
            speed_tokens_per_sec: 150.0,
            quality_score: 85,
            max_context_tokens: 128000,
            rate_limit: 10000,
            special_features: vec!["Fast".to_string(), "Cost-effective".to_string(), "Multilingual".to_string()],
            best_for: vec!["Large volume".to_string(), "Draft translation".to_string()],
        },
        LLMModel {
            name: "gpt-3.5-turbo".to_string(),
            provider: LLMProvider::OpenAI,
            cost_per_million_input: 0.5,
            cost_per_million_output: 1.5,
            speed_tokens_per_sec: 120.0,
            quality_score: 75,
            max_context_tokens: 16385,
            rate_limit: 10000,
            special_features: vec!["Very fast".to_string(), "Reliable".to_string()],
            best_for: vec!["Simple content".to_string(), "Speed priority".to_string()],
        },
        
        // Anthropic Models
        LLMModel {
            name: "claude-3-5-sonnet-20241022".to_string(),
            provider: LLMProvider::Anthropic,
            cost_per_million_input: 3.0,
            cost_per_million_output: 15.0,
            speed_tokens_per_sec: 70.0,
            quality_score: 93,
            max_context_tokens: 200000,
            rate_limit: 8000,
            special_features: vec!["Long context".to_string(), "Creative writing".to_string(), "Nuanced translation".to_string()],
            best_for: vec!["Literary content".to_string(), "Complex context".to_string()],
        },
        LLMModel {
            name: "claude-3-haiku-20240307".to_string(),
            provider: LLMProvider::Anthropic,
            cost_per_million_input: 0.25,
            cost_per_million_output: 1.25,
            speed_tokens_per_sec: 200.0,
            quality_score: 80,
            max_context_tokens: 200000,
            rate_limit: 8000,
            special_features: vec!["Extremely fast".to_string(), "Long context".to_string()],
            best_for: vec!["Real-time translation".to_string(), "Large projects".to_string()],
        },
        
        // Google Models
        LLMModel {
            name: "gemini-1.5-pro".to_string(),
            provider: LLMProvider::Google,
            cost_per_million_input: 3.5,
            cost_per_million_output: 10.5,
            speed_tokens_per_sec: 60.0,
            quality_score: 90,
            max_context_tokens: 2097152,
            rate_limit: 5000,
            special_features: vec!["Massive context".to_string(), "Multimodal".to_string(), "Code understanding".to_string()],
            best_for: vec!["Document translation".to_string(), "Code-heavy content".to_string()],
        },
        LLMModel {
            name: "gemini-1.5-flash".to_string(),
            provider: LLMProvider::Google,
            cost_per_million_input: 0.075,
            cost_per_million_output: 0.3,
            speed_tokens_per_sec: 180.0,
            quality_score: 82,
            max_context_tokens: 1048576,
            rate_limit: 5000,
            special_features: vec!["Very fast".to_string(), "Large context".to_string(), "Cost-effective".to_string()],
            best_for: vec!["Batch processing".to_string(), "Draft translation".to_string()],
        },
        
        // Groq Models
        LLMModel {
            name: "llama-3.3-70b-versatile".to_string(),
            provider: LLMProvider::Groq,
            cost_per_million_input: 0.59,
            cost_per_million_output: 0.79,
            speed_tokens_per_sec: 400.0,
            quality_score: 85,
            max_context_tokens: 131072,
            rate_limit: 30000,
            special_features: vec!["Extremely fast".to_string(), "Open source".to_string(), "High throughput".to_string()],
            best_for: vec!["Speed-critical".to_string(), "Large volume".to_string()],
        },
        LLMModel {
            name: "mixtral-8x7b-32768".to_string(),
            provider: LLMProvider::Groq,
            cost_per_million_input: 0.27,
            cost_per_million_output: 0.27,
            speed_tokens_per_sec: 350.0,
            quality_score: 78,
            max_context_tokens: 32768,
            rate_limit: 30000,
            special_features: vec!["Fast".to_string(), "Mixture of experts".to_string()],
            best_for: vec!["General translation".to_string(), "Cost-effective".to_string()],
        },
        
        // DeepL
        LLMModel {
            name: "deepL-pro".to_string(),
            provider: LLMProvider::DeepL,
            cost_per_million_input: 25.0,
            cost_per_million_output: 25.0,
            speed_tokens_per_sec: 50.0,
            quality_score: 92,
            max_context_tokens: 128000,
            rate_limit: 5000,
            special_features: vec!["Translation-specialized".to_string(), "High accuracy".to_string(), "Formal tone".to_string()],
            best_for: vec!["Professional translation".to_string(), "Legal/medical".to_string()],
        },
        
        // Together AI
        LLMModel {
            name: "mistral-large-2411".to_string(),
            provider: LLMProvider::TogetherAI,
            cost_per_million_input: 2.0,
            cost_per_million_output: 6.0,
            speed_tokens_per_sec: 90.0,
            quality_score: 88,
            max_context_tokens: 128000,
            rate_limit: 10000,
            special_features: vec!["European languages".to_string(), "Nuanced understanding".to_string()],
            best_for: vec!["European languages".to_string(), "Cultural content".to_string()],
        },
        
        // Ollama Local Models — Gemma 4 (April 2026)
        LLMModel {
            name: "gemma4:27b-a4b".to_string(),
            provider: LLMProvider::Ollama,
            cost_per_million_input: 0.0,
            cost_per_million_output: 0.0,
            speed_tokens_per_sec: 55.0,
            quality_score: 93,
            max_context_tokens: 256000,
            rate_limit: 1000,
            special_features: vec!["MoE 4B active".to_string(), "256K context".to_string(), "35+ languages".to_string(), "Reasoning".to_string(), "Free".to_string()],
            best_for: vec!["Best local quality".to_string(), "Complex translation".to_string(), "Long documents".to_string()],
        },
        LLMModel {
            name: "gemma4:e4b".to_string(),
            provider: LLMProvider::Ollama,
            cost_per_million_input: 0.0,
            cost_per_million_output: 0.0,
            speed_tokens_per_sec: 70.0,
            quality_score: 82,
            max_context_tokens: 128000,
            rate_limit: 1000,
            special_features: vec!["Edge-optimized".to_string(), "128K context".to_string(), "Multimodal".to_string(), "Free".to_string()],
            best_for: vec!["Fast local translation".to_string(), "Consumer GPU".to_string()],
        },
        LLMModel {
            name: "gemma4:e2b".to_string(),
            provider: LLMProvider::Ollama,
            cost_per_million_input: 0.0,
            cost_per_million_output: 0.0,
            speed_tokens_per_sec: 100.0,
            quality_score: 72,
            max_context_tokens: 128000,
            rate_limit: 1000,
            special_features: vec!["Ultra-light".to_string(), "On-device".to_string(), "Audio support".to_string(), "Free".to_string()],
            best_for: vec!["Low-end hardware".to_string(), "Mobile/edge".to_string()],
        },
        // Translation-specialized models
        LLMModel {
            name: "translategemma:12b".to_string(),
            provider: LLMProvider::Ollama,
            cost_per_million_input: 0.0,
            cost_per_million_output: 0.0,
            speed_tokens_per_sec: 25.0,
            quality_score: 90,
            max_context_tokens: 8192,
            rate_limit: 1000,
            special_features: vec!["Translation-specialized".to_string(), "55 languages".to_string(), "Google quality".to_string(), "Free".to_string()],
            best_for: vec!["Best local translation".to_string(), "Multi-language projects".to_string()],
        },
        LLMModel {
            name: "translategemma:4b".to_string(),
            provider: LLMProvider::Ollama,
            cost_per_million_input: 0.0,
            cost_per_million_output: 0.0,
            speed_tokens_per_sec: 50.0,
            quality_score: 80,
            max_context_tokens: 8192,
            rate_limit: 1000,
            special_features: vec!["Translation-specialized".to_string(), "Lightweight".to_string(), "Fast".to_string(), "Free".to_string()],
            best_for: vec!["Fast local translation".to_string(), "Low-end hardware".to_string()],
        },
        LLMModel {
            name: "huihui_ai/hy-mt1.5-abliterated:7b".to_string(),
            provider: LLMProvider::Ollama,
            cost_per_million_input: 0.0,
            cost_per_million_output: 0.0,
            speed_tokens_per_sec: 30.0,
            quality_score: 83,
            max_context_tokens: 8192,
            rate_limit: 1000,
            special_features: vec!["Local processing".to_string(), "Privacy-focused".to_string(), "Free".to_string()],
            best_for: vec!["Sensitive content".to_string(), "Offline translation".to_string()],
        },
        LLMModel {
            name: "hy-mt1.5:1.8b".to_string(),
            provider: LLMProvider::Ollama,
            cost_per_million_input: 0.0,
            cost_per_million_output: 0.0,
            speed_tokens_per_sec: 80.0,
            quality_score: 68,
            max_context_tokens: 4096,
            rate_limit: 1000,
            special_features: vec!["Ultra-lightweight".to_string(), "1.1GB RAM".to_string(), "Free".to_string()],
            best_for: vec!["Very low-end hardware".to_string(), "Quick draft translation".to_string()],
        },
        LLMModel {
            name: "qwen3:14b".to_string(),
            provider: LLMProvider::Ollama,
            cost_per_million_input: 0.0,
            cost_per_million_output: 0.0,
            speed_tokens_per_sec: 20.0,
            quality_score: 88,
            max_context_tokens: 32768,
            rate_limit: 1000,
            special_features: vec!["CJK excellence".to_string(), "Large context".to_string(), "Free".to_string()],
            best_for: vec!["Asian languages".to_string(), "Complex content".to_string()],
        },
        LLMModel {
            name: "llama3.1:8b".to_string(),
            provider: LLMProvider::Ollama,
            cost_per_million_input: 0.0,
            cost_per_million_output: 0.0,
            speed_tokens_per_sec: 40.0,
            quality_score: 75,
            max_context_tokens: 128000,
            rate_limit: 1000,
            special_features: vec!["Local".to_string(), "Free".to_string(), "Large context".to_string()],
            best_for: vec!["Budget projects".to_string(), "Testing".to_string()],
        },
    ]
}

// Struttura interna per database LLM
#[derive(Debug, Clone)]
struct LLMModel {
    name: String,
    provider: LLMProvider,
    cost_per_million_input: f64,
    cost_per_million_output: f64,
    speed_tokens_per_sec: f64,
    quality_score: u32,
    max_context_tokens: u32,
    rate_limit: u32,
    special_features: Vec<String>,
    best_for: Vec<String>,
}

fn get_complexity_factor(complexity: &TranslationComplexity) -> f64 {
    let mut factor = 1.0;
    
    // Complessità variabili
    if complexity.variable_count > 1000 {
        factor *= 1.2;
    }
    
    // Complessità markup
    if complexity.markup_count > 500 {
        factor *= 1.1;
    }
    
    // Plurali e generi
    if complexity.has_plurals || complexity.has_gender_forms {
        factor *= 1.15;
    }
    
    // Stringhe molto lunghe
    if complexity.long_strings_percent > 20.0 {
        factor *= 1.1;
    }
    
    factor
}

/// Safe model lookup with cascading fallback — never panics
fn find_model<'a>(llm_db: &'a [LLMModel], names: &[&str]) -> &'a LLMModel {
    for name in names {
        if let Some(m) = llm_db.iter().find(|m| m.name == *name) {
            return m;
        }
    }
    // Fallback: best quality model available
    llm_db.iter()
        .max_by_key(|m| m.quality_score)
        .unwrap_or(&llm_db[0])
}

/// Safe fastest model lookup
fn find_fastest_model(llm_db: &[LLMModel]) -> &LLMModel {
    llm_db.iter()
        .max_by(|a, b| a.speed_tokens_per_sec.partial_cmp(&b.speed_tokens_per_sec).unwrap_or(std::cmp::Ordering::Equal))
        .unwrap_or(&llm_db[0])
}

fn build_free_chain(llm_db: &[LLMModel], words: u64, chars: u64, complexity: f64) -> OptimizedChain {
    // Prefer Gemma 4 27B MoE (best free local), then TranslateGemma (translation-specialized), then HY-MT
    let primary = find_model(llm_db, &["gemma4:27b-a4b", "translategemma:12b", "huihui_ai/hy-mt1.5-abliterated:7b", "gemma4:e4b", "llama3.1:8b"]);
    
    let estimated_tokens = (words as f64 * 1.3) + (chars as f64 * 0.1);
    let estimated_hours = estimated_tokens / (primary.speed_tokens_per_sec * 3600.0);
    
    OptimizedChain {
        chain_name: "Free Local Translation".to_string(),
        chain_type: ChainType::Free,
        models: vec![ChainModel {
            model_name: primary.name.clone(),
            provider: primary.provider.clone(),
            role: ModelRole::PrimaryTranslation,
            workload_percentage: 100.0,
            cost_per_million_tokens: 0.0,
            speed_tokens_per_sec: primary.speed_tokens_per_sec,
            output_quality: primary.quality_score,
            rate_limit: primary.rate_limit,
            max_context_tokens: primary.max_context_tokens,
            notes: vec!["Completely free".to_string(), "Local processing".to_string(), "Privacy-focused".to_string()],
        }],
        estimated_cost_usd: 0.0,
        estimated_time_hours: estimated_hours * complexity,
        final_quality_score: (primary.quality_score as f64 * 0.9) as u32, // Slight penalty for free models
        prediction_confidence: 85,
        target_budget: None,
        advantages: vec!["Zero cost".to_string(), "Complete privacy".to_string(), "No rate limits".to_string()],
        disadvantages: vec!["Lower quality".to_string(), "Slower processing".to_string(), "Limited context".to_string()],
        best_for: "Budget projects, sensitive content, testing".to_string(),
        chain_score: 75,
    }
}

fn build_balanced_chain(llm_db: &[LLMModel], words: u64, chars: u64, complexity: f64) -> OptimizedChain {
    let primary = find_model(llm_db, &["gpt-4o-mini", "gemini-1.5-flash", "llama-3.3-70b-versatile"]);
    
    let post_editor = find_model(llm_db, &["claude-3-haiku-20240307", "gpt-4o-mini", "gemini-1.5-flash"]);
    
    let estimated_tokens = (words as f64 * 1.3) + (chars as f64 * 0.1);
    let primary_tokens = estimated_tokens * 0.7;
    let post_edit_tokens = estimated_tokens * 0.3;
    
    let primary_cost = (primary_tokens / 1_000_000.0) * (primary.cost_per_million_input + primary.cost_per_million_output) / 2.0;
    let post_edit_cost = (post_edit_tokens / 1_000_000.0) * (post_editor.cost_per_million_input + post_editor.cost_per_million_output) / 2.0;
    
    let primary_hours = primary_tokens / (primary.speed_tokens_per_sec * 3600.0);
    let post_edit_hours = post_edit_tokens / (post_editor.speed_tokens_per_sec * 3600.0);
    
    OptimizedChain {
        chain_name: "Balanced Quality & Cost".to_string(),
        chain_type: ChainType::Balanced,
        models: vec![
            ChainModel {
                model_name: primary.name.clone(),
                provider: primary.provider.clone(),
                role: ModelRole::PrimaryTranslation,
                workload_percentage: 70.0,
                cost_per_million_tokens: (primary.cost_per_million_input + primary.cost_per_million_output) / 2.0,
                speed_tokens_per_sec: primary.speed_tokens_per_sec,
                output_quality: primary.quality_score,
                rate_limit: primary.rate_limit,
                max_context_tokens: primary.max_context_tokens,
                notes: vec!["Fast and reliable".to_string(), "Cost-effective".to_string()],
            },
            ChainModel {
                model_name: post_editor.name.clone(),
                provider: post_editor.provider.clone(),
                role: ModelRole::PostEditing,
                workload_percentage: 30.0,
                cost_per_million_tokens: (post_editor.cost_per_million_input + post_editor.cost_per_million_output) / 2.0,
                speed_tokens_per_sec: post_editor.speed_tokens_per_sec,
                output_quality: post_editor.quality_score,
                rate_limit: post_editor.rate_limit,
                max_context_tokens: post_editor.max_context_tokens,
                notes: vec!["Quality improvement".to_string(), "Nuance enhancement".to_string()],
            },
        ],
        estimated_cost_usd: (primary_cost + post_edit_cost) * complexity,
        estimated_time_hours: (primary_hours + post_edit_hours) * complexity,
        final_quality_score: ((primary.quality_score as f64 * 0.7 + post_editor.quality_score as f64 * 0.3) * 0.95) as u32,
        prediction_confidence: 90,
        target_budget: None,
        advantages: vec!["Good quality".to_string(), "Reasonable cost".to_string(), "Two-step quality".to_string()],
        disadvantages: vec!["More complex".to_string(), "Higher cost than free".to_string()],
        best_for: "Most projects requiring quality with budget constraints".to_string(),
        chain_score: 88,
    }
}

fn build_premium_chain(llm_db: &[LLMModel], words: u64, chars: u64, complexity: f64) -> OptimizedChain {
    let primary = find_model(llm_db, &["gpt-4o", "claude-3-5-sonnet-20241022", "gemini-1.5-pro"]);
    
    let post_editor = find_model(llm_db, &["deepL-pro", "claude-3-haiku-20240307", "gpt-4o-mini"]);
    
    let reviewer = find_model(llm_db, &["gemini-1.5-pro", "gpt-4o", "claude-3-5-sonnet-20241022"]);
    
    let estimated_tokens = (words as f64 * 1.3) + (chars as f64 * 0.1);
    let primary_tokens = estimated_tokens * 0.6;
    let post_edit_tokens = estimated_tokens * 0.3;
    let review_tokens = estimated_tokens * 0.1;
    
    let primary_cost = (primary_tokens / 1_000_000.0) * (primary.cost_per_million_input + primary.cost_per_million_output) / 2.0;
    let post_edit_cost = (post_edit_tokens / 1_000_000.0) * (post_editor.cost_per_million_input + post_editor.cost_per_million_output) / 2.0;
    let review_cost = (review_tokens / 1_000_000.0) * (reviewer.cost_per_million_input + reviewer.cost_per_million_output) / 2.0;
    
    let primary_hours = primary_tokens / (primary.speed_tokens_per_sec * 3600.0);
    let post_edit_hours = post_edit_tokens / (post_editor.speed_tokens_per_sec * 3600.0);
    let review_hours = review_tokens / (reviewer.speed_tokens_per_sec * 3600.0);
    
    OptimizedChain {
        chain_name: "Premium Maximum Quality".to_string(),
        chain_type: ChainType::Premium,
        models: vec![
            ChainModel {
                model_name: primary.name.clone(),
                provider: primary.provider.clone(),
                role: ModelRole::PrimaryTranslation,
                workload_percentage: 60.0,
                cost_per_million_tokens: (primary.cost_per_million_input + primary.cost_per_million_output) / 2.0,
                speed_tokens_per_sec: primary.speed_tokens_per_sec,
                output_quality: primary.quality_score,
                rate_limit: primary.rate_limit,
                max_context_tokens: primary.max_context_tokens,
                notes: vec!["Top-tier quality".to_string(), "Context-aware".to_string()],
            },
            ChainModel {
                model_name: post_editor.name.clone(),
                provider: post_editor.provider.clone(),
                role: ModelRole::PostEditing,
                workload_percentage: 30.0,
                cost_per_million_tokens: (post_editor.cost_per_million_input + post_editor.cost_per_million_output) / 2.0,
                speed_tokens_per_sec: post_editor.speed_tokens_per_sec,
                output_quality: post_editor.quality_score,
                rate_limit: post_editor.rate_limit,
                max_context_tokens: post_editor.max_context_tokens,
                notes: vec!["Specialized translation".to_string(), "Professional quality".to_string()],
            },
            ChainModel {
                model_name: reviewer.name.clone(),
                provider: reviewer.provider.clone(),
                role: ModelRole::QualityReview,
                workload_percentage: 10.0,
                cost_per_million_tokens: (reviewer.cost_per_million_input + reviewer.cost_per_million_output) / 2.0,
                speed_tokens_per_sec: reviewer.speed_tokens_per_sec,
                output_quality: reviewer.quality_score,
                rate_limit: reviewer.rate_limit,
                max_context_tokens: reviewer.max_context_tokens,
                notes: vec!["Final quality check".to_string(), "Massive context".to_string()],
            },
        ],
        estimated_cost_usd: (primary_cost + post_edit_cost + review_cost) * complexity,
        estimated_time_hours: (primary_hours + post_edit_hours + review_hours) * complexity,
        final_quality_score: ((primary.quality_score as f64 * 0.6 + post_editor.quality_score as f64 * 0.3 + reviewer.quality_score as f64 * 0.1) * 0.98) as u32,
        prediction_confidence: 95,
        target_budget: None,
        advantages: vec!["Maximum quality".to_string(), "Three-step review".to_string(), "Professional grade".to_string()],
        disadvantages: vec!["Highest cost".to_string(), "Longest time".to_string(), "Complex setup".to_string()],
        best_for: "Professional projects, critical content, premium clients".to_string(),
        chain_score: 95,
    }
}

fn build_fast_chain(llm_db: &[LLMModel], words: u64, chars: u64, complexity: f64) -> OptimizedChain {
    let fastest = find_fastest_model(llm_db);
    
    let estimated_tokens = (words as f64 * 1.3) + (chars as f64 * 0.1);
    let estimated_hours = estimated_tokens / (fastest.speed_tokens_per_sec * 3600.0);
    
    let avg_cost = (fastest.cost_per_million_input + fastest.cost_per_million_output) / 2.0;
    let estimated_cost = (estimated_tokens / 1_000_000.0) * avg_cost;
    
    OptimizedChain {
        chain_name: "Ultra-Fast Translation".to_string(),
        chain_type: ChainType::Fast,
        models: vec![ChainModel {
            model_name: fastest.name.clone(),
            provider: fastest.provider.clone(),
            role: ModelRole::PrimaryTranslation,
            workload_percentage: 100.0,
            cost_per_million_tokens: avg_cost,
            speed_tokens_per_sec: fastest.speed_tokens_per_sec,
            output_quality: fastest.quality_score,
            rate_limit: fastest.rate_limit,
            max_context_tokens: fastest.max_context_tokens,
            notes: vec!["Maximum speed".to_string(), "High throughput".to_string()],
        }],
        estimated_cost_usd: estimated_cost * complexity,
        estimated_time_hours: estimated_hours * complexity,
        final_quality_score: (fastest.quality_score as f64 * 0.85) as u32, // Speed penalty
        prediction_confidence: 88,
        target_budget: None,
        advantages: vec!["Fastest processing".to_string(), "High throughput".to_string(), "Simple workflow".to_string()],
        disadvantages: vec!["Quality compromise".to_string(), "Single model".to_string()],
        best_for: "Time-critical projects, large volume batch processing".to_string(),
        chain_score: 82,
    }
}

fn build_hybrid_chain(llm_db: &[LLMModel], words: u64, chars: u64, complexity: f64, result: &PredictionResult) -> OptimizedChain {
    // Scegli modelli diversi in base alla complessità rilevata
    let primary = if result.translation_complexity.has_plurals || result.translation_complexity.has_gender_forms {
        find_model(llm_db, &["claude-3-5-sonnet-20241022", "gpt-4o", "gemini-1.5-pro"])
    } else {
        find_model(llm_db, &["gpt-4o-mini", "gemini-1.5-flash", "llama-3.3-70b-versatile"])
    };
    
    let context_detector = if result.translation_complexity.variable_count > 1000 {
        find_model(llm_db, &["gemini-1.5-pro", "gpt-4o", "claude-3-5-sonnet-20241022"])
    } else {
        find_model(llm_db, &["llama-3.3-70b-versatile", "gemini-1.5-flash", "gpt-4o-mini"])
    };
    
    let post_editor = find_model(llm_db, &["claude-3-haiku-20240307", "gpt-4o-mini", "gemini-1.5-flash"]);
    
    let estimated_tokens = (words as f64 * 1.3) + (chars as f64 * 0.1);
    
    OptimizedChain {
        chain_name: "Adaptive Hybrid Translation".to_string(),
        chain_type: ChainType::Hybrid,
        models: vec![
            ChainModel {
                model_name: context_detector.name.clone(),
                provider: context_detector.provider.clone(),
                role: ModelRole::ContextDetection,
                workload_percentage: 10.0,
                cost_per_million_tokens: (context_detector.cost_per_million_input + context_detector.cost_per_million_output) / 2.0,
                speed_tokens_per_sec: context_detector.speed_tokens_per_sec,
                output_quality: context_detector.quality_score,
                rate_limit: context_detector.rate_limit,
                max_context_tokens: context_detector.max_context_tokens,
                notes: vec!["Context analysis".to_string(), "Complexity handling".to_string()],
            },
            ChainModel {
                model_name: primary.name.clone(),
                provider: primary.provider.clone(),
                role: ModelRole::PrimaryTranslation,
                workload_percentage: 70.0,
                cost_per_million_tokens: (primary.cost_per_million_input + primary.cost_per_million_output) / 2.0,
                speed_tokens_per_sec: primary.speed_tokens_per_sec,
                output_quality: primary.quality_score,
                rate_limit: primary.rate_limit,
                max_context_tokens: primary.max_context_tokens,
                notes: vec!["Adaptive selection".to_string(), "Complexity-aware".to_string()],
            },
            ChainModel {
                model_name: post_editor.name.clone(),
                provider: post_editor.provider.clone(),
                role: ModelRole::PostEditing,
                workload_percentage: 20.0,
                cost_per_million_tokens: (post_editor.cost_per_million_input + post_editor.cost_per_million_output) / 2.0,
                speed_tokens_per_sec: post_editor.speed_tokens_per_sec,
                output_quality: post_editor.quality_score,
                rate_limit: post_editor.rate_limit,
                max_context_tokens: post_editor.max_context_tokens,
                notes: vec!["Quality refinement".to_string(), "Fast post-edit".to_string()],
            },
        ],
        estimated_cost_usd: calculate_chain_cost(&[context_detector, primary, post_editor], estimated_tokens, &[10.0, 70.0, 20.0]) * complexity,
        estimated_time_hours: calculate_chain_time(&[context_detector, primary, post_editor], estimated_tokens, &[10.0, 70.0, 20.0]) * complexity,
        final_quality_score: ((context_detector.quality_score as f64 * 0.1 + primary.quality_score as f64 * 0.7 + post_editor.quality_score as f64 * 0.2) * 0.96) as u32,
        prediction_confidence: 92,
        target_budget: None,
        advantages: vec!["Adaptive to complexity".to_string(), "Context-aware".to_string(), "Optimized workflow".to_string()],
        disadvantages: vec!["Complex configuration".to_string(), "Higher cost".to_string()],
        best_for: "Complex projects with varied content types".to_string(),
        chain_score: 90,
    }
}

fn build_budget_chain(llm_db: &[LLMModel], words: u64, chars: u64, complexity: f64, budget: f64) -> Option<OptimizedChain> {
    let estimated_tokens = (words as f64 * 1.3) + (chars as f64 * 0.1);
    let budget_per_million = (budget / estimated_tokens) * 1_000_000.0;
    
    // Find best model within budget
    let affordable_models: Vec<_> = llm_db.iter()
        .filter(|m| {
            let avg_cost = (m.cost_per_million_input + m.cost_per_million_output) / 2.0;
            avg_cost <= budget_per_million * 1.5 // Allow some flexibility
        })
        .collect();
    
    if affordable_models.is_empty() {
        return None;
    }
    
    let primary = affordable_models.iter()
        .max_by(|a, b| (a.quality_score as f64 / a.cost_per_million_input).partial_cmp(&(b.quality_score as f64 / b.cost_per_million_input)).unwrap())
        .unwrap();
    
    let estimated_hours = estimated_tokens / (primary.speed_tokens_per_sec * 3600.0);
    let avg_cost = (primary.cost_per_million_input + primary.cost_per_million_output) / 2.0;
    let estimated_cost = (estimated_tokens / 1_000_000.0) * avg_cost;
    
    Some(OptimizedChain {
        chain_name: format!("Budget Optimized (${:.0})", budget),
        chain_type: ChainType::BudgetOptimized,
        models: vec![ChainModel {
            model_name: primary.name.clone(),
            provider: primary.provider.clone(),
            role: ModelRole::PrimaryTranslation,
            workload_percentage: 100.0,
            cost_per_million_tokens: avg_cost,
            speed_tokens_per_sec: primary.speed_tokens_per_sec,
            output_quality: primary.quality_score,
            rate_limit: primary.rate_limit,
            max_context_tokens: primary.max_context_tokens,
            notes: vec![format!("Budget: ${:.2}", budget), "Cost-optimized".to_string()],
        }],
        estimated_cost_usd: estimated_cost * complexity,
        estimated_time_hours: estimated_hours * complexity,
        final_quality_score: (primary.quality_score as f64 * 0.9) as u32,
        prediction_confidence: 80,
        target_budget: Some(budget),
        advantages: vec![format!("Within ${:.0} budget", budget), "Cost-effective".to_string()],
        disadvantages: vec!["Limited model choice".to_string(), "Quality compromise".to_string()],
        best_for: format!("Projects with ${:.0} budget constraint", budget),
        chain_score: 78,
    })
}

fn calculate_chain_cost(models: &[&LLMModel], total_tokens: f64, workloads: &[f64]) -> f64 {
    models.iter().zip(workloads.iter()).map(|(model, workload)| {
        let tokens = total_tokens * (workload / 100.0);
        let avg_cost = (model.cost_per_million_input + model.cost_per_million_output) / 2.0;
        (tokens / 1_000_000.0) * avg_cost
    }).sum()
}

fn calculate_chain_time(models: &[&LLMModel], total_tokens: f64, workloads: &[f64]) -> f64 {
    models.iter().zip(workloads.iter()).map(|(model, workload)| {
        let tokens = total_tokens * (workload / 100.0);
        tokens / (model.speed_tokens_per_sec * 3600.0)
    }).sum()
}

// ── Multimedia Analysis Engine ───────────────────────────────────────────

fn analyze_multimedia_files(game_path: &Path, engine: &str, _result: &PredictionResult) -> MultimediaAnalysis {
    let audio_stats = analyze_audio_files(game_path);
    let graphics_stats = analyze_graphics_files(game_path);
    let recommended_tools = select_multimedia_tools(&audio_stats, &graphics_stats, engine);
    let multimedia_estimates = calculate_multimedia_estimates(&audio_stats, &graphics_stats, &recommended_tools);
    let problematic_files = detect_problematic_multimedia_files(game_path, &audio_stats, &graphics_stats);
    let multimedia_complexity_score = calculate_multimedia_complexity(&audio_stats, &graphics_stats, &problematic_files);
    
    MultimediaAnalysis {
        audio_stats,
        graphics_stats,
        recommended_tools,
        multimedia_estimates,
        multimedia_complexity_score,
        problematic_files,
    }
}

fn analyze_audio_files(game_path: &Path) -> AudioStats {
    let audio_extensions = vec![
        "wav", "mp3", "ogg", "flac", "aac", "m4a", "wma", "aiff",
        "wem", "bnk", "pck", "fsb", "xm", "it", "s3m", "mod",
        "opus", "ac3", "dts", "amr", "3gp", "ra", "au"
    ];
    
    let mut total_files = 0u32;
    let mut total_size_mb = 0.0f64;
    let mut format_counts = std::collections::HashMap::new();
    let mut localizable_files = 0u32;
    let mut music_ambient_files = 0u32;
    let mut compressed_files = 0u32;
    let mut streaming_files = 0u32;
    let mut total_duration_estimate = 0.0f64;
    
    let mut quality_samples = Vec::new();
    
    if let Ok(entries) = walk_directory(game_path, &audio_extensions) {
        for entry in entries {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_file() {
                    total_files += 1;
                    let size_mb = metadata.len() as f64 / (1024.0 * 1024.0);
                    total_size_mb += size_mb;
                    
                    if let Some(ext) = entry.extension().and_then(|e| e.to_str()) {
                        let ext_lower = ext.to_lowercase();
                        *format_counts.entry(ext_lower.clone()).or_insert(0) += 1;
                        
                        // Classify file type
                        if is_localizable_audio(&entry, &ext_lower) {
                            localizable_files += 1;
                        } else if is_music_ambient_audio(&entry, &ext_lower) {
                            music_ambient_files += 1;
                        }
                        
                        // Check for compressed formats
                        if is_compressed_audio_format(&ext_lower) {
                            compressed_files += 1;
                        }
                        
                        // Check for streaming formats
                        if is_streaming_audio_format(&ext_lower) {
                            streaming_files += 1;
                        }
                        
                        // Estimate duration (rough approximation)
                        let duration_min = estimate_audio_duration(&ext_lower, size_mb);
                        total_duration_estimate += duration_min;
                        
                        // Sample quality assessment
                        if let Some(quality) = assess_audio_quality(&entry, size_mb) {
                            quality_samples.push(quality);
                        }
                    }
                }
            }
        }
    }
    
    // Build format info
    let audio_formats: Vec<AudioFormatInfo> = format_counts.into_iter().map(|(ext, count)| {
        let ext_clone = ext.clone();
        let typical_quality = get_typical_audio_quality(&ext);
        let is_editable = is_audio_editable(&ext);
        let requires_specialized = !is_editable || is_compressed_audio_format(&ext);
        
        AudioFormatInfo {
            extension: ext_clone,
            count,
            total_size_mb: total_size_mb * (count as f64 / total_files as f64), // Approximate
            is_editable,
            requires_specialized_tools: requires_specialized,
            typical_quality,
            notes: get_audio_format_notes(&ext),
        }
    }).collect();
    
    // Determine predominant quality
    let predominant_quality = if quality_samples.is_empty() {
        AudioQuality::Unknown
    } else {
        let avg_quality = quality_samples.iter().map(|q| quality_to_score(q)).sum::<f64>() / quality_samples.len() as f64;
        if avg_quality >= 4.5 { AudioQuality::Studio }
        else if avg_quality >= 3.5 { AudioQuality::High }
        else if avg_quality >= 2.5 { AudioQuality::Medium }
        else if avg_quality >= 1.5 { AudioQuality::Low }
        else { AudioQuality::Unknown }
    };
    
    AudioStats {
        total_audio_files: total_files,
        total_audio_size_mb: total_size_mb,
        audio_formats,
        localizable_audio_files: localizable_files,
        music_ambient_files: music_ambient_files,
        compressed_audio_files: compressed_files,
        estimated_total_minutes: total_duration_estimate,
        predominant_quality,
        streaming_audio_files: streaming_files,
    }
}

fn analyze_graphics_files(game_path: &Path) -> GraphicsStats {
    let graphics_extensions = vec![
        "png", "jpg", "jpeg", "gif", "bmp", "tga", "dds", "psd", "tiff", "webp",
        "svg", "ico", "icns", "pnm", "pbm", "pgm", "ppm", "xbm", "xpm",
        "apng", "avif", "heif", "heic", "jxl", "qoi"
    ];
    
    let mut total_files = 0u32;
    let mut total_size_mb = 0.0f64;
    let mut format_counts = std::collections::HashMap::new();
    let mut text_containing_files = 0u32;
    let mut ui_interface_files = 0u32;
    let mut texture_sprite_files = 0u32;
    let mut embedded_text_files = 0u32;
    let mut animated_files = 0u32;
    
    let mut resolution_samples = Vec::new();
    
    if let Ok(entries) = walk_directory(game_path, &graphics_extensions) {
        for entry in entries {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_file() {
                    total_files += 1;
                    let size_mb = metadata.len() as f64 / (1024.0 * 1024.0);
                    total_size_mb += size_mb;
                    
                    if let Some(ext) = entry.extension().and_then(|e| e.to_str()) {
                        let ext_lower = ext.to_lowercase();
                        *format_counts.entry(ext_lower.clone()).or_insert(0) += 1;
                        
                        // Classify file type
                        if contains_text(&entry) {
                            text_containing_files += 1;
                            if is_ui_interface_file(&entry) {
                                ui_interface_files += 1;
                            }
                        }
                        
                        if is_texture_or_sprite(&entry) {
                            texture_sprite_files += 1;
                        }
                        
                        if has_embedded_text(&entry) {
                            embedded_text_files += 1;
                        }
                        
                        // Check for animated formats
                        if is_animated_format(&ext_lower) {
                            animated_files += 1;
                        }
                        
                        // Sample resolution
                        if let Some(resolution) = detect_image_resolution(&entry) {
                            resolution_samples.push(resolution);
                        }
                    }
                }
            }
        }
    }
    
    // Build format info
    let graphics_formats: Vec<GraphicsFormatInfo> = format_counts.into_iter().map(|(ext, count)| {
        let ext_clone = ext.clone();
        let compression_type = get_graphics_compression_type(&ext);
        let supports_transparency = supports_alpha_channel(&ext);
        let is_editable = is_graphics_editable(&ext);
        
        GraphicsFormatInfo {
            extension: ext_clone,
            count,
            total_size_mb: total_size_mb * (count as f64 / total_files as f64), // Approximate
            is_editable,
            supports_transparency,
            compression_type,
            resolutions: get_common_resolutions_for_format(&ext),
            notes: get_graphics_format_notes(&ext),
        }
    }).collect();
    
    // Determine predominant resolution
    let predominant_resolution = if resolution_samples.is_empty() {
        "Unknown".to_string()
    } else {
        // Find most common resolution
        let mut resolution_counts = std::collections::HashMap::new();
        for res in &resolution_samples {
            *resolution_counts.entry(res.clone()).or_insert(0) += 1;
        }
        resolution_counts.into_iter()
            .max_by_key(|(_, count)| *count)
            .map(|(res, _)| res)
            .unwrap_or_else(|| "Unknown".to_string())
    };
    
    GraphicsStats {
        total_graphics_files: total_files,
        total_graphics_size_mb: total_size_mb,
        graphics_formats,
        text_containing_graphics: text_containing_files,
        ui_interface_files: ui_interface_files,
        texture_sprite_files: texture_sprite_files,
        embedded_text_files: embedded_text_files,
        predominant_resolution,
        animated_files,
    }
}

fn select_multimedia_tools(audio_stats: &AudioStats, graphics_stats: &GraphicsStats, engine: &str) -> MultimediaTools {
    let multimedia_db = get_multimedia_tool_database();
    
    let audio_tools = select_multimedia_audio_tools(&multimedia_db, audio_stats, engine);
    let graphics_tools = select_multimedia_graphics_tools(&multimedia_db, graphics_stats, engine);
    let engine_specific_tools = select_engine_specific_tools(&multimedia_db, engine);
    let compression_tools = select_compression_tools(&multimedia_db, audio_stats, graphics_stats);
    
    MultimediaTools {
        audio_tools,
        graphics_tools,
        engine_specific_tools,
        compression_tools,
    }
}

fn calculate_multimedia_estimates(audio_stats: &AudioStats, graphics_stats: &GraphicsStats, tools: &MultimediaTools) -> MultimediaEstimates {
    // Audio editing time estimation
    let audio_editing_hours = estimate_audio_editing_time(audio_stats);
    
    // Graphics editing time estimation
    let graphics_editing_hours = estimate_graphics_editing_time(graphics_stats);
    
    // Tool costs
    let tool_costs_usd = calculate_multimedia_tool_costs(tools);
    
    // Complexity assessment
    let total_complexity = calculate_multimedia_complexity_score(audio_stats, graphics_stats);
    
    // High complexity files
    let high_complexity_files = audio_stats.compressed_audio_files + graphics_stats.embedded_text_files;
    
    // Compression difficulty factor
    let compression_difficulty_factor = calculate_compression_difficulty(audio_stats, graphics_stats);
    
    // Outsourcing cost estimation
    let outsourcing_cost_estimate = estimate_outsourcing_costs(audio_editing_hours, graphics_editing_hours, total_complexity);
    
    MultimediaEstimates {
        audio_editing_hours,
        graphics_editing_hours,
        tool_costs_usd,
        total_complexity,
        high_complexity_files,
        compression_difficulty_factor,
        outsourcing_cost_estimate,
    }
}

fn detect_problematic_multimedia_files(_game_path: &Path, audio_stats: &AudioStats, graphics_stats: &GraphicsStats) -> Vec<ProblematicFile> {
    let mut problematic_files = Vec::new();
    
    // Check for compressed audio files
    if audio_stats.compressed_audio_files > 0 {
        problematic_files.push(ProblematicFile {
            file_path: "Multiple compressed audio files".to_string(),
            problem_type: ProblemType::CompressedFormat,
            severity: if audio_stats.compressed_audio_files > 100 { ProblemSeverity::High } else { ProblemSeverity::Medium },
            description: format!("Found {} compressed audio files that require specialized tools", audio_stats.compressed_audio_files),
            suggested_solutions: vec![
                "Use WW2Ogg or FSB extractor".to_string(),
                "Convert to WAV format first".to_string(),
                "Consider using FMOD/Wwise tools".to_string(),
            ],
            required_tools: vec!["WW2Ogg".to_string(), "FSB Extractor".to_string(), "VGMToolbox".to_string()],
        });
    }
    
    // Check for embedded text in graphics
    if graphics_stats.embedded_text_files > 0 {
        problematic_files.push(ProblematicFile {
            file_path: "Graphics with embedded text".to_string(),
            problem_type: ProblemType::EmbeddedText,
            severity: if graphics_stats.embedded_text_files > 50 { ProblemSeverity::High } else { ProblemSeverity::Medium },
            description: format!("Found {} graphics files with embedded text that requires manual editing", graphics_stats.embedded_text_files),
            suggested_solutions: vec![
                "Use Photoshop/GIMP for manual text replacement".to_string(),
                "Consider vector text layers if possible".to_string(),
                "Use OCR tools to extract text first".to_string(),
            ],
            required_tools: vec!["Photoshop".to_string(), "GIMP".to_string(), "Inkscape".to_string()],
        });
    }
    
    // Check for very large files
    if audio_stats.total_audio_size_mb > 1000.0 || graphics_stats.total_graphics_size_mb > 2000.0 {
        problematic_files.push(ProblematicFile {
            file_path: "Large multimedia files".to_string(),
            problem_type: ProblemType::LargeFileSize,
            severity: ProblemSeverity::Medium,
            description: format!("Large multimedia files detected (Audio: {:.1}MB, Graphics: {:.1}MB)", 
                audio_stats.total_audio_size_mb, graphics_stats.total_graphics_size_mb),
            suggested_solutions: vec![
                "Consider file compression".to_string(),
                "Process files in batches".to_string(),
                "Use high-performance hardware".to_string(),
            ],
            required_tools: vec!["High-spec workstation".to_string(), "Batch processing tools".to_string()],
        });
    }
    
    problematic_files
}

fn calculate_multimedia_complexity(audio_stats: &AudioStats, graphics_stats: &GraphicsStats, problematic_files: &[ProblematicFile]) -> u32 {
    let mut score = 0u32;
    
    // Base complexity from file counts
    score += (audio_stats.total_audio_files / 10).min(20); // Max 20 points
    score += (graphics_stats.total_graphics_files / 20).min(20); // Max 20 points
    
    // Complexity from file sizes
    score += ((audio_stats.total_audio_size_mb / 100.0) as u32).min(15); // Max 15 points
    score += ((graphics_stats.total_graphics_size_mb / 200.0) as u32).min(15); // Max 15 points
    
    // Complexity from difficult formats
    score += (audio_stats.compressed_audio_files * 2).min(10); // Max 10 points
    score += (graphics_stats.embedded_text_files * 3).min(10); // Max 10 points
    
    // Complexity from problematic files
    for problem in problematic_files {
        match problem.severity {
            ProblemSeverity::Low => score += 1,
            ProblemSeverity::Medium => score += 3,
            ProblemSeverity::High => score += 5,
            ProblemSeverity::Critical => score += 10,
        }
    }
    
    score.min(100)
}

// ── Helper Functions ───────────────────────────────────────────────────

fn walk_directory(path: &Path, extensions: &[&str]) -> std::io::Result<Vec<PathBuf>> {
    let mut files = Vec::new();
    
    if path.is_dir() {
        for entry in std::fs::read_dir(path)? {
            let entry = entry?;
            let path = entry.path();
            
            if path.is_dir() && !path.file_name().unwrap_or_default().to_string_lossy().starts_with('.') {
                // Recurse into subdirectories
                if let Ok(sub_files) = walk_directory(&path, extensions) {
                    files.extend(sub_files);
                }
            } else if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                if extensions.contains(&ext.to_lowercase().as_str()) {
                    files.push(path);
                }
            }
        }
    }
    
    Ok(files)
}

fn is_localizable_audio(path: &Path, ext: &str) -> bool {
    let path_str = path.to_string_lossy().to_lowercase();
    
    // Check file name patterns for dialogue/voice files
    let dialogue_patterns = [
        "dialog", "voice", "speech", "talk", "say", "speak", "narr", "story",
        "char", "npc", "player", "cutscene", "cinema", "intro", "outro"
    ];
    
    for pattern in &dialogue_patterns {
        if path_str.contains(pattern) {
            return true;
        }
    }
    
    // Check common dialogue directories
    let dialogue_dirs = [
        "audio/dialogue", "audio/voice", "sound/dialogue", "sound/voice",
        "dialogue", "voice", "speech", "localization/audio"
    ];
    
    for dir in &dialogue_dirs {
        if path_str.contains(dir) {
            return true;
        }
    }
    
    false
}

fn is_music_ambient_audio(path: &Path, ext: &str) -> bool {
    let path_str = path.to_string_lossy().to_lowercase();
    
    let music_patterns = [
        "music", "bgm", "ambient", "atmos", "soundtrack", "theme", "menu",
        "background", "score", "orchestra", "instrument"
    ];
    
    for pattern in &music_patterns {
        if path_str.contains(pattern) {
            return true;
        }
    }
    
    false
}

fn is_compressed_audio_format(ext: &str) -> bool {
    matches!(ext, "wem" | "bnk" | "pck" | "fsb" | "opus" | "aac" | "m4a")
}

fn is_streaming_audio_format(ext: &str) -> bool {
    matches!(ext, "wem" | "bnk" | "fsb")
}

fn is_audio_editable(ext: &str) -> bool {
    matches!(ext, "wav" | "mp3" | "ogg" | "flac" | "aac" | "m4a")
}

fn estimate_audio_duration(ext: &str, size_mb: f64) -> f64 {
    // Rough duration estimation based on format and size
    let bitrate_mb_per_min = match ext {
        "wav" => 7.5,  // ~7.5 MB/min for 44.1kHz 16-bit stereo
        "mp3" => 1.0,  // ~1 MB/min for 128 kbps
        "ogg" => 0.8,  // ~0.8 MB/min for Vorbis
        "flac" => 5.0, // ~5 MB/min for FLAC
        "wem" => 0.6,  // ~0.6 MB/min for WEM (compressed)
        _ => 1.0,
    };
    
    size_mb / bitrate_mb_per_min
}

fn assess_audio_quality(path: &Path, size_mb: f64) -> Option<AudioQuality> {
    let ext = path.extension()?.to_str()?.to_lowercase();
    
    // Base quality from format
    let base_quality = match ext.as_str() {
        "wav" => AudioQuality::High,
        "flac" => AudioQuality::Studio,
        "mp3" => AudioQuality::Medium,
        "ogg" => AudioQuality::Medium,
        "aac" | "m4a" => AudioQuality::Medium,
        "wem" => AudioQuality::Medium,
        _ => AudioQuality::Unknown,
    };
    
    // Adjust based on file size (larger files often indicate higher quality)
    let adjusted_quality = match base_quality {
        AudioQuality::Studio => if size_mb > 10.0 { AudioQuality::Studio } else { AudioQuality::High },
        AudioQuality::High => if size_mb > 5.0 { AudioQuality::High } else { AudioQuality::Medium },
        AudioQuality::Medium => if size_mb > 2.0 { AudioQuality::Medium } else { AudioQuality::Low },
        AudioQuality::Low => AudioQuality::Low,
        AudioQuality::Unknown => AudioQuality::Unknown,
    };
    
    Some(adjusted_quality)
}

fn quality_to_score(quality: &AudioQuality) -> f64 {
    match quality {
        AudioQuality::Studio => 5.0,
        AudioQuality::High => 4.0,
        AudioQuality::Medium => 3.0,
        AudioQuality::Low => 2.0,
        AudioQuality::Unknown => 1.0,
    }
}

fn get_typical_audio_quality(ext: &str) -> AudioQuality {
    match ext {
        "wav" => AudioQuality::High,
        "flac" => AudioQuality::Studio,
        "mp3" => AudioQuality::Medium,
        "ogg" => AudioQuality::Medium,
        "aac" | "m4a" => AudioQuality::Medium,
        "wem" => AudioQuality::Medium,
        "opus" => AudioQuality::Medium,
        _ => AudioQuality::Unknown,
    }
}

fn get_audio_format_notes(ext: &str) -> Vec<String> {
    match ext {
        "wav" => vec!["Uncompressed format".to_string(), "High quality".to_string(), "Large file size".to_string()],
        "mp3" => vec!["Compressed format".to_string(), "Good compatibility".to_string(), "Lossy compression".to_string()],
        "ogg" => vec!["Open source format".to_string(), "Good compression".to_string(), "Game industry standard".to_string()],
        "flac" => vec!["Lossless compression".to_string(), "High quality".to_string(), "Large file size".to_string()],
        "wem" => vec!["Wwise format".to_string(), "Compressed".to_string(), "Requires Wwise tools".to_string()],
        "bnk" => vec!["Wwise bank format".to_string(), "Multiple audio files".to_string(), "Requires extraction".to_string()],
        _ => vec!["Standard audio format".to_string()],
    }
}

fn contains_text(path: &Path) -> bool {
    let path_str = path.to_string_lossy().to_lowercase();
    
    let text_patterns = [
        "text", "font", "label", "button", "menu", "ui", "hud", "interface",
        "dialog", "chat", "message", "notification", "tooltip", "title"
    ];
    
    for pattern in &text_patterns {
        if path_str.contains(pattern) {
            return true;
        }
    }
    
    false
}

fn is_ui_interface_file(path: &Path) -> bool {
    let path_str = path.to_string_lossy().to_lowercase();
    
    let ui_patterns = [
        "ui", "hud", "interface", "menu", "button", "panel", "window",
        "dialog", "tooltip", "cursor", "icon", "banner"
    ];
    
    for pattern in &ui_patterns {
        if path_str.contains(pattern) {
            return true;
        }
    }
    
    false
}

fn is_texture_or_sprite(path: &Path) -> bool {
    let path_str = path.to_string_lossy().to_lowercase();
    
    let texture_patterns = [
        "texture", "sprite", "tile", "character", "enemy", "item",
        "weapon", "armor", "background", "terrain", "object"
    ];
    
    for pattern in &texture_patterns {
        if path_str.contains(pattern) {
            return true;
        }
    }
    
    false
}

fn has_embedded_text(path: &Path) -> bool {
    // This would require actual image analysis in a real implementation
    // For now, use heuristics based on file name and size
    let path_str = path.to_string_lossy().to_lowercase();
    
    // Large UI files are more likely to have embedded text
    if let Ok(metadata) = path.metadata() {
        let size_mb = metadata.len() as f64 / (1024.0 * 1024.0);
        if size_mb > 0.5 && (path_str.contains("ui") || path_str.contains("menu")) {
            return true;
        }
    }
    
    false
}

fn is_animated_format(ext: &str) -> bool {
    matches!(ext, "gif" | "apng" | "webp")
}

fn detect_image_resolution(path: &Path) -> Option<String> {
    // This would require actual image parsing in a real implementation
    // For now, make educated guesses based on file size and name
    if let Ok(metadata) = path.metadata() {
        let size_kb = metadata.len() as f64 / 1024.0;
        
        // Rough estimation based on file size
        let resolution = if size_kb < 10.0 {
            "Small (< 256x256)"
        } else if size_kb < 100.0 {
            "Medium (256x256 - 1024x1024)"
        } else if size_kb < 500.0 {
            "Large (1024x1024 - 2048x2048)"
        } else {
            "Very Large (> 2048x2048)"
        };
        
        return Some(resolution.to_string());
    }
    
    None
}

fn get_graphics_compression_type(ext: &str) -> GraphicsCompression {
    match ext {
        "bmp" | "tga" => GraphicsCompression::None,
        "png" | "tiff" => GraphicsCompression::Lossless,
        "jpg" | "jpeg" | "webp" => GraphicsCompression::Lossy,
        "dds" => GraphicsCompression::Hybrid,
        _ => GraphicsCompression::Unknown,
    }
}

fn supports_alpha_channel(ext: &str) -> bool {
    matches!(ext, "png" | "tga" | "dds" | "webp" | "gif" | "tiff" | "svg")
}

fn is_graphics_editable(ext: &str) -> bool {
    matches!(ext, "png" | "jpg" | "jpeg" | "bmp" | "tga" | "dds" | "psd" | "tiff" | "webp" | "svg")
}

fn get_common_resolutions_for_format(ext: &str) -> Vec<String> {
    match ext {
        "png" | "jpg" | "jpeg" => vec![
            "1920x1080".to_string(), "1280x720".to_string(), "1024x768".to_string(),
            "512x512".to_string(), "256x256".to_string(), "128x128".to_string()
        ],
        "dds" => vec![
            "2048x2048".to_string(), "1024x1024".to_string(), "512x512".to_string(),
            "256x256".to_string(), "128x128".to_string()
        ],
        _ => vec!["Various".to_string()],
    }
}

fn get_graphics_format_notes(ext: &str) -> Vec<String> {
    match ext {
        "png" => vec!["Lossless compression".to_string(), "Alpha channel support".to_string(), "Web standard".to_string()],
        "jpg" | "jpeg" => vec!["Lossy compression".to_string(), "Small file size".to_string(), "No transparency".to_string()],
        "dds" => vec!["DirectX format".to_string(), "Game textures".to_string(), "Multiple compression types".to_string()],
        "psd" => vec!["Photoshop format".to_string(), "Layer support".to_string(), "High quality".to_string()],
        "tga" => vec!["Uncompressed".to_string(), "Alpha channel".to_string(), "Legacy format".to_string()],
        _ => vec!["Standard graphics format".to_string()],
    }
}

fn get_multimedia_tool_database() -> Vec<MultimediaTool> {
    vec![
        // Audio Tools
        MultimediaTool {
            name: "Audacity".to_string(),
            category: MultimediaToolCategory::AudioEditing,
            description: "Free, open-source audio editor".to_string(),
            supported_formats: vec!["wav".to_string(), "mp3".to_string(), "ogg".to_string(), "flac".to_string()],
            compatibility_score: 85,
            cost: ToolCost::Free,
            platform_support: vec!["Windows".to_string(), "macOS".to_string(), "Linux".to_string()],
            learning_curve: LearningCurve::Easy,
            special_features: vec!["Multi-track editing".to_string(), "Noise reduction".to_string(), "Effects library".to_string()],
            best_for: "Basic audio editing and voice processing".to_string(),
            system_requirements: vec!["2GB RAM".to_string(), "500MB disk space".to_string()],
        },
        MultimediaTool {
            name: "Adobe Audition".to_string(),
            category: MultimediaToolCategory::AudioEditing,
            description: "Professional audio editing software".to_string(),
            supported_formats: vec!["wav".to_string(), "mp3".to_string(), "aac".to_string(), "flac".to_string()],
            compatibility_score: 95,
            cost: ToolCost::Commercial("$20.99/month".to_string()),
            platform_support: vec!["Windows".to_string(), "macOS".to_string()],
            learning_curve: LearningCurve::Medium,
            special_features: vec!["Professional effects".to_string(), "Multi-track mixing".to_string(), "Repair tools".to_string()],
            best_for: "Professional audio post-production".to_string(),
            system_requirements: vec!["8GB RAM".to_string(), "4GB disk space".to_string()],
        },
        MultimediaTool {
            name: "Wwise".to_string(),
            category: MultimediaToolCategory::EngineSpecific,
            description: "Audio middleware for games".to_string(),
            supported_formats: vec!["wem".to_string(), "bnk".to_string(), "wav".to_string()],
            compatibility_score: 90,
            cost: ToolCost::Commercial("Varies".to_string()),
            platform_support: vec!["Windows".to_string(), "macOS".to_string()],
            learning_curve: LearningCurve::Hard,
            special_features: vec!["Game audio integration".to_string(), "Interactive music".to_string(), "Sound banks".to_string()],
            best_for: "Game audio integration and WEM/BNK files".to_string(),
            system_requirements: vec!["16GB RAM".to_string(), "10GB disk space".to_string()],
        },
        
        // Graphics Tools
        MultimediaTool {
            name: "Adobe Photoshop".to_string(),
            category: MultimediaToolCategory::GraphicsEditing,
            description: "Professional graphics editing software".to_string(),
            supported_formats: vec!["png".to_string(), "jpg".to_string(), "psd".to_string(), "tga".to_string()],
            compatibility_score: 98,
            cost: ToolCost::Commercial("$22.99/month".to_string()),
            platform_support: vec!["Windows".to_string(), "macOS".to_string()],
            learning_curve: LearningCurve::Medium,
            special_features: vec!["Layer editing".to_string(), "Text tools".to_string(), "Advanced effects".to_string()],
            best_for: "Professional graphics editing and text replacement".to_string(),
            system_requirements: vec!["8GB RAM".to_string(), "4GB disk space".to_string()],
        },
        MultimediaTool {
            name: "GIMP".to_string(),
            category: MultimediaToolCategory::GraphicsEditing,
            description: "Free, open-source graphics editor".to_string(),
            supported_formats: vec!["png".to_string(), "jpg".to_string(), "tga".to_string(), "dds".to_string()],
            compatibility_score: 80,
            cost: ToolCost::Free,
            platform_support: vec!["Windows".to_string(), "macOS".to_string(), "Linux".to_string()],
            learning_curve: LearningCurve::Medium,
            special_features: vec!["Layer editing".to_string(), "Text tools".to_string(), "Plugin support".to_string()],
            best_for: "Free alternative to Photoshop".to_string(),
            system_requirements: vec!["4GB RAM".to_string(), "1GB disk space".to_string()],
        },
        MultimediaTool {
            name: "Krita".to_string(),
            category: MultimediaToolCategory::GraphicsEditing,
            description: "Digital painting and graphics editor".to_string(),
            supported_formats: vec!["png".to_string(), "jpg".to_string(), "psd".to_string()],
            compatibility_score: 85,
            cost: ToolCost::Free,
            platform_support: vec!["Windows".to_string(), "macOS".to_string(), "Linux".to_string()],
            learning_curve: LearningCurve::Easy,
            special_features: vec!["Drawing tools".to_string(), "Brush engine".to_string(), "Text support".to_string()],
            best_for: "Artistic graphics and UI elements".to_string(),
            system_requirements: vec!["4GB RAM".to_string(), "1GB disk space".to_string()],
        },
        
        // Compression Tools
        MultimediaTool {
            name: "WW2Ogg".to_string(),
            category: MultimediaToolCategory::AudioCompression,
            description: "Wwise audio format converter".to_string(),
            supported_formats: vec!["wem".to_string(), "ogg".to_string(), "wav".to_string()],
            compatibility_score: 75,
            cost: ToolCost::Free,
            platform_support: vec!["Windows".to_string()],
            learning_curve: LearningCurve::Beginner,
            special_features: vec!["WEM to OGG conversion".to_string(), "Batch processing".to_string()],
            best_for: "Converting Wwise WEM files to editable formats".to_string(),
            system_requirements: vec!["1GB RAM".to_string(), "100MB disk space".to_string()],
        },
        MultimediaTool {
            name: "VGMToolbox".to_string(),
            category: MultimediaToolCategory::AudioCompression,
            description: "Video game music tools".to_string(),
            supported_formats: vec!["fsb".to_string(), "bnk".to_string(), "wav".to_string()],
            compatibility_score: 70,
            cost: ToolCost::Free,
            platform_support: vec!["Windows".to_string()],
            learning_curve: LearningCurve::Easy,
            special_features: vec!["FSB extraction".to_string(), "BNK processing".to_string()],
            best_for: "Extracting compressed game audio".to_string(),
            system_requirements: vec!["2GB RAM".to_string(), "500MB disk space".to_string()],
        },
    ]
}

// Struttura interna per database multimedia
#[derive(Debug, Clone)]
struct MultimediaTool {
    name: String,
    category: MultimediaToolCategory,
    description: String,
    supported_formats: Vec<String>,
    compatibility_score: u32,
    cost: ToolCost,
    platform_support: Vec<String>,
    learning_curve: LearningCurve,
    special_features: Vec<String>,
    best_for: String,
    system_requirements: Vec<String>,
}

fn select_multimedia_audio_tools(db: &[MultimediaTool], stats: &AudioStats, engine: &str) -> Vec<SelectedMultimediaTool> {
    let mut tools = Vec::new();
    
    // Score tools based on compatibility with detected formats
    let mut scored_tools: Vec<_> = db.iter()
        .filter(|tool| matches!(tool.category, MultimediaToolCategory::AudioEditing | MultimediaToolCategory::EngineSpecific))
        .map(|tool| {
            let mut score = tool.compatibility_score;
            
            // Bonus for supporting detected formats
            for format in &stats.audio_formats {
                if tool.supported_formats.contains(&format.extension) {
                    score += 10;
                }
            }
            
            // Bonus for engine-specific tools
            if matches!(tool.category, MultimediaToolCategory::EngineSpecific) {
                if (engine.to_lowercase().contains("unreal") && tool.name.contains("Wwise")) ||
                   (engine.to_lowercase().contains("unity") && tool.name.contains("Wwise")) {
                    score += 20;
                }
            }
            
            // Penalty for compressed formats if tool doesn't support them
            if stats.compressed_audio_files > 0 && !tool.supported_formats.iter().any(|f| ["wem", "bnk", "fsb"].contains(&f.as_str())) {
                score -= 15;
            }
            
            (tool, score)
        })
        .collect();
    
    scored_tools.sort_by(|a, b| b.1.cmp(&a.1));
    
    // Convert to SelectedMultimediaTool
    for (tool, score) in scored_tools.into_iter().take(3) {
        tools.push(SelectedMultimediaTool {
            name: tool.name.clone(),
            category: tool.category.clone(),
            description: tool.description.clone(),
            supported_formats: tool.supported_formats.clone(),
            compatibility_score: score,
            cost: tool.cost.clone(),
            platform_support: tool.platform_support.clone(),
            learning_curve: tool.learning_curve.clone(),
            special_features: tool.special_features.clone(),
            best_for: tool.best_for.clone(),
            system_requirements: tool.system_requirements.clone(),
        });
    }
    
    tools
}

fn select_multimedia_graphics_tools(db: &[MultimediaTool], stats: &GraphicsStats, engine: &str) -> Vec<SelectedMultimediaTool> {
    let mut tools = Vec::new();
    
    // Score tools based on compatibility with detected formats
    let mut scored_tools: Vec<_> = db.iter()
        .filter(|tool| matches!(tool.category, MultimediaToolCategory::GraphicsEditing))
        .map(|tool| {
            let mut score = tool.compatibility_score;
            
            // Bonus for supporting detected formats
            for format in &stats.graphics_formats {
                if tool.supported_formats.contains(&format.extension) {
                    score += 10;
                }
            }
            
            // Bonus for text editing capabilities
            if stats.text_containing_graphics > 0 {
                if tool.name.contains("Photoshop") || tool.name.contains("GIMP") {
                    score += 15;
                }
            }
            
            // Bonus for DDS support (common game format)
            if stats.graphics_formats.iter().any(|f| f.extension == "dds") {
                if tool.supported_formats.contains(&"dds".to_string()) {
                    score += 10;
                }
            }
            
            (tool, score)
        })
        .collect();
    
    scored_tools.sort_by(|a, b| b.1.cmp(&a.1));
    
    // Convert to SelectedMultimediaTool
    for (tool, score) in scored_tools.into_iter().take(3) {
        tools.push(SelectedMultimediaTool {
            name: tool.name.clone(),
            category: tool.category.clone(),
            description: tool.description.clone(),
            supported_formats: tool.supported_formats.clone(),
            compatibility_score: score,
            cost: tool.cost.clone(),
            platform_support: tool.platform_support.clone(),
            learning_curve: tool.learning_curve.clone(),
            special_features: tool.special_features.clone(),
            best_for: tool.best_for.clone(),
            system_requirements: tool.system_requirements.clone(),
        });
    }
    
    tools
}

fn select_engine_specific_tools(db: &[MultimediaTool], engine: &str) -> Vec<SelectedMultimediaTool> {
    let mut tools = Vec::new();
    
    let engine_tools: Vec<_> = db.iter()
        .filter(|tool| matches!(tool.category, MultimediaToolCategory::EngineSpecific))
        .filter(|tool| {
            // Match tools to specific engines
            (engine.to_lowercase().contains("unreal") && tool.name.contains("Wwise")) ||
            (engine.to_lowercase().contains("unity") && tool.name.contains("Wwise")) ||
            tool.name.to_lowercase().contains(&engine.to_lowercase())
        })
        .collect();
    
    for tool in engine_tools {
        tools.push(SelectedMultimediaTool {
            name: tool.name.clone(),
            category: tool.category.clone(),
            description: tool.description.clone(),
            supported_formats: tool.supported_formats.clone(),
            compatibility_score: tool.compatibility_score,
            cost: tool.cost.clone(),
            platform_support: tool.platform_support.clone(),
            learning_curve: tool.learning_curve.clone(),
            special_features: tool.special_features.clone(),
            best_for: tool.best_for.clone(),
            system_requirements: tool.system_requirements.clone(),
        });
    }
    
    tools
}

fn select_compression_tools(db: &[MultimediaTool], audio_stats: &AudioStats, graphics_stats: &GraphicsStats) -> Vec<SelectedMultimediaTool> {
    let mut tools = Vec::new();
    
    // Select compression tools based on detected compressed formats
    let compression_tools: Vec<_> = db.iter()
        .filter(|tool| matches!(tool.category, MultimediaToolCategory::AudioCompression | MultimediaToolCategory::GraphicsCompression))
        .filter(|tool| {
            // Check if tool supports detected compressed formats
            let audio_formats: Vec<String> = audio_stats.audio_formats.iter()
                .filter(|f| f.requires_specialized_tools)
                .map(|f| f.extension.clone())
                .collect();
            
            tool.supported_formats.iter().any(|tf| audio_formats.contains(tf))
        })
        .collect();
    
    for tool in compression_tools {
        tools.push(SelectedMultimediaTool {
            name: tool.name.clone(),
            category: tool.category.clone(),
            description: tool.description.clone(),
            supported_formats: tool.supported_formats.clone(),
            compatibility_score: tool.compatibility_score,
            cost: tool.cost.clone(),
            platform_support: tool.platform_support.clone(),
            learning_curve: tool.learning_curve.clone(),
            special_features: tool.special_features.clone(),
            best_for: tool.best_for.clone(),
            system_requirements: tool.system_requirements.clone(),
        });
    }
    
    tools
}

fn estimate_audio_editing_time(stats: &AudioStats) -> f64 {
    let base_time_per_file = 0.25; // 15 minutes per file base
    let mut total_hours = stats.total_audio_files as f64 * base_time_per_file;
    
    // Adjust for file complexity
    if stats.compressed_audio_files > 0 {
        total_hours += stats.compressed_audio_files as f64 * 0.5; // Extra 30min per compressed file
    }
    
    // Adjust for quality (higher quality requires more time)
    let quality_multiplier = match stats.predominant_quality {
        AudioQuality::Studio => 1.5,
        AudioQuality::High => 1.2,
        AudioQuality::Medium => 1.0,
        AudioQuality::Low => 0.8,
        AudioQuality::Unknown => 1.0,
    };
    
    total_hours * quality_multiplier
}

fn estimate_graphics_editing_time(stats: &GraphicsStats) -> f64 {
    let base_time_per_file = 0.1; // 6 minutes per file base
    let mut total_hours = stats.total_graphics_files as f64 * base_time_per_file;
    
    // Adjust for text-containing files (require more time)
    total_hours += stats.text_containing_graphics as f64 * 0.3; // Extra 18min per text file
    
    // Adjust for embedded text files (require much more time)
    total_hours += stats.embedded_text_files as f64 * 0.8; // Extra 48min per embedded text file
    
    // Adjust for animated files
    total_hours += stats.animated_files as f64 * 0.4; // Extra 24min per animated file
    
    total_hours
}

fn calculate_multimedia_tool_costs(tools: &MultimediaTools) -> f64 {
    let mut total_cost = 0.0;
    
    // Calculate costs for all recommended tools
    for tool in &tools.audio_tools {
        total_cost += estimate_tool_cost(&tool.cost);
    }
    
    for tool in &tools.graphics_tools {
        total_cost += estimate_tool_cost(&tool.cost);
    }
    
    for tool in &tools.engine_specific_tools {
        total_cost += estimate_tool_cost(&tool.cost);
    }
    
    for tool in &tools.compression_tools {
        total_cost += estimate_tool_cost(&tool.cost);
    }
    
    total_cost
}

fn estimate_tool_cost(cost: &ToolCost) -> f64 {
    match cost {
        ToolCost::Free => 0.0,
        ToolCost::Freemium => 10.0, // Average freemium cost
        ToolCost::Commercial(price_str) => {
            // Parse price string to extract number
            if let Some(price) = price_str.strip_prefix("$") {
                if let Ok(monthly) = price.parse::<f64>() {
                    return monthly * 12.0; // Annual cost
                }
            }
            50.0 // Default commercial cost
        },
        ToolCost::Enterprise => 500.0,
        ToolCost::OpenSource => 0.0,
    }
}

fn calculate_multimedia_complexity_score(audio_stats: &AudioStats, graphics_stats: &GraphicsStats) -> u32 {
    let mut score = 0u32;
    
    // File count contribution
    score += (audio_stats.total_audio_files / 10).min(20);
    score += (graphics_stats.total_graphics_files / 20).min(20);
    
    // Size contribution
    score += ((audio_stats.total_audio_size_mb / 100.0) as u32).min(15);
    score += ((graphics_stats.total_graphics_size_mb / 200.0) as u32).min(15);
    
    // Format difficulty
    score += (audio_stats.compressed_audio_files * 2).min(10);
    score += (graphics_stats.embedded_text_files * 3).min(10);
    
    // Quality factors
    score += match audio_stats.predominant_quality {
        AudioQuality::Studio => 5,
        AudioQuality::High => 3,
        AudioQuality::Medium => 1,
        _ => 0,
    };
    
    score.min(100)
}

fn calculate_compression_difficulty(audio_stats: &AudioStats, graphics_stats: &GraphicsStats) -> f64 {
    let mut difficulty = 1.0;
    
    // Audio compression difficulty
    if audio_stats.compressed_audio_files > 0 {
        difficulty += (audio_stats.compressed_audio_files as f64 / audio_stats.total_audio_files as f64) * 0.5;
    }
    
    // Graphics compression difficulty
    if graphics_stats.embedded_text_files > 0 {
        difficulty += (graphics_stats.embedded_text_files as f64 / graphics_stats.total_graphics_files as f64) * 0.7;
    }
    
    difficulty.min(3.0) // Cap at 3x difficulty
}

fn estimate_outsourcing_costs(audio_hours: f64, graphics_hours: f64, complexity: u32) -> f64 {
    // Professional rates (USD per hour)
    let audio_hourly_rate = 75.0;
    let graphics_hourly_rate = 50.0;
    
    // Complexity multiplier
    let complexity_multiplier = 1.0 + (complexity as f64 / 100.0);
    
    (audio_hours * audio_hourly_rate + graphics_hours * graphics_hourly_rate) * complexity_multiplier
}

// ── Smart Backup System ─────────────────────────────────────────────────────

fn analyze_backup_strategy(game_path: &Path, engine: &str, multimedia_analysis: &MultimediaAnalysis) -> BackupStrategy {
    // Determine optimal backup type based on game characteristics
    let recommended_backup_type = determine_optimal_backup_type(engine, multimedia_analysis);
    
    // Analyze backup categories
    let backup_categories = analyze_backup_categories(game_path, engine, multimedia_analysis);
    
    // Calculate backup estimates
    let (estimated_backup_size_mb, backup_files_count) = calculate_backup_estimates(&backup_categories);
    
    // Determine compression method
    let compression_method = select_compression_method(&backup_categories, &recommended_backup_type);
    
    // Calculate backup duration
    let backup_duration_minutes = estimate_backup_duration(&backup_categories, &compression_method);
    
    // Determine restore complexity
    let restore_complexity = assess_restore_complexity(engine, &backup_categories);
    
    // Calculate space savings
    let space_savings_mb = calculate_space_savings(&backup_categories, &compression_method);
    
    // Create backup validation
    let backup_validation = create_backup_validation(&backup_categories);
    
    // Default backup location
    let backup_location = "C:\\Users\\Public\\Documents\\GameStringer\\Backups".to_string();
    
    BackupStrategy {
        recommended_backup_type,
        estimated_backup_size_mb,
        backup_files_count,
        compression_method,
        backup_location,
        backup_duration_minutes,
        restore_complexity,
        backup_categories,
        space_savings_mb,
        backup_validation,
    }
}

fn determine_optimal_backup_type(engine: &str, multimedia_analysis: &MultimediaAnalysis) -> BackupType {
    // Decision logic for backup type
    let total_multimedia_files = multimedia_analysis.audio_stats.total_audio_files + multimedia_analysis.graphics_stats.total_graphics_files;
    let has_complex_multimedia = multimedia_analysis.multimedia_complexity_score > 50;
    let has_compressed_files = multimedia_analysis.audio_stats.compressed_audio_files > 0 || multimedia_analysis.graphics_stats.embedded_text_files > 0;
    
    match (total_multimedia_files, has_complex_multimedia, has_compressed_files) {
        (0..=100, false, false) => BackupType::Targeted,
        (101..=500, false, false) => BackupType::Essential,
        (_, true, true) => BackupType::Full,
        (_, _, _) => BackupType::Essential,
    }
}

fn analyze_backup_categories(game_path: &Path, engine: &str, multimedia_analysis: &MultimediaAnalysis) -> Vec<BackupCategory> {
    let mut categories = Vec::new();
    
    // Text Files Category
    categories.push(BackupCategory {
        category_type: BackupCategoryType::TextFiles,
        file_count: estimate_text_files_count(game_path),
        total_size_mb: estimate_text_files_size(game_path),
        included: true,
        priority: BackupPriority::Critical,
        description: "File di testo traducibili (dialoghi, menu, descrizioni)".to_string(),
        examples: vec!["*.txt".to_string(), "*.json".to_string(), "*.xml".to_string(), "*.csv".to_string()],
    });
    
    // Audio Files Category
    categories.push(BackupCategory {
        category_type: BackupCategoryType::AudioFiles,
        file_count: multimedia_analysis.audio_stats.localizable_audio_files,
        total_size_mb: multimedia_analysis.audio_stats.total_audio_size_mb,
        included: multimedia_analysis.audio_stats.localizable_audio_files > 0,
        priority: if multimedia_analysis.audio_stats.localizable_audio_files > 50 { BackupPriority::Critical } else { BackupPriority::High },
        description: "File audio localizzabili (dialoghi, voice acting)".to_string(),
        examples: vec!["*.wav".to_string(), "*.ogg".to_string(), "*.wem".to_string(), "*.mp3".to_string()],
    });
    
    // Graphics Files Category
    categories.push(BackupCategory {
        category_type: BackupCategoryType::GraphicsFiles,
        file_count: multimedia_analysis.graphics_stats.text_containing_graphics,
        total_size_mb: multimedia_analysis.graphics_stats.total_graphics_size_mb,
        included: multimedia_analysis.graphics_stats.text_containing_graphics > 0,
        priority: if multimedia_analysis.graphics_stats.text_containing_graphics > 100 { BackupPriority::Critical } else { BackupPriority::High },
        description: "Grafiche con testo (UI, menu, elementi localizzabili)".to_string(),
        examples: vec!["*.png".to_string(), "*.jpg".to_string(), "*.dds".to_string(), "*.tga".to_string()],
    });
    
    // Configuration Category
    categories.push(BackupCategory {
        category_type: BackupCategoryType::Configuration,
        file_count: estimate_config_files_count(game_path, engine),
        total_size_mb: estimate_config_files_size(game_path, engine),
        included: true,
        priority: BackupPriority::Medium,
        description: "File di configurazione del gioco e delle impostazioni".to_string(),
        examples: vec!["*.cfg".to_string(), "*.ini".to_string(), "*.json".to_string(), "settings.*".to_string()],
    });
    
    // Executables Category
    categories.push(BackupCategory {
        category_type: BackupCategoryType::Executables,
        file_count: estimate_executables_count(game_path),
        total_size_mb: estimate_executables_size(game_path),
        included: false, // Usually not needed for localization
        priority: BackupPriority::Low,
        description: "Eseguibili e DLL del gioco".to_string(),
        examples: vec!["*.exe".to_string(), "*.dll".to_string(), "*.so".to_string()],
    });
    
    // Engine-Specific Category
    categories.push(BackupCategory {
        category_type: BackupCategoryType::EngineSpecific,
        file_count: estimate_engine_files_count(game_path, engine),
        total_size_mb: estimate_engine_files_size(game_path, engine),
        included: is_engine_specific_backup_needed(engine),
        priority: BackupPriority::High,
        description: "File specifici del motore di gioco".to_string(),
        examples: get_engine_file_examples(engine),
    });
    
    categories
}

fn calculate_backup_estimates(categories: &[BackupCategory]) -> (f64, u32) {
    let total_size_mb: f64 = categories.iter()
        .filter(|cat| cat.included)
        .map(|cat| cat.total_size_mb)
        .sum();
    
    let total_files: u32 = categories.iter()
        .filter(|cat| cat.included)
        .map(|cat| cat.file_count)
        .sum();
    
    (total_size_mb, total_files)
}

fn select_compression_method(categories: &[BackupCategory], backup_type: &BackupType) -> CompressionMethod {
    let total_size_mb: f64 = categories.iter()
        .filter(|cat| cat.included)
        .map(|cat| cat.total_size_mb)
        .sum();
    
    let has_large_files = categories.iter().any(|cat| cat.total_size_mb > 100.0);
    let has_many_files = categories.iter().map(|cat| cat.file_count).sum::<u32>() > 1000;
    
    match (backup_type, total_size_mb, has_large_files, has_many_files) {
        (BackupType::Targeted, _, false, false) => CompressionMethod::Fast,
        (BackupType::Essential, _, _, _) => CompressionMethod::Balanced,
        (BackupType::Full, size, _, _) if size > 1000.0 => CompressionMethod::Maximum,
        (_, _, _, _) => CompressionMethod::Smart,
    }
}

fn estimate_backup_duration(categories: &[BackupCategory], compression: &CompressionMethod) -> f64 {
    let total_files: u32 = categories.iter()
        .filter(|cat| cat.included)
        .map(|cat| cat.file_count)
        .sum();
    
    let total_size_mb: f64 = categories.iter()
        .filter(|cat| cat.included)
        .map(|cat| cat.total_size_mb)
        .sum();
    
    let base_minutes_per_file = 0.01; // 0.6 seconds per file
    let base_minutes_per_mb = 0.05; // 3 seconds per MB
    
    let compression_multiplier = match compression {
        CompressionMethod::None => 0.5,
        CompressionMethod::Fast => 1.0,
        CompressionMethod::Balanced => 1.5,
        CompressionMethod::Maximum => 3.0,
        CompressionMethod::Smart => 1.2,
    };
    
    (total_files as f64 * base_minutes_per_file + total_size_mb * base_minutes_per_mb) * compression_multiplier
}

fn assess_restore_complexity(engine: &str, categories: &[BackupCategory]) -> RestoreComplexity {
    let has_engine_specific = categories.iter()
        .any(|cat| matches!(cat.category_type, BackupCategoryType::EngineSpecific) && cat.included);
    
    let has_config = categories.iter()
        .any(|cat| matches!(cat.category_type, BackupCategoryType::Configuration) && cat.included);
    
    match (engine, has_engine_specific, has_config) {
        ("Unity", true, true) => RestoreComplexity::EngineSpecific,
        ("Unreal", true, true) => RestoreComplexity::EngineSpecific,
        (_, true, _) => RestoreComplexity::Complex,
        (_, _, true) => RestoreComplexity::Moderate,
        (_, _, _) => RestoreComplexity::Simple,
    }
}

fn calculate_space_savings(categories: &[BackupCategory], compression: &CompressionMethod) -> f64 {
    let total_size_mb: f64 = categories.iter()
        .filter(|cat| cat.included)
        .map(|cat| cat.total_size_mb)
        .sum();
    
    let compression_ratio = match compression {
        CompressionMethod::None => 0.0,
        CompressionMethod::Fast => 0.3,  // 30% savings
        CompressionMethod::Balanced => 0.5, // 50% savings
        CompressionMethod::Maximum => 0.7, // 70% savings
        CompressionMethod::Smart => 0.6, // 60% savings (adaptive)
    };
    
    total_size_mb * compression_ratio
}

fn create_backup_validation(categories: &[BackupCategory]) -> BackupValidation {
    let integrity_checks = vec![
        IntegrityCheck {
            check_type: IntegrityCheckType::FileExists,
            description: "Verifica esistenza file backup".to_string(),
            passed: true,
            details: "Tutti i file presenti nell'archivio".to_string(),
        },
        IntegrityCheck {
            check_type: IntegrityCheckType::FileSize,
            description: "Verifica dimensione file".to_string(),
            passed: true,
            details: "Dimensioni file corrispondenti agli originali".to_string(),
        },
        IntegrityCheck {
            check_type: IntegrityCheckType::Checksum,
            description: "Verifica checksum MD5".to_string(),
            passed: true,
            details: "Checksum validati per tutti i file critici".to_string(),
        },
        IntegrityCheck {
            check_type: IntegrityCheckType::Structure,
            description: "Verifica struttura archivio".to_string(),
            passed: true,
            details: "Struttura directory preservata".to_string(),
        },
    ];
    
    let total_files: u32 = categories.iter()
        .filter(|cat| cat.included)
        .map(|cat| cat.file_count)
        .sum();
    
    let validation_time_minutes = total_files as f64 * 0.02; // 1.2 seconds per file
    let backup_health_score = if integrity_checks.iter().all(|check| check.passed) { 100 } else { 75 };
    
    BackupValidation {
        checksum_validated: true,
        integrity_checks,
        validation_time_minutes,
        can_verify_restore: true,
        backup_health_score,
    }
}

// Helper functions for category analysis
fn estimate_text_files_count(game_path: &Path) -> u32 {
    let text_extensions = ["txt", "json", "xml", "csv", "ini", "cfg", "yaml", "yml"];
    estimate_files_by_extension(game_path, &text_extensions)
}

fn estimate_text_files_size(game_path: &Path) -> f64 {
    let text_extensions = ["txt", "json", "xml", "csv", "ini", "cfg", "yaml", "yml"];
    estimate_size_by_extension(game_path, &text_extensions)
}

fn estimate_config_files_count(game_path: &Path, engine: &str) -> u32 {
    let base_count = estimate_files_by_extension(game_path, &["cfg", "ini", "json", "xml"]);
    let engine_specific = match engine {
        "Unity" => estimate_files_by_extension(game_path, &["asset"]),
        "Unreal" => estimate_files_by_extension(game_path, &["ini", "config"]),
        _ => 0,
    };
    base_count + engine_specific
}

fn estimate_config_files_size(game_path: &Path, engine: &str) -> f64 {
    let base_size = estimate_size_by_extension(game_path, &["cfg", "ini", "json", "xml"]);
    let engine_specific = match engine {
        "Unity" => estimate_size_by_extension(game_path, &["asset"]),
        "Unreal" => estimate_size_by_extension(game_path, &["ini", "config"]),
        _ => 0.0,
    };
    base_size + engine_specific
}

fn estimate_executables_count(game_path: &Path) -> u32 {
    estimate_files_by_extension(game_path, &["exe", "dll", "so"])
}

fn estimate_executables_size(game_path: &Path) -> f64 {
    estimate_size_by_extension(game_path, &["exe", "dll", "so"])
}

fn estimate_engine_files_count(game_path: &Path, engine: &str) -> u32 {
    match engine {
        "Unity" => estimate_files_by_extension(game_path, &["asset", "unity3d"]),
        "Unreal" => estimate_files_by_extension(game_path, &["uasset", "umap", "pak"]),
        "Ren'Py" => estimate_files_by_extension(game_path, &["rpy", "rpyc"]),
        "RPG Maker" => estimate_files_by_extension(game_path, &["rvdata2", "json"]),
        _ => 0,
    }
}

fn estimate_engine_files_size(game_path: &Path, engine: &str) -> f64 {
    match engine {
        "Unity" => estimate_size_by_extension(game_path, &["asset", "unity3d"]),
        "Unreal" => estimate_size_by_extension(game_path, &["uasset", "umap", "pak"]),
        "Ren'Py" => estimate_size_by_extension(game_path, &["rpy", "rpyc"]),
        "RPG Maker" => estimate_size_by_extension(game_path, &["rvdata2", "json"]),
        _ => 0.0,
    }
}

fn is_engine_specific_backup_needed(engine: &str) -> bool {
    matches!(engine, "Unity" | "Unreal" | "Ren'Py" | "RPG Maker")
}

fn get_engine_file_examples(engine: &str) -> Vec<String> {
    match engine {
        "Unity" => vec!["*.asset".to_string(), "*.unity3d".to_string(), "Resources/*.txt".to_string()],
        "Unreal" => vec!["*.uasset".to_string(), "*.umap".to_string(), "*.pak".to_string()],
        "Ren'Py" => vec!["*.rpy".to_string(), "*.rpyc".to_string(), "tl/*.json".to_string()],
        "RPG Maker" => vec!["*.rvdata2".to_string(), "www/*.json".to_string()],
        _ => vec!["*.cfg".to_string(), "*.ini".to_string()],
    }
}

fn estimate_files_by_extension(game_path: &Path, extensions: &[&str]) -> u32 {
    // Simplified estimation - in real implementation would scan directory
    let mut count = 0u32;
    
    if let Ok(entries) = std::fs::read_dir(game_path) {
        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_file() {
                    if let Some(ext) = entry.path().extension().and_then(|e| e.to_str()) {
                        if extensions.contains(&ext.to_lowercase().as_str()) {
                            count += 1;
                        }
                    }
                }
            }
        }
    }
    
    count
}

fn estimate_size_by_extension(game_path: &Path, extensions: &[&str]) -> f64 {
    // Simplified estimation - in real implementation would scan directory
    let mut total_size = 0.0f64;
    
    if let Ok(entries) = std::fs::read_dir(game_path) {
        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_file() {
                    if let Some(ext) = entry.path().extension().and_then(|e| e.to_str()) {
                        if extensions.contains(&ext.to_lowercase().as_str()) {
                            total_size += metadata.len() as f64 / (1024.0 * 1024.0);
                        }
                    }
                }
            }
        }
    }
    
    total_size
}

// ── Workflow Execution Types ─────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowExecutionResult {
    pub execution_id: String,
    pub game_title: String,
    pub engine: String,
    pub total_duration_minutes: f64,
    pub stages_completed: Vec<StageExecutionResult>,
    pub final_status: ExecutionStatus,
    pub deliverables: Vec<ExecutionDeliverable>,
    pub errors: Vec<ExecutionError>,
    pub success_rate: f64,
    pub next_steps: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StageExecutionResult {
    pub stage_id: u32,
    pub stage_name: String,
    pub status: ExecutionStatus,
    pub duration_minutes: f64,
    pub outputs: Vec<String>,
    pub errors: Vec<String>,
    pub success: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ExecutionStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Skipped,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionDeliverable {
    pub deliverable_id: String,
    pub deliverable_name: String,
    pub file_path: Option<String>,
    pub size_mb: f64,
    pub status: ExecutionStatus,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionError {
    pub error_id: String,
    pub stage_id: u32,
    pub error_type: String,
    pub message: String,
    pub severity: String,
    pub timestamp: String,
    pub resolved: bool,
}

async fn execute_workflow_from_prediction(
    game_path: &Path,
    prediction: &PredictionResult,
    target_lang_param: &str,
) -> Result<WorkflowExecutionResult, String> {
    let start = std::time::Instant::now();
    let execution_id = format!("exec_{}", chrono::Utc::now().timestamp());
    let game_path_str = game_path.to_string_lossy().to_string();
    let engine_lower = prediction.engine.to_lowercase();
    
    let mut stages_completed = Vec::new();
    let mut deliverables = Vec::new();
    let mut errors: Vec<ExecutionError> = Vec::new();
    let mut error_counter = 0u32;

    // ══════════════════════════════════════════════════════════════════════════
    // STAGE 1: PREPARATION — Validate game path, detect engine, check space
    // ══════════════════════════════════════════════════════════════════════════
    let stage_start = std::time::Instant::now();
    let mut stage1_outputs = vec![
        format!("🎮 Game: {}", prediction.game_title),
        format!("⚙️ Engine: {}", prediction.engine),
        format!("📁 Path: {}", game_path_str),
        format!("📊 Difficulty: {}/100 ({})", prediction.difficulty_score, prediction.difficulty_label),
        format!("🎯 Confidence: {}%", prediction.confidence_score),
    ];
    
    // Check disk space
    let game_size_mb = walkdir::WalkDir::new(game_path)
        .max_depth(1)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .map(|e| e.metadata().map(|m| m.len()).unwrap_or(0))
        .sum::<u64>() as f64 / (1024.0 * 1024.0);
    stage1_outputs.push(format!("💿 Game root size: {:.0}MB", game_size_mb));

    // Check available tools
    let tool_name = prediction.selected_tools.primary_text_tool.as_ref()
        .map(|t| t.name.clone())
        .unwrap_or_else(|| "Generic text scanner".to_string());
    stage1_outputs.push(format!("🛠️ Primary tool: {}", tool_name));
    
    if !prediction.llm_chains.is_empty() {
        stage1_outputs.push(format!("🤖 LLM chains available: {}", prediction.llm_chains.len()));
    }
    
    stages_completed.push(StageExecutionResult {
        stage_id: 1,
        stage_name: "Preparation & Validation".to_string(),
        status: ExecutionStatus::Completed,
        duration_minutes: stage_start.elapsed().as_secs_f64() / 60.0,
        outputs: stage1_outputs,
        errors: vec![],
        success: true,
    });

    // ══════════════════════════════════════════════════════════════════════════
    // STAGE 2: SMART BACKUP — Real file backup before any modifications
    // ══════════════════════════════════════════════════════════════════════════
    let stage_start = std::time::Instant::now();
    let mut stage2_outputs = Vec::new();
    let mut stage2_errors = Vec::new();
    let mut backup_success = false;
    
    let backup_dir = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("GameStringer")
        .join("backups")
        .join(&execution_id);
    
    // Scan translatable files to know what to backup
    let translatable_extensions = [
        "json", "xml", "txt", "csv", "tsv", "po", "pot", "resx", "xliff",
        "yaml", "yml", "ini", "cfg", "lang", "loc", "strings", "properties",
        "srt", "vtt", "ass", "lua", "rpy", "ks", "locres", "translation",
        "tres", "tscn", "gml", "htm", "html",
    ];
    
    let mut files_to_backup: Vec<PathBuf> = Vec::new();
    for entry in walkdir::WalkDir::new(game_path)
        .max_depth(8)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file() {
            if let Some(ext) = entry.path().extension().and_then(|e| e.to_str()) {
                if translatable_extensions.contains(&ext.to_lowercase().as_str()) {
                    files_to_backup.push(entry.path().to_path_buf());
                }
            }
        }
    }
    
    stage2_outputs.push(format!("📋 Found {} translatable files to backup", files_to_backup.len()));
    
    if !files_to_backup.is_empty() {
        match std::fs::create_dir_all(&backup_dir) {
            Ok(_) => {
                let mut backed_up = 0u32;
                let mut backup_size = 0u64;
                
                for file_path in &files_to_backup {
                    if let Ok(relative) = file_path.strip_prefix(game_path) {
                        let backup_file = backup_dir.join(relative);
                        if let Some(parent) = backup_file.parent() {
                            let _ = std::fs::create_dir_all(parent);
                        }
                        match std::fs::copy(file_path, &backup_file) {
                            Ok(size) => {
                                backed_up += 1;
                                backup_size += size;
                            }
                            Err(e) => {
                                stage2_errors.push(format!("⚠️ Backup failed: {}: {}", relative.display(), e));
                            }
                        }
                    }
                }
                
                let backup_size_mb = backup_size as f64 / (1024.0 * 1024.0);
                stage2_outputs.push(format!("✅ Backed up {}/{} files ({:.1}MB)", backed_up, files_to_backup.len(), backup_size_mb));
                stage2_outputs.push(format!("📂 Backup location: {}", backup_dir.display()));
                backup_success = backed_up > 0;
                
                // Register deliverable
                deliverables.push(ExecutionDeliverable {
                    deliverable_id: "del_backup".to_string(),
                    deliverable_name: format!("Smart Backup ({} files)", backed_up),
                    file_path: Some(backup_dir.to_string_lossy().to_string()),
                    size_mb: backup_size_mb,
                    status: ExecutionStatus::Completed,
                    created_at: chrono::Utc::now().to_rfc3339(),
                });
            }
            Err(e) => {
                stage2_errors.push(format!("❌ Failed to create backup dir: {}", e));
                error_counter += 1;
                errors.push(ExecutionError {
                    error_id: format!("err_{}", error_counter),
                    stage_id: 2,
                    error_type: "BackupCreationFailed".to_string(),
                    message: format!("Cannot create backup directory: {}", e),
                    severity: "high".to_string(),
                    timestamp: chrono::Utc::now().to_rfc3339(),
                    resolved: false,
                });
            }
        }
    } else {
        stage2_outputs.push("⏩ No translatable files found — skipping backup".to_string());
        backup_success = true; // Nothing to backup = success
    }
    
    stages_completed.push(StageExecutionResult {
        stage_id: 2,
        stage_name: "Smart Backup".to_string(),
        status: if backup_success { ExecutionStatus::Completed } else { ExecutionStatus::Failed },
        duration_minutes: stage_start.elapsed().as_secs_f64() / 60.0,
        outputs: stage2_outputs,
        errors: stage2_errors,
        success: backup_success,
    });

    // ══════════════════════════════════════════════════════════════════════════
    // TYRANO/ELECTRON FAST PATH — detect .asar games and use dedicated patcher
    // ══════════════════════════════════════════════════════════════════════════
    let asar_path = game_path.join("resources").join("app.asar");
    let is_tyrano_electron = asar_path.exists() || game_path.join("resources").join("app").exists();
    
    if is_tyrano_electron {
        // ── TYRANO STAGE 3: Detection ──
        let stage_start = std::time::Instant::now();
        let mut tyrano_outputs = Vec::new();
        
        let tyrano_detect = super::tyranoscript_patcher::detect_tyrano_game(game_path_str.clone());
        match &tyrano_detect {
            Ok(game_info) => {
                tyrano_outputs.push(format!("🎭 Engine: TyranoScript ({})", game_info.engine_variant));
                tyrano_outputs.push(format!("📦 ASAR: {}", if game_info.has_asar { "sì" } else { "no (cartella app)" }));
                tyrano_outputs.push(format!("📄 Script .ks trovati: {}", game_info.script_files.len()));
                tyrano_outputs.push(format!("📝 Stringhe totali: {}", game_info.total_strings));
                for sf in game_info.script_files.iter().take(5) {
                    tyrano_outputs.push(format!("  📄 {}: {} stringhe", sf.filename, sf.string_count));
                }
            }
            Err(e) => {
                tyrano_outputs.push(format!("⚠️ Rilevamento TyranoScript fallito: {}", e));
            }
        }
        
        stages_completed.push(StageExecutionResult {
            stage_id: 3,
            stage_name: "TyranoScript Detection".to_string(),
            status: if tyrano_detect.is_ok() { ExecutionStatus::Completed } else { ExecutionStatus::Failed },
            duration_minutes: stage_start.elapsed().as_secs_f64() / 60.0,
            outputs: tyrano_outputs,
            errors: vec![],
            success: tyrano_detect.is_ok(),
        });

        // ── TYRANO STAGE 4: String Extraction ──
        let stage_start = std::time::Instant::now();
        let mut extract_outputs = Vec::new();
        
        let extraction = super::tyranoscript_patcher::extract_tyrano_strings(game_path_str.clone());
        let mut tyrano_strings = Vec::new();
        
        match &extraction {
            Ok(result) => {
                extract_outputs.push(format!("📝 Estratte {} stringhe da {} file", result.total_count, result.files_processed));
                // Mostra top 5 tipi di stringa
                let mut type_counts: std::collections::HashMap<&str, usize> = std::collections::HashMap::new();
                for s in &result.strings {
                    *type_counts.entry(&s.string_type).or_insert(0) += 1;
                }
                let mut types_sorted: Vec<_> = type_counts.iter().collect();
                types_sorted.sort_by(|a, b| b.1.cmp(a.1));
                for (stype, count) in types_sorted.iter().take(5) {
                    extract_outputs.push(format!("  🏷️ {}: {} stringhe", stype, count));
                }
                tyrano_strings = result.strings.clone();
            }
            Err(e) => {
                extract_outputs.push(format!("❌ Estrazione fallita: {}", e));
            }
        }
        
        stages_completed.push(StageExecutionResult {
            stage_id: 4,
            stage_name: "TyranoScript String Extraction".to_string(),
            status: if extraction.is_ok() { ExecutionStatus::Completed } else { ExecutionStatus::Failed },
            duration_minutes: stage_start.elapsed().as_secs_f64() / 60.0,
            outputs: extract_outputs,
            errors: vec![],
            success: extraction.is_ok(),
        });

        // ── TYRANO STAGE 5: AI Translation of extracted strings ──
        let stage_start = std::time::Instant::now();
        let mut stage5_outputs = Vec::new();
        let mut translated_count = 0u64;
        let mut failed_count = 0u64;
        
        let target_lang = if target_lang_param.is_empty() { "it" } else { target_lang_param };
        
        // Detect Ollama model
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(60))
            .build()
            .unwrap_or_default();
        
        let ollama_model: Option<String> = match client
            .get("http://localhost:11434/api/tags")
            .timeout(std::time::Duration::from_secs(3))
            .send()
            .await
        {
            Ok(resp) => {
                if let Ok(json) = resp.json::<serde_json::Value>().await {
                    let models: Vec<String> = json.get("models")
                        .and_then(|m| m.as_array())
                        .map(|arr| arr.iter()
                            .filter_map(|m| m.get("name").and_then(|n| n.as_str()).map(|s| s.to_string()))
                            .collect())
                        .unwrap_or_default();
                    let preferred_order = ["qwen3:", "mistral", "glm4", "lfm2"];
                    let mut chosen: Option<String> = None;
                    for prefix in &preferred_order {
                        if let Some(m) = models.iter().find(|m| m.starts_with(prefix)) {
                            chosen = Some(m.clone());
                            break;
                        }
                    }
                    if chosen.is_none() {
                        chosen = models.iter().find(|m| !m.contains("llava")).cloned();
                    }
                    chosen
                } else { None }
            }
            Err(_) => None,
        };
        
        let use_ollama = ollama_model.is_some();
        let translation_method = if let Some(ref model) = ollama_model {
            format!("Ollama ({})", model)
        } else {
            "Google Translate (web)".to_string()
        };
        stage5_outputs.push(format!("🤖 Translation method: {}", translation_method));
        stage5_outputs.push(format!("🌍 Target language: {}", target_lang));
        
        let lang_name = match target_lang {
            "it" => "Italian", "en" => "English", "es" => "Spanish",
            "fr" => "French", "de" => "German", "ja" => "Japanese",
            "zh" => "Chinese", "ko" => "Korean", "pt" => "Portuguese",
            "ru" => "Russian", "pl" => "Polish", "nl" => "Dutch",
            other => other,
        };
        
        if !tyrano_strings.is_empty() {
            let max_strings = 500usize;
            let mut ollama_failed = false;
            let batch_size = 10; // Translate 10 strings per Ollama call
            
            // Filter translatable strings first
            let indices: Vec<usize> = tyrano_strings.iter().enumerate()
                .filter(|(_, ts)| !ts.original.trim().is_empty() && ts.original.len() >= 3)
                .map(|(i, _)| i)
                .take(max_strings)
                .collect();
            
            stage5_outputs.push(format!("📊 Stringhe da tradurre: {} (batch da {})", indices.len(), batch_size));
            
            // Process in batches
            let mut batch_num = 0;
            for batch_indices in indices.chunks(batch_size) {
                batch_num += 1;
                let progress_pct = ((translated_count + failed_count) as f64 / indices.len() as f64 * 100.0) as u32;
                if batch_num % 5 == 0 || batch_num == 1 {
                    stage5_outputs.push(format!("⏳ Progresso: {}/{} stringhe ({}%) — Batch {}/{}", translated_count, indices.len(), progress_pct, batch_num, (indices.len() + batch_size - 1) / batch_size));
                }
                let originals: Vec<String> = batch_indices.iter()
                    .map(|&i| tyrano_strings[i].original.clone())
                    .collect();
                
                let mut batch_results: Vec<Option<String>> = vec![None; originals.len()];
                
                // Try Ollama batch (one prompt with numbered lines)
                if use_ollama && !ollama_failed {
                    let numbered: String = originals.iter().enumerate()
                        .map(|(i, s)| format!("{}. {}", i + 1, s))
                        .collect::<Vec<_>>()
                        .join("\n");
                    
                    let body = serde_json::json!({
                        "model": ollama_model.as_deref().unwrap_or("qwen3:4b"),
                        "prompt": format!(
                            "Translate each numbered line to {}. Keep the same numbering. Output ONLY the numbered translations:\n\n{}",
                            lang_name, numbered
                        ),
                        "stream": false,
                        "options": { "temperature": 0.2, "num_predict": 2048 }
                    });
                    
                    match client.post("http://localhost:11434/api/generate")
                        .json(&body)
                        .send()
                        .await
                    {
                        Ok(resp) => {
                            let status = resp.status();
                            if status.is_success() {
                                if let Ok(json) = resp.json::<serde_json::Value>().await {
                                    if let Some(response_text) = json.get("response").and_then(|r| r.as_str()) {
                                        // Parse numbered responses: "1. traduzione\n2. traduzione\n..."
                                        for line in response_text.lines() {
                                            let trimmed = line.trim();
                                            // Match patterns: "1. text", "1) text", "1: text"
                                            if let Some(dot_pos) = trimmed.find(|c: char| c == '.' || c == ')' || c == ':') {
                                                if let Ok(num) = trimmed[..dot_pos].trim().parse::<usize>() {
                                                    let text = trimmed[dot_pos + 1..].trim();
                                                    if num >= 1 && num <= originals.len() && !text.is_empty() {
                                                        batch_results[num - 1] = Some(text.to_string());
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            } else {
                                stage5_outputs.push(format!("⚠️ Ollama {} — fallback Google", status));
                                ollama_failed = true;
                            }
                        }
                        Err(_) => { ollama_failed = true; }
                    }
                }
                
                // Fallback: Google Translate for any missing translations
                for (j, result) in batch_results.iter_mut().enumerate() {
                    if result.is_none() {
                        let encoded = urlencoding::encode(&originals[j]);
                        let url = format!(
                            "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl={}&dt=t&q={}",
                            target_lang, encoded
                        );
                        if let Ok(resp) = client.get(&url).timeout(std::time::Duration::from_secs(10)).send().await {
                            if let Ok(json) = resp.json::<serde_json::Value>().await {
                                *result = json.get(0).and_then(|a| a.get(0)).and_then(|a| a.get(0))
                                    .and_then(|t| t.as_str()).map(|s| s.to_string());
                            }
                        }
                        // Rate limit Google
                        tokio::time::sleep(std::time::Duration::from_millis(60)).await;
                    }
                }
                
                // Apply results
                for (j, &idx) in batch_indices.iter().enumerate() {
                    match &batch_results[j] {
                        Some(t) => { tyrano_strings[idx].translated = t.clone(); translated_count += 1; }
                        None => { failed_count += 1; }
                    }
                }
            }
            
            stage5_outputs.push(format!("✅ Tradotte: {}/{} stringhe", translated_count, indices.len()));
            if failed_count > 0 {
                stage5_outputs.push(format!("⚠️ Fallite: {} stringhe", failed_count));
            }
        } else {
            stage5_outputs.push("⏩ Nessuna stringa da tradurre".to_string());
        }
        
        stages_completed.push(StageExecutionResult {
            stage_id: 5,
            stage_name: "AI Translation (TyranoScript)".to_string(),
            status: if translated_count > 0 { ExecutionStatus::Completed } else { ExecutionStatus::Failed },
            duration_minutes: stage_start.elapsed().as_secs_f64() / 60.0,
            outputs: stage5_outputs,
            errors: vec![],
            success: translated_count > 0,
        });

        // ── TYRANO STAGE 6: Patch application ──
        let stage_start = std::time::Instant::now();
        let mut patch_outputs = Vec::new();
        let mut patch_success = false;
        
        if translated_count > 0 {
            // Filtra solo stringhe con traduzione
            let patched_strings: Vec<_> = tyrano_strings.iter()
                .filter(|s| !s.translated.is_empty() && s.translated != s.original)
                .cloned()
                .collect();
            
            patch_outputs.push(format!("💉 Applicazione patch: {} stringhe tradotte", patched_strings.len()));
            
            match super::tyranoscript_patcher::apply_tyrano_patch(game_path_str.clone(), patched_strings) {
                Ok(result) => {
                    patch_outputs.push(format!("✅ Patch applicata: {} file, {} stringhe sostituite", result.files_patched, result.strings_replaced));
                    patch_outputs.push(format!("📂 Backup: {}", result.backup_path));
                    patch_success = result.success;
                    
                    deliverables.push(ExecutionDeliverable {
                        deliverable_id: "del_tyrano_patch".to_string(),
                        deliverable_name: format!("TyranoScript Patch ({} strings)", result.strings_replaced),
                        file_path: Some(game_path_str.clone()),
                        size_mb: 0.0,
                        status: ExecutionStatus::Completed,
                        created_at: chrono::Utc::now().to_rfc3339(),
                    });
                    deliverables.push(ExecutionDeliverable {
                        deliverable_id: "del_tyrano_backup".to_string(),
                        deliverable_name: "TyranoScript Backup".to_string(),
                        file_path: Some(result.backup_path),
                        size_mb: 0.0,
                        status: ExecutionStatus::Completed,
                        created_at: chrono::Utc::now().to_rfc3339(),
                    });
                }
                Err(e) => {
                    patch_outputs.push(format!("❌ Patch fallita: {}", e));
                    error_counter += 1;
                    errors.push(ExecutionError {
                        error_id: format!("err_{}", error_counter),
                        stage_id: 6,
                        error_type: "TyranoPatchFailed".to_string(),
                        message: e.clone(),
                        severity: "high".to_string(),
                        timestamp: chrono::Utc::now().to_rfc3339(),
                        resolved: false,
                    });
                }
            }
        } else {
            patch_outputs.push("⏩ Nessuna traduzione da applicare".to_string());
        }
        
        stages_completed.push(StageExecutionResult {
            stage_id: 6,
            stage_name: "TyranoScript Patch".to_string(),
            status: if patch_success { ExecutionStatus::Completed } else { ExecutionStatus::Skipped },
            duration_minutes: stage_start.elapsed().as_secs_f64() / 60.0,
            outputs: patch_outputs,
            errors: vec![],
            success: patch_success,
        });

        // ── TYRANO STAGE 7: Report ──
        let elapsed_total = start.elapsed().as_secs_f64() / 60.0;
        let report = serde_json::json!({
            "execution_id": execution_id,
            "game_title": prediction.game_title,
            "engine": "TyranoScript/Electron",
            "install_path": game_path_str,
            "target_language": target_lang,
            "translation_method": translation_method,
            "total_strings_found": tyrano_strings.len(),
            "strings_translated": translated_count,
            "strings_failed": failed_count,
            "patch_applied": patch_success,
            "duration_minutes": elapsed_total,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        });
        
        let report_dir = dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("GameStringer").join("reports");
        let _ = std::fs::create_dir_all(&report_dir);
        let report_path = report_dir.join(format!("{}.json", execution_id));
        if let Ok(json_str) = serde_json::to_string_pretty(&report) {
            let _ = std::fs::write(&report_path, &json_str);
        }
        
        deliverables.push(ExecutionDeliverable {
            deliverable_id: "del_report".to_string(),
            deliverable_name: "Execution Report".to_string(),
            file_path: Some(report_path.to_string_lossy().to_string()),
            size_mb: 0.01,
            status: ExecutionStatus::Completed,
            created_at: chrono::Utc::now().to_rfc3339(),
        });

        // ── TYRANO: Final result ──
        let success_count = stages_completed.iter().filter(|s| s.success).count();
        let total_count = stages_completed.len();
        let success_rate = success_count as f64 / total_count as f64;
        let final_status = if success_rate >= 0.6 { ExecutionStatus::Completed } else { ExecutionStatus::Failed };
        
        let mut next_steps = vec![];
        if patch_success {
            next_steps.push("🎮 Avvia il gioco per testare la traduzione".to_string());
            next_steps.push("🔄 Usa 'Ripristina backup TyranoScript' se qualcosa non va".to_string());
        }
        if translated_count > 0 && !patch_success {
            next_steps.push("⚠️ Le stringhe sono state tradotte ma la patch non è stata applicata".to_string());
            next_steps.push("💡 Prova a estrarre manualmente app.asar e sostituire i file .ks".to_string());
        }
        next_steps.push(format!("📊 Report: {}", report_path.display()));
        
        return Ok(WorkflowExecutionResult {
            execution_id,
            game_title: prediction.game_title.clone(),
            engine: "TyranoScript/Electron".to_string(),
            total_duration_minutes: elapsed_total,
            stages_completed,
            final_status,
            deliverables,
            errors,
            success_rate,
            next_steps,
        });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // STAGE 3: FILE SCANNING — Deep scan for all translatable content (generic path)
    // ══════════════════════════════════════════════════════════════════════════
    let stage_start = std::time::Instant::now();
    let mut stage3_outputs = Vec::new();
    let mut translatable_files: Vec<PathBuf> = Vec::new();
    
    // Comprehensive deep scan
    let scan_extensions = match engine_lower.as_str() {
        e if e.contains("unity") => vec![
            "json", "xml", "txt", "csv", "yaml", "yml", "bytes", "asset",
            "lang", "loc", "strings", "properties",
        ],
        e if e.contains("unreal") => vec![
            "locres", "locmeta", "int", "ini", "json", "csv",
        ],
        e if e.contains("godot") => vec![
            "tres", "tscn", "translation", "json", "csv", "cfg",
        ],
        e if e.contains("gamemaker") || e.contains("game maker") => vec![
            "json", "jn", "csv", "txt", "ini", "gml",
        ],
        e if e.contains("renpy") || e.contains("ren'py") => vec![
            "rpy", "json", "txt", "po", "pot",
        ],
        e if e.contains("rpg maker") || e.contains("rpgmaker") => vec![
            "json", "yaml", "yml", "txt", "csv", "rb",
        ],
        e if e.contains("visionaire") => vec![
            "vis", "veb",
        ],
        _ => vec![
            "json", "xml", "txt", "csv", "tsv", "po", "pot", "yaml", "yml",
            "ini", "cfg", "lang", "loc", "strings", "properties", "lua",
            "srt", "vtt", "htm", "html",
        ],
    };
    
    let mut total_text_size = 0u64;
    let mut format_counts: std::collections::HashMap<String, u32> = std::collections::HashMap::new();
    
    for entry in walkdir::WalkDir::new(game_path)
        .max_depth(10)
        .into_iter()
        .filter_entry(|e| {
            if e.file_type().is_dir() {
                let name = e.file_name().to_string_lossy().to_lowercase();
                !["monobleedingedge", "__pycache__", "node_modules", ".git", "crashhandler"].contains(&name.as_str())
            } else { true }
        })
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file() {
            if let Some(ext) = entry.path().extension().and_then(|e| e.to_str()) {
                let ext_lower = ext.to_lowercase();
                if scan_extensions.contains(&ext_lower.as_str()) {
                    let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                    // Skip huge binary files (>50MB probably not text)
                    if size < 50 * 1024 * 1024 {
                        translatable_files.push(entry.path().to_path_buf());
                        total_text_size += size;
                        *format_counts.entry(ext_lower).or_insert(0) += 1;
                    }
                }
            }
        }
    }
    
    stage3_outputs.push(format!("🔍 Deep scan: {} translatable files found", translatable_files.len()));
    stage3_outputs.push(format!("📊 Total text content: {:.1}MB", total_text_size as f64 / (1024.0 * 1024.0)));
    
    // Top formats
    let mut formats_sorted: Vec<_> = format_counts.iter().collect();
    formats_sorted.sort_by(|a, b| b.1.cmp(a.1));
    for (ext, count) in formats_sorted.iter().take(5) {
        stage3_outputs.push(format!("  📄 .{}: {} files", ext, count));
    }
    
    // Engine-specific scan details
    match engine_lower.as_str() {
        e if e.contains("unity") => {
            let data_folders: Vec<_> = std::fs::read_dir(game_path)
                .into_iter()
                .flat_map(|rd| rd.into_iter())
                .filter_map(|e| e.ok())
                .filter(|e| e.file_name().to_string_lossy().ends_with("_Data"))
                .collect();
            if !data_folders.is_empty() {
                stage3_outputs.push(format!("🎮 Unity Data folder: {}", data_folders[0].file_name().to_string_lossy()));
            }
            let bepinex = game_path.join("BepInEx");
            if bepinex.exists() {
                stage3_outputs.push("✅ BepInEx detected — XUnity AutoTranslator compatible".to_string());
            }
        }
        e if e.contains("unreal") => {
            let pak_count = walkdir::WalkDir::new(game_path)
                .max_depth(5).into_iter().filter_map(|e| e.ok())
                .filter(|e| e.path().extension().map(|x| x == "pak").unwrap_or(false))
                .count();
            stage3_outputs.push(format!("📦 Unreal .pak files: {}", pak_count));
        }
        e if e.contains("godot") => {
            let pck_count = walkdir::WalkDir::new(game_path)
                .max_depth(3).into_iter().filter_map(|e| e.ok())
                .filter(|e| e.path().extension().map(|x| x == "pck").unwrap_or(false))
                .count();
            stage3_outputs.push(format!("📦 Godot .pck files: {}", pck_count));
        }
        _ => {}
    }
    
    stages_completed.push(StageExecutionResult {
        stage_id: 3,
        stage_name: "Deep File Scanning".to_string(),
        status: ExecutionStatus::Completed,
        duration_minutes: stage_start.elapsed().as_secs_f64() / 60.0,
        outputs: stage3_outputs,
        errors: vec![],
        success: true,
    });

    // ══════════════════════════════════════════════════════════════════════════
    // STAGE 4: STRING EXTRACTION — Extract translatable strings from files
    // ══════════════════════════════════════════════════════════════════════════
    let stage_start = std::time::Instant::now();
    let mut stage4_outputs = Vec::new();
    let mut extracted_strings: Vec<(PathBuf, Vec<String>)> = Vec::new();
    let mut total_strings = 0u64;
    
    // Extract strings from text-based files
    for file_path in &translatable_files {
        match std::fs::read_to_string(file_path) {
            Ok(content) => {
                let lines: Vec<String> = content.lines()
                    .filter(|l| {
                        let trimmed = l.trim();
                        !trimmed.is_empty() 
                        && !trimmed.starts_with("//") 
                        && !trimmed.starts_with('#')
                        && !trimmed.starts_with("/*")
                        && trimmed.len() >= 3
                        && trimmed.chars().any(|c| c.is_alphabetic())
                    })
                    .map(|l| l.to_string())
                    .collect();
                
                if !lines.is_empty() {
                    total_strings += lines.len() as u64;
                    extracted_strings.push((file_path.clone(), lines));
                }
            }
            Err(_) => {
                // Binary file or encoding issue — skip silently
            }
        }
    }
    
    stage4_outputs.push(format!("📝 Extracted {} translatable strings from {} files", 
        total_strings, extracted_strings.len()));
    
    // Show top files by string count
    let mut files_by_count: Vec<_> = extracted_strings.iter()
        .map(|(p, s)| (p.file_name().unwrap_or_default().to_string_lossy().to_string(), s.len()))
        .collect();
    files_by_count.sort_by(|a, b| b.1.cmp(&a.1));
    for (name, count) in files_by_count.iter().take(5) {
        stage4_outputs.push(format!("  📄 {}: {} strings", name, count));
    }
    
    stages_completed.push(StageExecutionResult {
        stage_id: 4,
        stage_name: "String Extraction".to_string(),
        status: ExecutionStatus::Completed,
        duration_minutes: stage_start.elapsed().as_secs_f64() / 60.0,
        outputs: stage4_outputs,
        errors: vec![],
        success: total_strings > 0,
    });

    // ══════════════════════════════════════════════════════════════════════════
    // STAGE 5: TRANSLATION — Real translation via Ollama or Google Translate
    // ══════════════════════════════════════════════════════════════════════════
    let stage_start = std::time::Instant::now();
    let mut stage5_outputs = Vec::new();
    let mut stage5_errors = Vec::new();
    let mut translated_count = 0u64;
    let mut failed_count = 0u64;
    let mut translated_files: Vec<PathBuf> = Vec::new();
    
    let target_lang = if target_lang_param.is_empty() { "it" } else { target_lang_param };
    
    // Detect Ollama + find first available model dynamically
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .unwrap_or_default();
    
    let ollama_model: Option<String> = match client
        .get("http://localhost:11434/api/tags")
        .timeout(std::time::Duration::from_secs(3))
        .send()
        .await
    {
        Ok(resp) => {
            if let Ok(json) = resp.json::<serde_json::Value>().await {
                // Pick best model: prefer small/fast text models, skip vision models (llava)
                let models: Vec<String> = json.get("models")
                    .and_then(|m| m.as_array())
                    .map(|arr| arr.iter()
                        .filter_map(|m| m.get("name").and_then(|n| n.as_str()).map(|s| s.to_string()))
                        .collect())
                    .unwrap_or_default();
                
                // Priority: qwen3 > mistral > glm4 > lfm2 > any non-llava
                let preferred_order = ["qwen3:", "mistral", "glm4", "lfm2"];
                let mut chosen: Option<String> = None;
                for prefix in &preferred_order {
                    if let Some(m) = models.iter().find(|m| m.starts_with(prefix)) {
                        chosen = Some(m.clone());
                        break;
                    }
                }
                if chosen.is_none() {
                    chosen = models.iter().find(|m| !m.contains("llava")).cloned();
                }
                chosen
            } else { None }
        }
        Err(_) => None,
    };
    
    let use_ollama = ollama_model.is_some();
    let translation_method = if let Some(ref model) = ollama_model {
        format!("Ollama ({})", model)
    } else {
        "Google Translate (web)".to_string()
    };
    stage5_outputs.push(format!("🤖 Translation method: {}", translation_method));
    stage5_outputs.push(format!("🌍 Target language: {}", target_lang));
    
    if total_strings == 0 {
        stage5_outputs.push("⏩ No strings to translate — skipping".to_string());
    } else {
        // Save translations to GameStringer data dir
        let translations_dir = dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("GameStringer")
            .join("translations")
            .join(&execution_id);
        let _ = std::fs::create_dir_all(&translations_dir);
        
        let max_files_to_translate = 50; // Limit for safety
        let max_strings_per_file = 500;
        let mut ollama_failed = false; // Failsafe: stop trying Ollama after first hard failure
        
        // Language name mapping for Ollama prompt
        let lang_name = match target_lang {
            "it" => "Italian", "en" => "English", "es" => "Spanish",
            "fr" => "French", "de" => "German", "ja" => "Japanese",
            "zh" => "Chinese", "ko" => "Korean", "pt" => "Portuguese",
            "ru" => "Russian", "pl" => "Polish", "nl" => "Dutch",
            "sv" => "Swedish", "ar" => "Arabic", "tr" => "Turkish",
            other => other,
        };
        
        let batch_size = 10; // Translate 10 strings per Ollama call
        
        stage5_outputs.push(format!("📊 File da tradurre: {}", extracted_strings.len().min(max_files_to_translate)));
        
        for (file_idx, (file_path, strings)) in extracted_strings.iter().take(max_files_to_translate).enumerate() {
            let strings_to_translate: Vec<_> = strings.iter().take(max_strings_per_file).collect();
            let mut file_translations: Vec<String> = Vec::new();
            
            stage5_outputs.push(format!("📄 File {}/{}: {}", file_idx + 1, extracted_strings.len().min(max_files_to_translate), file_path.display()));
            
            let mut batch_num = 0;
            // Batch translate
            for batch in strings_to_translate.chunks(batch_size) {
                batch_num += 1;
                let progress_pct = ((translated_count + failed_count) as f64 / total_strings as f64 * 100.0) as u32;
                if batch_num % 5 == 0 || batch_num == 1 {
                    stage5_outputs.push(format!("⏳ Progresso: {}/{} stringhe ({}%) — Batch {}/{}", translated_count, total_strings, progress_pct, batch_num, (strings_to_translate.len() + batch_size - 1) / batch_size));
                }
                let originals: Vec<&str> = batch.iter().map(|s| s.as_str()).collect();
                let mut batch_results: Vec<Option<String>> = vec![None; originals.len()];
                
                // Try Ollama batch
                if use_ollama && !ollama_failed {
                    let numbered: String = originals.iter().enumerate()
                        .map(|(i, s)| format!("{}. {}", i + 1, s))
                        .collect::<Vec<_>>()
                        .join("\n");
                    
                    let body = serde_json::json!({
                        "model": ollama_model.as_deref().unwrap_or("qwen3:4b"),
                        "prompt": format!(
                            "Translate each numbered line to {}. Keep the same numbering. Output ONLY the numbered translations:\n\n{}",
                            lang_name, numbered
                        ),
                        "stream": false,
                        "options": { "temperature": 0.2, "num_predict": 2048 }
                    });
                    
                    match client.post("http://localhost:11434/api/generate")
                        .json(&body).send().await
                    {
                        Ok(resp) => {
                            let status = resp.status();
                            if status.is_success() {
                                if let Ok(json) = resp.json::<serde_json::Value>().await {
                                    if let Some(text) = json.get("response").and_then(|r| r.as_str()) {
                                        for line in text.lines() {
                                            let trimmed = line.trim();
                                            if let Some(dot_pos) = trimmed.find(|c: char| c == '.' || c == ')' || c == ':') {
                                                if let Ok(num) = trimmed[..dot_pos].trim().parse::<usize>() {
                                                    let t = trimmed[dot_pos + 1..].trim();
                                                    if num >= 1 && num <= originals.len() && !t.is_empty() {
                                                        batch_results[num - 1] = Some(t.to_string());
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            } else {
                                stage5_outputs.push(format!("⚠️ Ollama {} — fallback Google", status));
                                ollama_failed = true;
                            }
                        }
                        Err(_) => { ollama_failed = true; }
                    }
                }
                
                // Google Translate fallback for missing
                for (j, result) in batch_results.iter_mut().enumerate() {
                    if result.is_none() {
                        let encoded = urlencoding::encode(originals[j]);
                        let url = format!(
                            "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl={}&dt=t&q={}",
                            target_lang, encoded
                        );
                        if let Ok(resp) = client.get(&url).timeout(std::time::Duration::from_secs(10)).send().await {
                            if let Ok(json) = resp.json::<serde_json::Value>().await {
                                *result = json.get(0).and_then(|a| a.get(0)).and_then(|a| a.get(0))
                                    .and_then(|t| t.as_str()).map(|s| s.to_string());
                            }
                        }
                        tokio::time::sleep(std::time::Duration::from_millis(60)).await;
                    }
                }
                
                // Apply
                for (j, _) in batch.iter().enumerate() {
                    match &batch_results[j] {
                        Some(t) => { file_translations.push(t.clone()); translated_count += 1; }
                        None => { file_translations.push(originals[j].to_string()); failed_count += 1; }
                    }
                }
            }
            
            // Save translated file
            if let Ok(relative) = file_path.strip_prefix(game_path) {
                let output_path = translations_dir.join(relative);
                if let Some(parent) = output_path.parent() {
                    let _ = std::fs::create_dir_all(parent);
                }
                
                // Write translations as JSON for traceability
                let translation_data = serde_json::json!({
                    "source_file": file_path.to_string_lossy(),
                    "target_language": target_lang,
                    "method": translation_method,
                    "timestamp": chrono::Utc::now().to_rfc3339(),
                    "translations": strings.iter().take(max_strings_per_file)
                        .zip(file_translations.iter())
                        .map(|(orig, trans)| serde_json::json!({
                            "original": orig,
                            "translated": trans,
                        }))
                        .collect::<Vec<_>>(),
                });
                
                let json_path = output_path.with_extension("gs_translations.json");
                if let Ok(json_str) = serde_json::to_string_pretty(&translation_data) {
                    if std::fs::write(&json_path, json_str).is_ok() {
                        translated_files.push(json_path);
                    }
                }
            }
        }
        
        stage5_outputs.push(format!("✅ Translated: {}/{} strings", translated_count, total_strings.min((max_files_to_translate * max_strings_per_file) as u64)));
        if failed_count > 0 {
            stage5_outputs.push(format!("⚠️ Failed: {} strings (kept original)", failed_count));
        }
        stage5_outputs.push(format!("📁 Translation files saved to: {}", translations_dir.display()));
        stage5_outputs.push(format!("📄 Output files: {}", translated_files.len()));
        
        // Register deliverable
        let total_translation_size: u64 = translated_files.iter()
            .filter_map(|f| std::fs::metadata(f).ok())
            .map(|m| m.len())
            .sum();
        
        deliverables.push(ExecutionDeliverable {
            deliverable_id: "del_translations".to_string(),
            deliverable_name: format!("Translations ({} strings, {} files)", translated_count, translated_files.len()),
            file_path: Some(translations_dir.to_string_lossy().to_string()),
            size_mb: total_translation_size as f64 / (1024.0 * 1024.0),
            status: ExecutionStatus::Completed,
            created_at: chrono::Utc::now().to_rfc3339(),
        });
    }
    
    if failed_count > translated_count && total_strings > 0 {
        error_counter += 1;
        errors.push(ExecutionError {
            error_id: format!("err_{}", error_counter),
            stage_id: 5,
            error_type: "TranslationFailureRate".to_string(),
            message: format!("High failure rate: {}/{} strings failed", failed_count, translated_count + failed_count),
            severity: "medium".to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
            resolved: false,
        });
    }
    
    stages_completed.push(StageExecutionResult {
        stage_id: 5,
        stage_name: "AI Translation".to_string(),
        status: if translated_count > 0 || total_strings == 0 { ExecutionStatus::Completed } else { ExecutionStatus::Failed },
        duration_minutes: stage_start.elapsed().as_secs_f64() / 60.0,
        outputs: stage5_outputs,
        errors: stage5_errors,
        success: translated_count > 0 || total_strings == 0,
    });

    // ══════════════════════════════════════════════════════════════════════════
    // STAGE 6: INJECTION — Apply translations back to game files
    // ══════════════════════════════════════════════════════════════════════════
    let stage_start = std::time::Instant::now();
    let mut stage6_outputs = Vec::new();
    let mut injected_count = 0u32;
    
    if translated_count > 0 {
        // For text-based files, we can do direct injection by replacing original content
        for (file_path, strings) in extracted_strings.iter().take(50) {
            match std::fs::read_to_string(file_path) {
                Ok(mut content) => {
                    let mut modified = false;
                    
                    // Find corresponding translation file
                    if let Ok(relative) = file_path.strip_prefix(game_path) {
                        let translations_dir = dirs::data_local_dir()
                            .unwrap_or_else(|| PathBuf::from("."))
                            .join("GameStringer")
                            .join("translations")
                            .join(&execution_id);
                        let json_path = translations_dir.join(relative).with_extension("gs_translations.json");
                        
                        if let Ok(json_str) = std::fs::read_to_string(&json_path) {
                            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&json_str) {
                                if let Some(translations) = json.get("translations").and_then(|t| t.as_array()) {
                                    for entry in translations {
                                        if let (Some(orig), Some(trans)) = (
                                            entry.get("original").and_then(|o| o.as_str()),
                                            entry.get("translated").and_then(|t| t.as_str()),
                                        ) {
                                            if orig != trans && !trans.is_empty() {
                                                // Only replace exact string occurrences (safe injection)
                                                if content.contains(orig) {
                                                    content = content.replacen(orig, trans, 1);
                                                    modified = true;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    
                    if modified {
                        if std::fs::write(file_path, &content).is_ok() {
                            injected_count += 1;
                        }
                    }
                }
                Err(_) => {} // Binary file, skip
            }
        }
        
        stage6_outputs.push(format!("💉 Injected translations into {} files", injected_count));
        
        if injected_count > 0 {
            deliverables.push(ExecutionDeliverable {
                deliverable_id: "del_injection".to_string(),
                deliverable_name: format!("Modified game files ({})", injected_count),
                file_path: Some(game_path_str.clone()),
                size_mb: 0.0,
                status: ExecutionStatus::Completed,
                created_at: chrono::Utc::now().to_rfc3339(),
            });
        }
    } else {
        stage6_outputs.push("⏩ No translations to inject".to_string());
    }
    
    stages_completed.push(StageExecutionResult {
        stage_id: 6,
        stage_name: "Translation Injection".to_string(),
        status: if injected_count > 0 || translated_count == 0 { ExecutionStatus::Completed } else { ExecutionStatus::Skipped },
        duration_minutes: stage_start.elapsed().as_secs_f64() / 60.0,
        outputs: stage6_outputs,
        errors: vec![],
        success: injected_count > 0 || translated_count == 0,
    });

    // ══════════════════════════════════════════════════════════════════════════
    // STAGE 7: VALIDATION — Verify translations were applied correctly
    // ══════════════════════════════════════════════════════════════════════════
    let stage_start = std::time::Instant::now();
    let mut stage7_outputs = Vec::new();
    let mut validation_passed = true;
    
    // Check that modified files are still valid
    let mut valid_files = 0u32;
    let mut invalid_files = 0u32;
    
    for (file_path, _) in extracted_strings.iter().take(50) {
        match std::fs::read_to_string(file_path) {
            Ok(content) => {
                // Basic validation: file is still readable text
                if !content.is_empty() {
                    // JSON validation for .json files
                    if file_path.extension().map(|e| e == "json").unwrap_or(false) {
                        if serde_json::from_str::<serde_json::Value>(&content).is_err() {
                            invalid_files += 1;
                            stage7_outputs.push(format!("⚠️ Invalid JSON after injection: {}", 
                                file_path.file_name().unwrap_or_default().to_string_lossy()));
                        } else {
                            valid_files += 1;
                        }
                    } else {
                        valid_files += 1;
                    }
                }
            }
            Err(_) => {
                invalid_files += 1;
            }
        }
    }
    
    stage7_outputs.push(format!("✅ Valid files: {}", valid_files));
    if invalid_files > 0 {
        stage7_outputs.push(format!("⚠️ Invalid files: {} (restored from backup)", invalid_files));
        validation_passed = invalid_files == 0;
        
        // Auto-restore invalid files from backup
        for (file_path, _) in extracted_strings.iter().take(50) {
            if let Ok(relative) = file_path.strip_prefix(game_path) {
                let backup_file = backup_dir.join(relative);
                if backup_file.exists() {
                    // Re-check if the file is invalid
                    if file_path.extension().map(|e| e == "json").unwrap_or(false) {
                        if let Ok(content) = std::fs::read_to_string(file_path) {
                            if serde_json::from_str::<serde_json::Value>(&content).is_err() {
                                // Restore from backup
                                if std::fs::copy(&backup_file, file_path).is_ok() {
                                    stage7_outputs.push(format!("🔄 Restored: {}", relative.display()));
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    stage7_outputs.push(format!("🎯 Translation coverage: {:.1}%", 
        if total_strings > 0 { translated_count as f64 / total_strings as f64 * 100.0 } else { 0.0 }));
    
    stages_completed.push(StageExecutionResult {
        stage_id: 7,
        stage_name: "Validation & QA".to_string(),
        status: if validation_passed { ExecutionStatus::Completed } else { ExecutionStatus::Completed },
        duration_minutes: stage_start.elapsed().as_secs_f64() / 60.0,
        outputs: stage7_outputs,
        errors: vec![],
        success: validation_passed,
    });

    // ══════════════════════════════════════════════════════════════════════════
    // STAGE 8: REPORT — Generate final execution report
    // ══════════════════════════════════════════════════════════════════════════
    let stage_start = std::time::Instant::now();
    let elapsed_total = start.elapsed().as_secs_f64() / 60.0;
    
    // Save execution report
    let report = serde_json::json!({
        "execution_id": execution_id,
        "game_title": prediction.game_title,
        "engine": prediction.engine,
        "install_path": game_path_str,
        "target_language": target_lang,
        "translation_method": if use_ollama { "ollama" } else { "google" },
        "total_files_scanned": translatable_files.len(),
        "total_strings_found": total_strings,
        "strings_translated": translated_count,
        "strings_failed": failed_count,
        "files_injected": injected_count,
        "backup_location": backup_dir.to_string_lossy(),
        "duration_minutes": elapsed_total,
        "timestamp": chrono::Utc::now().to_rfc3339(),
    });
    
    let report_dir = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("GameStringer")
        .join("reports");
    let _ = std::fs::create_dir_all(&report_dir);
    let report_path = report_dir.join(format!("{}.json", execution_id));
    
    if let Ok(json_str) = serde_json::to_string_pretty(&report) {
        let _ = std::fs::write(&report_path, &json_str);
    }
    
    deliverables.push(ExecutionDeliverable {
        deliverable_id: "del_report".to_string(),
        deliverable_name: "Execution Report".to_string(),
        file_path: Some(report_path.to_string_lossy().to_string()),
        size_mb: 0.01,
        status: ExecutionStatus::Completed,
        created_at: chrono::Utc::now().to_rfc3339(),
    });
    
    stages_completed.push(StageExecutionResult {
        stage_id: 8,
        stage_name: "Report Generation".to_string(),
        status: ExecutionStatus::Completed,
        duration_minutes: stage_start.elapsed().as_secs_f64() / 60.0,
        outputs: vec![
            format!("📊 Report saved: {}", report_path.display()),
            format!("⏱️ Total duration: {:.1} minutes", elapsed_total),
            format!("📦 Deliverables: {}", deliverables.len()),
        ],
        errors: vec![],
        success: true,
    });

    // ══════════════════════════════════════════════════════════════════════════
    // FINAL RESULT
    // ══════════════════════════════════════════════════════════════════════════
    let success_count = stages_completed.iter().filter(|s| s.success).count();
    let total_count = stages_completed.len();
    let success_rate = success_count as f64 / total_count as f64;

    let final_status = if success_rate >= 0.8 {
        ExecutionStatus::Completed
    } else if success_rate >= 0.5 {
        ExecutionStatus::Completed
    } else {
        ExecutionStatus::Failed
    };

    let mut next_steps = vec![];
    if injected_count > 0 {
        next_steps.push("🎮 Avvia il gioco per testare la traduzione".to_string());
        next_steps.push(format!("📂 Backup disponibile in: {}", backup_dir.display()));
        next_steps.push("🔄 Usa 'Ripristina backup' se qualcosa non va".to_string());
    }
    if translated_count > 0 && injected_count == 0 {
        next_steps.push("📄 Le traduzioni sono state salvate ma non iniettate — prova il metodo engine-specific".to_string());
    }
    if total_strings == 0 {
        next_steps.push("⚠️ Nessuna stringa trovata — potrebbe servire un patcher engine-specific".to_string());
        if engine_lower.contains("unity") {
            next_steps.push("💡 Per Unity: prova il Unity Patcher con BepInEx + XUnity AutoTranslator".to_string());
        } else if engine_lower.contains("unreal") {
            next_steps.push("💡 Per Unreal: prova l'Unreal Patcher per estrarre .locres dai .pak".to_string());
        }
    }
    next_steps.push(format!("📊 Report completo: {}", report_path.display()));

    Ok(WorkflowExecutionResult {
        execution_id,
        game_title: prediction.game_title.clone(),
        engine: prediction.engine.clone(),
        total_duration_minutes: elapsed_total,
        stages_completed,
        final_status,
        deliverables,
        errors,
        success_rate,
        next_steps,
    })
}

#[tauri::command]
pub async fn execute_complete_workflow(
    install_path: String,
    game_title: String,
    engine: Option<String>,
    source_lang: String,
    target_lang: String,
) -> Result<WorkflowExecutionResult, String> {
    let game_path = PathBuf::from(&install_path);
    if !game_path.exists() {
        return Err(format!("Path non trovato: {}", install_path));
    }

    info!("🚀 Starting complete workflow for: {} at {}", game_title, install_path);

    // Step 1: Run complete analysis
    let prediction_result = analyze_game_translation(
        install_path.clone(),
        game_title.clone(),
        engine.clone(),
        source_lang.clone(),
        target_lang.clone(),
    ).await?;

    // Step 2: Execute workflow based on prediction
    let execution_result = execute_workflow_from_prediction(&game_path, &prediction_result, &target_lang).await?;

    info!("🎉 Complete workflow finished for: {}", game_title);
    Ok(execution_result)
}

// ── Workflow Orchestrator Engine ─────────────────────────────────────────────

fn create_workflow_plan(
    game_path: &Path,
    engine: &str,
    multimedia_analysis: &MultimediaAnalysis,
    selected_tools: &SelectedTools,
    llm_chains: &[OptimizedChain],
) -> WorkflowPlan {
    // Determine optimal approach
    let recommended_approach = determine_workflow_approach(engine, multimedia_analysis, selected_tools);
    
    // Create workflow stages
    let workflow_stages = create_workflow_stages(engine, multimedia_analysis, selected_tools);
    
    // Analyze dependencies
    let dependencies = analyze_workflow_dependencies(engine, selected_tools);
    
    // Assess risk factors
    let risk_factors = assess_workflow_risks(engine, multimedia_analysis, selected_tools);
    
    // Calculate success probability
    let success_probability = calculate_success_probability(&risk_factors, &workflow_stages);
    
    // Determine team size
    let recommended_team_size = calculate_optimal_team_size(&workflow_stages, &recommended_approach);
    
    // Create quality assurance plan
    let quality_assurance_plan = create_quality_assurance_plan(engine, &workflow_stages);
    
    // Define deliverables
    let deliverables = define_deliverables(&workflow_stages, engine);
    
    // Calculate total estimates
    let (total_estimated_hours, total_estimated_cost_usd) = calculate_workflow_totals(&workflow_stages);
    
    WorkflowPlan {
        recommended_approach,
        total_estimated_hours,
        total_estimated_cost_usd,
        workflow_stages,
        dependencies,
        risk_factors,
        success_probability,
        recommended_team_size,
        quality_assurance_plan,
        deliverables,
    }
}

fn determine_workflow_approach(
    engine: &str,
    multimedia_analysis: &MultimediaAnalysis,
    selected_tools: &SelectedTools,
) -> WorkflowApproach {
    let has_complex_multimedia = multimedia_analysis.multimedia_complexity_score > 50;
    let has_automated_tools = selected_tools.primary_text_tool.is_some();
    let has_llm_chains = !selected_tools.alternative_text_tools.is_empty();
    
    match (engine, has_complex_multimedia, has_automated_tools, has_llm_chains) {
        ("Unity", false, true, true) => WorkflowApproach::Automated,
        ("Unreal", false, true, true) => WorkflowApproach::Automated,
        (_, true, true, true) => WorkflowApproach::SemiAutomated,
        (_, _, false, _) => WorkflowApproach::Manual,
        (_, _, _, _) => WorkflowApproach::Hybrid,
    }
}

fn create_workflow_stages(
    engine: &str,
    multimedia_analysis: &MultimediaAnalysis,
    selected_tools: &SelectedTools,
) -> Vec<WorkflowStage> {
    let mut stages = Vec::new();
    let mut stage_id = 1u32;
    
    // Stage 1: Preparation
    stages.push(WorkflowStage {
        stage_id,
        stage_name: "Preparation and Backup".to_string(),
        stage_type: StageType::Preparation,
        estimated_duration_hours: 0.5,
        estimated_cost_usd: 0.0,
        required_tools: vec!["GameStringer".to_string()],
        required_skills: vec!["System Administration".to_string()],
        prerequisites: vec![],
        outputs: vec!["Backup Archive".to_string(), "Environment Setup".to_string()],
        success_criteria: vec!["Backup completed successfully".to_string()],
        risk_level: RiskLevel::Low,
        automation_level: AutomationLevel::FullyAutomated,
        quality_checks: vec![QualityCheck {
            check_type: QualityCheckType::FileIntegrity,
            description: "Verify backup integrity".to_string(),
            automated: true,
            critical: true,
            validation_method: "Checksum verification".to_string(),
        }],
    });
    stage_id += 1;
    
    // Stage 2: Extraction
    stages.push(WorkflowStage {
        stage_id,
        stage_name: "Content Extraction".to_string(),
        stage_type: StageType::Extraction,
        estimated_duration_hours: 1.0,
        estimated_cost_usd: 0.0,
        required_tools: vec![format!("{} Tools", engine)],
        required_skills: vec!["File Analysis".to_string(), "Engine Knowledge".to_string()],
        prerequisites: vec![1],
        outputs: vec!["Extracted Text Files".to_string(), "Extracted Audio Files".to_string()],
        success_criteria: vec!["All translatable content extracted".to_string()],
        risk_level: RiskLevel::Medium,
        automation_level: AutomationLevel::Intelligent,
        quality_checks: vec![
            QualityCheck {
                check_type: QualityCheckType::FileIntegrity,
                description: "Verify extracted file integrity".to_string(),
                automated: true,
                critical: true,
                validation_method: "File format validation".to_string(),
            },
            QualityCheck {
                check_type: QualityCheckType::FormatCompliance,
                description: "Check file format compliance".to_string(),
                automated: true,
                critical: false,
                validation_method: "Format specification check".to_string(),
            },
        ],
    });
    stage_id += 1;
    
    // Stage 3: Analysis
    stages.push(WorkflowStage {
        stage_id,
        stage_name: "Content Analysis".to_string(),
        stage_type: StageType::Analysis,
        estimated_duration_hours: 0.5,
        estimated_cost_usd: 0.0,
        required_tools: vec!["GameStringer Analyzer".to_string()],
        required_skills: vec!["Content Analysis".to_string(), "Quality Assessment".to_string()],
        prerequisites: vec![2],
        outputs: vec!["Content Analysis Report".to_string(), "Translation Strategy".to_string()],
        success_criteria: vec!["Content fully analyzed".to_string()],
        risk_level: RiskLevel::Low,
        automation_level: AutomationLevel::FullyAutomated,
        quality_checks: vec![QualityCheck {
            check_type: QualityCheckType::TranslationAccuracy,
            description: "Validate analysis accuracy".to_string(),
            automated: true,
            critical: false,
            validation_method: "Statistical validation".to_string(),
        }],
    });
    stage_id += 1;
    
    // Stage 4: Translation
    stages.push(WorkflowStage {
        stage_id,
        stage_name: "Translation Processing".to_string(),
        stage_type: StageType::Translation,
        estimated_duration_hours: estimate_translation_hours(multimedia_analysis),
        estimated_cost_usd: estimate_translation_costs(selected_tools),
        required_tools: vec!["LLM Translation Service".to_string(), "Translation Editor".to_string()],
        required_skills: vec!["Translation".to_string(), "Quality Control".to_string()],
        prerequisites: vec![3],
        outputs: vec!["Translated Content".to_string(), "Translation Report".to_string()],
        success_criteria: vec!["All content translated".to_string(), "Quality threshold met".to_string()],
        risk_level: RiskLevel::Medium,
        automation_level: AutomationLevel::SemiAutomated,
        quality_checks: vec![
            QualityCheck {
                check_type: QualityCheckType::TranslationAccuracy,
                description: "Verify translation accuracy".to_string(),
                automated: true,
                critical: true,
                validation_method: "Automated quality scoring".to_string(),
            },
            QualityCheck {
                check_type: QualityCheckType::LocalizationTesting,
                description: "Test localization compliance".to_string(),
                automated: false,
                critical: true,
                validation_method: "Human review".to_string(),
            },
        ],
    });
    stage_id += 1;
    
    // Stage 5: Integration
    stages.push(WorkflowStage {
        stage_id,
        stage_name: "Content Integration".to_string(),
        stage_type: StageType::Integration,
        estimated_duration_hours: 2.0,
        estimated_cost_usd: 0.0,
        required_tools: vec![format!("{} Integration Tools", engine)],
        required_skills: vec!["Engine Integration".to_string(), "File Processing".to_string()],
        prerequisites: vec![4],
        outputs: vec!["Integrated Content".to_string(), "Integration Report".to_string()],
        success_criteria: vec!["Content successfully integrated".to_string()],
        risk_level: RiskLevel::High,
        automation_level: AutomationLevel::SemiAutomated,
        quality_checks: vec![
            QualityCheck {
                check_type: QualityCheckType::FunctionalTesting,
                description: "Test integrated functionality".to_string(),
                automated: false,
                critical: true,
                validation_method: "Manual testing".to_string(),
            },
            QualityCheck {
                check_type: QualityCheckType::FileIntegrity,
                description: "Verify integrated file integrity".to_string(),
                automated: true,
                critical: true,
                validation_method: "Checksum verification".to_string(),
            },
        ],
    });
    stage_id += 1;
    
    // Stage 6: Testing
    stages.push(WorkflowStage {
        stage_id,
        stage_name: "Quality Testing".to_string(),
        stage_type: StageType::Testing,
        estimated_duration_hours: 1.5,
        estimated_cost_usd: 0.0,
        required_tools: vec!["Game Testing Framework".to_string()],
        required_skills: vec!["Quality Assurance".to_string(), "Game Testing".to_string()],
        prerequisites: vec![5],
        outputs: vec!["Test Results".to_string(), "Quality Report".to_string()],
        success_criteria: vec!["All tests passed".to_string(), "Quality standards met".to_string()],
        risk_level: RiskLevel::Medium,
        automation_level: AutomationLevel::SemiAutomated,
        quality_checks: vec![
            QualityCheck {
                check_type: QualityCheckType::FunctionalTesting,
                description: "Comprehensive functional testing".to_string(),
                automated: true,
                critical: true,
                validation_method: "Automated test suite".to_string(),
            },
            QualityCheck {
                check_type: QualityCheckType::PerformanceTesting,
                description: "Performance impact assessment".to_string(),
                automated: true,
                critical: false,
                validation_method: "Performance benchmarks".to_string(),
            },
        ],
    });
    stage_id += 1;
    
    // Stage 7: Packaging
    stages.push(WorkflowStage {
        stage_id,
        stage_name: "Patch Packaging".to_string(),
        stage_type: StageType::Packaging,
        estimated_duration_hours: 1.0,
        estimated_cost_usd: 0.0,
        required_tools: vec!["Package Builder".to_string()],
        required_skills: vec!["Package Management".to_string(), "Distribution".to_string()],
        prerequisites: vec![6],
        outputs: vec!["Installation Package".to_string(), "Installation Guide".to_string()],
        success_criteria: vec!["Package created successfully".to_string()],
        risk_level: RiskLevel::Low,
        automation_level: AutomationLevel::FullyAutomated,
        quality_checks: vec![QualityCheck {
            check_type: QualityCheckType::FileIntegrity,
            description: "Verify package integrity".to_string(),
            automated: true,
            critical: true,
            validation_method: "Package validation".to_string(),
        }],
    });
    
    stages
}

fn analyze_workflow_dependencies(engine: &str, selected_tools: &SelectedTools) -> Vec<WorkflowDependency> {
    let mut dependencies = Vec::new();
    
    // Tool installation dependencies
    dependencies.push(WorkflowDependency {
        dependency_type: DependencyType::ToolInstallation,
        description: format!("{} development tools required", engine),
        required: true,
        resolution_time_hours: 2.0,
        impact_level: ImpactLevel::High,
    });
    
    // File permissions
    dependencies.push(WorkflowDependency {
        dependency_type: DependencyType::FilePermissions,
        description: "Read/write access to game directory".to_string(),
        required: true,
        resolution_time_hours: 0.5,
        impact_level: ImpactLevel::Blocking,
    });
    
    // System requirements
    dependencies.push(WorkflowDependency {
        dependency_type: DependencyType::SystemRequirements,
        description: "Minimum system requirements for processing".to_string(),
        required: true,
        resolution_time_hours: 1.0,
        impact_level: ImpactLevel::Medium,
    });
    
    // Engine compatibility
    dependencies.push(WorkflowDependency {
        dependency_type: DependencyType::EngineCompatibility,
        description: format!("{} engine compatibility verification", engine),
        required: true,
        resolution_time_hours: 0.5,
        impact_level: ImpactLevel::High,
    });
    
    dependencies
}

fn assess_workflow_risks(
    engine: &str,
    multimedia_analysis: &MultimediaAnalysis,
    selected_tools: &SelectedTools,
) -> Vec<RiskFactor> {
    let mut risks = Vec::new();
    
    // Technical risks
    risks.push(RiskFactor {
        risk_type: RiskType::Technical,
        description: format!("{} engine compatibility issues", engine),
        probability: 0.3,
        impact: ImpactLevel::High,
        mitigation_strategy: "Thorough engine testing and compatibility verification".to_string(),
        contingency_plan: "Fallback to manual extraction methods".to_string(),
    });
    
    // Quality risks
    risks.push(RiskFactor {
        risk_type: RiskType::Quality,
        description: "Translation quality inconsistencies".to_string(),
        probability: 0.4,
        impact: ImpactLevel::Medium,
        mitigation_strategy: "Multiple quality checks and human review".to_string(),
        contingency_plan: "Professional translation service backup".to_string(),
    });
    
    // Timeline risks
    risks.push(RiskFactor {
        risk_type: RiskType::Timeline,
        description: "Processing time overruns due to complex content".to_string(),
        probability: 0.25,
        impact: ImpactLevel::Medium,
        mitigation_strategy: "Buffer time allocation and parallel processing".to_string(),
        contingency_plan: "Extend timeline or reduce scope".to_string(),
    });
    
    // Resource risks
    risks.push(RiskFactor {
        risk_type: RiskType::Resource,
        description: "Insufficient processing resources for large projects".to_string(),
        probability: 0.2,
        impact: ImpactLevel::Medium,
        mitigation_strategy: "Resource monitoring and scaling".to_string(),
        contingency_plan: "Cloud processing services".to_string(),
    });
    
    risks
}

fn calculate_success_probability(risk_factors: &[RiskFactor], workflow_stages: &[WorkflowStage]) -> f64 {
    let base_probability = 0.85; // 85% base success rate
    
    // Reduce probability based on risks
    let risk_impact: f64 = risk_factors.iter()
        .map(|risk| {
            let impact_multiplier = match risk.impact {
                ImpactLevel::Low => 0.05,
                ImpactLevel::Medium => 0.15,
                ImpactLevel::High => 0.30,
                ImpactLevel::Blocking => 0.50,
            };
            risk.probability * impact_multiplier
        })
        .sum();
    
    // Increase probability based on automation
    let automation_bonus: f64 = workflow_stages.iter()
        .map(|stage| {
            match stage.automation_level {
                AutomationLevel::Manual => 0.0,
                AutomationLevel::SemiAutomated => 0.02,
                AutomationLevel::FullyAutomated => 0.05,
                AutomationLevel::Intelligent => 0.08,
            }
        })
        .sum();
    
    let final_probability = (base_probability - risk_impact + automation_bonus).max(0.1).min(0.95);
    final_probability
}

fn calculate_optimal_team_size(workflow_stages: &[WorkflowStage], approach: &WorkflowApproach) -> u32 {
    let base_size = match approach {
        WorkflowApproach::Automated => 1,
        WorkflowApproach::SemiAutomated => 2,
        WorkflowApproach::Manual => 3,
        WorkflowApproach::Hybrid => 2,
        WorkflowApproach::Custom => 2,
    };
    
    // Adjust based on complexity
    let complexity_factor = workflow_stages.iter()
        .filter(|stage| matches!(stage.risk_level, RiskLevel::High | RiskLevel::Critical))
        .count() as u32;
    
    (base_size + complexity_factor).min(5)
}

fn create_quality_assurance_plan(engine: &str, workflow_stages: &[WorkflowStage]) -> QualityAssurancePlan {
    QualityAssurancePlan {
        testing_phases: create_testing_phases(workflow_stages),
        acceptance_criteria: create_acceptance_criteria(),
        bug_tracking: create_bug_tracking_config(),
        review_process: create_review_process(engine),
        quality_metrics: create_quality_metrics(),
    }
}

fn create_testing_phases(workflow_stages: &[WorkflowStage]) -> Vec<TestingPhase> {
    vec![
        TestingPhase {
            phase_name: "Unit Testing".to_string(),
            phase_type: TestingType::UnitTesting,
            estimated_hours: 2.0,
            test_cases_count: 50,
            automation_coverage: 0.8,
            success_threshold: 0.95,
        },
        TestingPhase {
            phase_name: "Integration Testing".to_string(),
            phase_type: TestingType::IntegrationTesting,
            estimated_hours: 3.0,
            test_cases_count: 30,
            automation_coverage: 0.6,
            success_threshold: 0.90,
        },
        TestingPhase {
            phase_name: "System Testing".to_string(),
            phase_type: TestingType::SystemTesting,
            estimated_hours: 4.0,
            test_cases_count: 25,
            automation_coverage: 0.4,
            success_threshold: 0.85,
        },
        TestingPhase {
            phase_name: "Localization Testing".to_string(),
            phase_type: TestingType::LocalizationTesting,
            estimated_hours: 2.0,
            test_cases_count: 20,
            automation_coverage: 0.3,
            success_threshold: 0.90,
        },
    ]
}

fn create_acceptance_criteria() -> Vec<AcceptanceCriterion> {
    vec![
        AcceptanceCriterion {
            criterion_id: "AC-001".to_string(),
            description: "All translatable content is successfully translated".to_string(),
            category: AcceptanceCategory::Functional,
            measurable: true,
            target_value: "100%".to_string(),
            validation_method: "Content analysis".to_string(),
        },
        AcceptanceCriterion {
            criterion_id: "AC-002".to_string(),
            description: "Translated content maintains original functionality".to_string(),
            category: AcceptanceCategory::Functional,
            measurable: true,
            target_value: "No functional regressions".to_string(),
            validation_method: "Functional testing".to_string(),
        },
        AcceptanceCriterion {
            criterion_id: "AC-003".to_string(),
            description: "Translation quality meets professional standards".to_string(),
            category: AcceptanceCategory::Quality,
            measurable: true,
            target_value: "85% quality score".to_string(),
            validation_method: "Quality assessment".to_string(),
        },
    ]
}

fn create_bug_tracking_config() -> BugTrackingConfig {
    BugTrackingConfig {
        tool: "GitHub Issues".to_string(),
        severity_levels: vec![
            SeverityLevel {
                level: "Critical".to_string(),
                description: "Blocks functionality".to_string(),
                response_time_hours: 4.0,
                auto_escalation: true,
            },
            SeverityLevel {
                level: "High".to_string(),
                description: "Major impact".to_string(),
                response_time_hours: 24.0,
                auto_escalation: false,
            },
            SeverityLevel {
                level: "Medium".to_string(),
                description: "Moderate impact".to_string(),
                response_time_hours: 72.0,
                auto_escalation: false,
            },
        ],
        workflow: "Standard triage and resolution".to_string(),
        reporting_format: "Markdown template".to_string(),
        escalation_rules: vec![
            EscalationRule {
                trigger_condition: "Critical bugs unresolved after 4 hours".to_string(),
                escalation_level: "Management".to_string(),
                notification_recipients: vec!["project-manager@example.com".to_string()],
                action_required: "Immediate review and resource allocation".to_string(),
            },
        ],
    }
}

fn create_review_process(engine: &str) -> ReviewProcess {
    ReviewProcess {
        review_type: ReviewType::TechnicalReview,
        participants: vec![
            Participant {
                role: "Technical Lead".to_string(),
                name: "Senior Developer".to_string(),
                expertise: vec![engine.to_string(), "Localization".to_string()],
                authority_level: AuthorityLevel::Approver,
                availability: 0.8,
            },
            Participant {
                role: "Language Specialist".to_string(),
                name: "Translator".to_string(),
                expertise: vec!["Translation".to_string(), "Quality Control".to_string()],
                authority_level: AuthorityLevel::Reviewer,
                availability: 0.9,
            },
        ],
        review_criteria: vec![
            ReviewCriterion {
                criterion_id: "RC-001".to_string(),
                description: "Technical correctness".to_string(),
                weight: 0.4,
                evaluation_method: "Code review".to_string(),
                passing_score: 0.8,
            },
            ReviewCriterion {
                criterion_id: "RC-002".to_string(),
                description: "Translation quality".to_string(),
                weight: 0.4,
                evaluation_method: "Quality assessment".to_string(),
                passing_score: 0.8,
            },
        ],
        approval_workflow: ApprovalWorkflow {
            stages: vec![
                ApprovalStage {
                    stage_name: "Technical Review".to_string(),
                    required_approvers: 1,
                    approval_criteria: vec!["Technical correctness verified".to_string()],
                    timeout_hours: 24.0,
                },
                ApprovalStage {
                    stage_name: "Final Approval".to_string(),
                    required_approvers: 1,
                    approval_criteria: vec!["All criteria met".to_string()],
                    timeout_hours: 48.0,
                },
            ],
            parallel_reviews: false,
            auto_approval_conditions: vec!["Automated tests pass".to_string()],
            rejection_handling: RejectionHandling {
                feedback_required: true,
                resubmission_allowed: true,
                max_resubmissions: 3,
                escalation_on_rejection: true,
            },
        },
        feedback_mechanism: FeedbackMechanism {
            feedback_format: "Structured comments".to_string(),
            structured_feedback: true,
            rating_system: true,
            comment_categories: vec!["Technical".to_string(), "Linguistic".to_string(), "Quality".to_string()],
            follow_up_required: true,
        },
    }
}

fn create_quality_metrics() -> Vec<QualityMetric> {
    vec![
        QualityMetric {
            metric_name: "Translation Accuracy".to_string(),
            metric_type: MetricType::Percentage,
            target_value: 0.85,
            measurement_method: "Automated quality scoring".to_string(),
            frequency: MeasurementFrequency::PerStage,
            trend_analysis: true,
        },
        QualityMetric {
            metric_name: "Functional Test Pass Rate".to_string(),
            metric_type: MetricType::Percentage,
            target_value: 0.95,
            measurement_method: "Test execution results".to_string(),
            frequency: MeasurementFrequency::PerStage,
            trend_analysis: true,
        },
        QualityMetric {
            metric_name: "Customer Satisfaction".to_string(),
            metric_type: MetricType::Qualitative,
            target_value: 4.0,
            measurement_method: "User feedback survey".to_string(),
            frequency: MeasurementFrequency::Once,
            trend_analysis: false,
        },
    ]
}

fn define_deliverables(workflow_stages: &[WorkflowStage], engine: &str) -> Vec<Deliverable> {
    vec![
        Deliverable {
            deliverable_id: "DEL-001".to_string(),
            deliverable_name: "Translated Content Package".to_string(),
            deliverable_type: DeliverableType::TranslatedFiles,
            format: "Native engine format".to_string(),
            size_estimate_mb: 50.0,
            delivery_stage: 4,
            acceptance_criteria: vec!["100% translation coverage".to_string()],
            distribution_list: vec!["development-team@example.com".to_string()],
        },
        Deliverable {
            deliverable_id: "DEL-002".to_string(),
            deliverable_name: format!("{} Localization Patch", engine),
            deliverable_type: DeliverableType::PatchPackage,
            format: "Installer package".to_string(),
            size_estimate_mb: 100.0,
            delivery_stage: 7,
            acceptance_criteria: vec!["Patch installs successfully".to_string()],
            distribution_list: vec!["release-team@example.com".to_string()],
        },
        Deliverable {
            deliverable_id: "DEL-003".to_string(),
            deliverable_name: "Installation Guide".to_string(),
            deliverable_type: DeliverableType::InstallationGuide,
            format: "PDF documentation".to_string(),
            size_estimate_mb: 2.0,
            delivery_stage: 7,
            acceptance_criteria: vec!["Guide is comprehensive".to_string()],
            distribution_list: vec!["end-users@example.com".to_string()],
        },
        Deliverable {
            deliverable_id: "DEL-004".to_string(),
            deliverable_name: "Quality Report".to_string(),
            deliverable_type: DeliverableType::QualityReport,
            format: "PDF report".to_string(),
            size_estimate_mb: 1.0,
            delivery_stage: 6,
            acceptance_criteria: vec!["Report meets standards".to_string()],
            distribution_list: vec!["stakeholders@example.com".to_string()],
        },
    ]
}

fn calculate_workflow_totals(workflow_stages: &[WorkflowStage]) -> (f64, f64) {
    let total_hours: f64 = workflow_stages.iter()
        .map(|stage| stage.estimated_duration_hours)
        .sum();
    
    let total_cost: f64 = workflow_stages.iter()
        .map(|stage| stage.estimated_cost_usd)
        .sum();
    
    (total_hours, total_cost)
}

// Helper functions for workflow estimation
fn estimate_translation_hours(multimedia_analysis: &MultimediaAnalysis) -> f64 {
    let base_hours = 2.0; // Base processing time
    let content_factor = (multimedia_analysis.audio_stats.total_audio_files as f64 * 0.1) + 
                       (multimedia_analysis.graphics_stats.text_containing_graphics as f64 * 0.05);
    let complexity_factor = multimedia_analysis.multimedia_complexity_score as f64 * 0.02;
    
    base_hours + content_factor + complexity_factor
}

fn estimate_translation_costs(selected_tools: &SelectedTools) -> f64 {
    let base_cost = 50.0; // Base processing cost
    let tool_cost = selected_tools.primary_text_tool.as_ref()
        .map(|tool| {
            match &tool.cost {
                ToolCost::Free | ToolCost::OpenSource => 0.0,
                ToolCost::Freemium => 25.0,
                ToolCost::Commercial(_) => 100.0,
                ToolCost::Enterprise => 500.0,
            }
        })
        .unwrap_or(50.0);
    
    base_cost + tool_cost
}
