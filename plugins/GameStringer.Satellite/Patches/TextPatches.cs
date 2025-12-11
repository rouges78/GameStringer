using HarmonyLib;
using System;

namespace GameStringer.Satellite.Patches
{
    /// <summary>
    /// Harmony patches for Unity text components.
    /// Intercepts text assignments and translates them on-the-fly.
    /// </summary>
    public static class TextPatches
    {
        /// <summary>
        /// Patch for TextMeshPro (TMPro.TMP_Text.text setter)
        /// This is the modern Unity text system used by most games.
        /// </summary>
        [HarmonyPatch]
        public static class TMPTextPatch
        {
            // Target: TMPro.TMP_Text.set_text(string value)
            // Note: The actual type name may vary in IL2CPP games
            
            [HarmonyPatch("TMPro.TMP_Text", "set_text")]
            [HarmonyPrefix]
            public static void Prefix(ref string value)
            {
                if (string.IsNullOrEmpty(value) || Plugin.Bridge == null)
                    return;

                try
                {
                    string translated = Plugin.Bridge.Translate(value);
                    if (translated != value)
                    {
                        value = translated;
                    }
                }
                catch (Exception ex)
                {
                    Plugin.Log.LogWarning($"[TMPText] Translation error: {ex.Message}");
                }
            }
        }

        /// <summary>
        /// Patch for TextMeshProUGUI (UI variant)
        /// </summary>
        [HarmonyPatch]
        public static class TMPTextUGUIPatch
        {
            [HarmonyPatch("TMPro.TextMeshProUGUI", "set_text")]
            [HarmonyPrefix]
            public static void Prefix(ref string value)
            {
                if (string.IsNullOrEmpty(value) || Plugin.Bridge == null)
                    return;

                try
                {
                    string translated = Plugin.Bridge.Translate(value);
                    if (translated != value)
                    {
                        value = translated;
                    }
                }
                catch (Exception ex)
                {
                    Plugin.Log.LogWarning($"[TMPTextUGUI] Translation error: {ex.Message}");
                }
            }
        }

        /// <summary>
        /// Patch for legacy UnityEngine.UI.Text
        /// Used by older Unity games.
        /// </summary>
        [HarmonyPatch]
        public static class LegacyTextPatch
        {
            [HarmonyPatch("UnityEngine.UI.Text", "set_text")]
            [HarmonyPrefix]
            public static void Prefix(ref string value)
            {
                if (string.IsNullOrEmpty(value) || Plugin.Bridge == null)
                    return;

                try
                {
                    string translated = Plugin.Bridge.Translate(value);
                    if (translated != value)
                    {
                        value = translated;
                    }
                }
                catch (Exception ex)
                {
                    Plugin.Log.LogWarning($"[LegacyText] Translation error: {ex.Message}");
                }
            }
        }

        /// <summary>
        /// Patch for TextMesh (3D text in world space)
        /// </summary>
        [HarmonyPatch]
        public static class TextMeshPatch
        {
            [HarmonyPatch("UnityEngine.TextMesh", "set_text")]
            [HarmonyPrefix]
            public static void Prefix(ref string value)
            {
                if (string.IsNullOrEmpty(value) || Plugin.Bridge == null)
                    return;

                try
                {
                    string translated = Plugin.Bridge.Translate(value);
                    if (translated != value)
                    {
                        value = translated;
                    }
                }
                catch (Exception ex)
                {
                    Plugin.Log.LogWarning($"[TextMesh] Translation error: {ex.Message}");
                }
            }
        }
    }
}
