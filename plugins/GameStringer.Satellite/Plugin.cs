using BepInEx;
using BepInEx.Logging;
using BepInEx.Unity.IL2CPP;
using HarmonyLib;
using System;
using System.Collections.Generic;
using System.IO;
using System.IO.MemoryMappedFiles;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

namespace GameStringer.Satellite
{
    /// <summary>
    /// GameStringer Satellite Plugin - Minimal hook for Unity text translation
    /// 
    /// This plugin intercepts Unity UI text (TMPro and legacy UI.Text) and
    /// communicates with the GameStringer Rust backend via shared memory.
    /// </summary>
    [BepInPlugin(PLUGIN_GUID, PLUGIN_NAME, PLUGIN_VERSION)]
    public class Plugin : BasePlugin
    {
        public const string PLUGIN_GUID = "com.gamestringer.satellite";
        public const string PLUGIN_NAME = "GameStringer Satellite";
        public const string PLUGIN_VERSION = "1.0.0";

        internal static ManualLogSource Log;
        internal static TranslationBridge Bridge;
        internal static Harmony HarmonyInstance;

        public override void Load()
        {
            Log = base.Log;
            Log.LogInfo($"[GameStringer] {PLUGIN_NAME} v{PLUGIN_VERSION} loading...");

            try
            {
                // Initialize translation bridge
                Bridge = new TranslationBridge();
                
                if (Bridge.Connect())
                {
                    Log.LogInfo("[GameStringer] ✅ Connected to GameStringer backend");
                }
                else
                {
                    Log.LogWarning("[GameStringer] ⚠️ Backend not running, using offline mode");
                }

                // Apply Harmony patches
                HarmonyInstance = new Harmony(PLUGIN_GUID);
                HarmonyInstance.PatchAll();

                Log.LogInfo($"[GameStringer] ✅ {PLUGIN_NAME} loaded successfully!");
            }
            catch (Exception ex)
            {
                Log.LogError($"[GameStringer] ❌ Failed to load: {ex.Message}");
            }
        }

        public override bool Unload()
        {
            HarmonyInstance?.UnpatchSelf();
            Bridge?.Disconnect();
            Log.LogInfo("[GameStringer] Plugin unloaded");
            return true;
        }
    }

    /// <summary>
    /// Translation Bridge - Communicates with GameStringer Rust backend
    /// via shared memory for ultra-low latency translation lookups.
    /// </summary>
    public class TranslationBridge : IDisposable
    {
        private const string SHMEM_NAME = "GameStringer_TranslationBridge_v1";
        private const int BUFFER_SIZE = 4 * 1024 * 1024; // 4MB

        private MemoryMappedFile _sharedMemory;
        private MemoryMappedViewAccessor _accessor;
        private bool _isConnected;
        private Dictionary<ulong, string> _localCache;

        public TranslationBridge()
        {
            _localCache = new Dictionary<ulong, string>();
        }

        public bool Connect()
        {
            try
            {
                // Try to open existing shared memory created by Rust backend
                _sharedMemory = MemoryMappedFile.OpenExisting(SHMEM_NAME);
                _accessor = _sharedMemory.CreateViewAccessor();
                _isConnected = true;
                return true;
            }
            catch (FileNotFoundException)
            {
                // Backend not running yet
                _isConnected = false;
                return false;
            }
            catch (Exception ex)
            {
                Plugin.Log.LogError($"[TranslationBridge] Connection error: {ex.Message}");
                _isConnected = false;
                return false;
            }
        }

        public void Disconnect()
        {
            _accessor?.Dispose();
            _sharedMemory?.Dispose();
            _isConnected = false;
        }

        /// <summary>
        /// Translate text using the backend or local cache
        /// </summary>
        public string Translate(string originalText)
        {
            if (string.IsNullOrEmpty(originalText))
                return originalText;

            // Compute hash for fast lookup
            ulong hash = ComputeHash(originalText);

            // Check local cache first
            if (_localCache.TryGetValue(hash, out string cached))
                return cached;

            // If connected, try backend
            if (_isConnected)
            {
                string translated = QueryBackend(hash, originalText);
                if (!string.IsNullOrEmpty(translated))
                {
                    _localCache[hash] = translated;
                    return translated;
                }
            }

            // No translation found
            return originalText;
        }

        private string QueryBackend(ulong hash, string originalText)
        {
            // TODO: Implement shared memory protocol
            // For now, return null to indicate no translation
            return null;
        }

        /// <summary>
        /// FNV-1a hash for fast string hashing (matches Rust implementation)
        /// </summary>
        public static ulong ComputeHash(string text)
        {
            const ulong FNV_OFFSET = 14695981039346656037UL;
            const ulong FNV_PRIME = 1099511628211UL;

            ulong hash = FNV_OFFSET;
            foreach (byte b in Encoding.UTF8.GetBytes(text))
            {
                hash ^= b;
                hash *= FNV_PRIME;
            }
            return hash;
        }

        /// <summary>
        /// Load translations from a local JSON file (offline mode)
        /// </summary>
        public void LoadLocalTranslations(string jsonPath)
        {
            if (!File.Exists(jsonPath))
                return;

            try
            {
                string json = File.ReadAllText(jsonPath);
                // Simple JSON parsing for {"original": "translated"} format
                // In production, use a proper JSON library
                var lines = json.Split(new[] { '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries);
                foreach (var line in lines)
                {
                    var trimmed = line.Trim().Trim(',');
                    if (trimmed.StartsWith("\"") && trimmed.Contains(":"))
                    {
                        var parts = trimmed.Split(new[] { ':' }, 2);
                        if (parts.Length == 2)
                        {
                            string original = parts[0].Trim().Trim('"');
                            string translated = parts[1].Trim().Trim('"');
                            ulong hash = ComputeHash(original);
                            _localCache[hash] = translated;
                        }
                    }
                }
                Plugin.Log.LogInfo($"[TranslationBridge] Loaded {_localCache.Count} local translations");
            }
            catch (Exception ex)
            {
                Plugin.Log.LogError($"[TranslationBridge] Failed to load translations: {ex.Message}");
            }
        }

        public void Dispose()
        {
            Disconnect();
        }
    }
}
