using BepInEx;
using BepInEx.Logging;
using HarmonyLib;
using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using UnityEngine;
using UnityEngine.UIElements;

namespace UIToolkitTranslator
{
    [BepInPlugin(PluginInfo.PLUGIN_GUID, PluginInfo.PLUGIN_NAME, PluginInfo.PLUGIN_VERSION)]
    public class Plugin : BaseUnityPlugin
    {
        internal static ManualLogSource Log;
        internal static Dictionary<string, string> Translations = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        internal static FieldInfo TextField;
        internal static HashSet<int> Processing = new HashSet<int>();
        private Harmony _harmony;

        private void Awake()
        {
            Log = Logger;
            LoadTranslations();
            
            // Trova il campo interno m_Text
            TextField = typeof(TextElement).GetField("m_Text", BindingFlags.NonPublic | BindingFlags.Instance);
            if (TextField == null)
            {
                Logger.LogError("Cannot find m_Text field!");
                return;
            }
            
            _harmony = new Harmony(PluginInfo.PLUGIN_GUID);
            
            // Patch TextElement.text setter con Postfix
            var textSetter = typeof(TextElement).GetProperty("text")?.GetSetMethod();
            if (textSetter != null)
            {
                _harmony.Patch(textSetter, 
                    postfix: new HarmonyMethod(typeof(Patches).GetMethod(nameof(Patches.TextElement_SetText_Postfix))));
                Logger.LogInfo("Patched TextElement.text with Postfix");
            }
            
            Logger.LogInfo($"Plugin loaded! {Translations.Count} translations.");
        }

        private void LoadTranslations()
        {
            string configPath = Path.Combine(Paths.ConfigPath, "UIToolkitTranslations.txt");
            
            if (!File.Exists(configPath))
                CreateDefaultTranslations(configPath);

            try
            {
                foreach (var line in File.ReadAllLines(configPath))
                {
                    if (string.IsNullOrWhiteSpace(line) || line.StartsWith("//") || line.StartsWith("#"))
                        continue;

                    var parts = line.Split(new[] { '=' }, 2);
                    if (parts.Length == 2)
                    {
                        var key = parts[0].Trim();
                        var value = parts[1].Trim();
                        if (!string.IsNullOrEmpty(key) && !Translations.ContainsKey(key))
                            Translations[key] = value;
                    }
                }
            }
            catch (Exception ex)
            {
                Logger.LogError($"Load error: {ex.Message}");
            }
        }

        private void CreateDefaultTranslations(string path)
        {
            File.WriteAllText(path, @"// UI Toolkit Translations
New Game=Nuova Partita
Continue=Continua
Load Game=Carica Partita
Save Game=Salva Partita
Options=Opzioni
Settings=Impostazioni
Quit=Esci
Exit=Esci
Main Menu=Menu Principale
Resume=Riprendi
Back=Indietro
Apply=Applica
Cancel=Annulla
Yes=Sì
No=No
Confirm=Conferma
Close=Chiudi
Graphics=Grafica
Audio=Audio
Controls=Controlli
Gameplay=Gameplay
Display=Schermo
Low=Basso
Medium=Medio
High=Alto
Ultra=Ultra
On=Attivo
Off=Disattivo
");
        }
    }

    public static class PluginInfo
    {
        public const string PLUGIN_GUID = "com.gamestringer.uitoolkittranslator";
        public const string PLUGIN_NAME = "UIToolkitTranslator";
        public const string PLUGIN_VERSION = "1.5.0";
    }

    public static class Patches
    {
        public static void TextElement_SetText_Postfix(TextElement __instance)
        {
            if (__instance == null || Plugin.TextField == null)
                return;

            int hash = __instance.GetHashCode();
            if (Plugin.Processing.Contains(hash))
                return;

            try
            {
                Plugin.Processing.Add(hash);
                
                string currentText = (string)Plugin.TextField.GetValue(__instance);
                if (string.IsNullOrWhiteSpace(currentText))
                    return;

                string trimmed = currentText.Trim();
                if (Plugin.Translations.TryGetValue(trimmed, out string translated) && currentText != translated)
                {
                    Plugin.Log?.LogInfo($"[POSTFIX] '{trimmed}' => '{translated}'");
                    
                    // Imposta direttamente il campo interno
                    Plugin.TextField.SetValue(__instance, translated);
                    
                    // Forza il repaint
                    __instance.MarkDirtyRepaint();
                }
            }
            finally
            {
                Plugin.Processing.Remove(hash);
            }
        }
    }
}
