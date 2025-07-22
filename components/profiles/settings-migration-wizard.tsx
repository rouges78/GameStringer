'use client';
import { useState } from "react";


import { useState } from "react";


import { useState } from "react";


import { useState } from "react";


import { useState } from "react";


import { useState } from "react";


import { useState } from "react";


import { useState } from "react";


import { it } from "date-fns/locale";


import { format } from "path";


import { invoke } from "@tauri-apps/api/core";


import { Shield } from "lucide-react";


import { FileText } from "lucide-react";


import { Loader2 } from "lucide-react";


import { CheckCircle } from "lucide-react";


import { AlertTriangle } from "lucide-react";


import { Settings } from "lucide-react";


import { Settings } from "lucide-react";


import { Settings } from "lucide-react";


import { Settings } from "lucide-react";


import { Settings } from "lucide-react";


import { Settings } from "lucide-react";


import { toast } from "sonner";


import { Progress } from "@radix-ui/react-progress";


import { AlertDescription } from "../ui/alert";


import { Alert } from "../ui/alert";


import { Alert } from "../ui/alert";


import { Checkbox } from "@radix-ui/react-checkbox";


import { DialogTitle } from "@radix-ui/react-dialog";


import { DialogHeader } from "../ui/dialog";


import { DialogFooter } from "../ui/dialog";


import { DialogDescription } from "@radix-ui/react-dialog";


import { DialogContent } from "@radix-ui/react-dialog";


import { Dialog } from "@radix-ui/react-dialog";


import { Dialog } from "@radix-ui/react-dialog";


import { Dialog } from "@radix-ui/react-dialog";


import { Dialog } from "@radix-ui/react-dialog";


import { Dialog } from "@radix-ui/react-dialog";


import { Dialog } from "@radix-ui/react-dialog";


import { CardTitle } from "../ui/card";


import { CardHeader } from "../ui/card";


import { CardFooter } from "../ui/card";


import { CardDescription } from "../ui/card";


import { CardContent } from "../ui/card";


import { Card } from "../ui/card";


import { Card } from "../ui/card";


import { Card } from "../ui/card";


import { Card } from "../ui/card";


import { Card } from "../ui/card";


import { Card } from "../ui/card";


import { Button } from "react-day-picker";


import { useEffect } from "react";


import { useState } from "react";


import { useState } from "react";

\n\nimport { useState, useEffect } from 'react';\nimport { Button } from '@/components/ui/button';\nimport { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';\nimport { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';\nimport { Checkbox } from '@/components/ui/checkbox';\nimport { Alert, AlertDescription } from '@/components/ui/alert';\nimport { Progress } from '@/components/ui/progress';\nimport { toast } from 'sonner';\nimport { Settings, AlertTriangle, CheckCircle, Loader2, FileText, Shield } from 'lucide-react';\nimport { invoke } from '@/lib/tauri-api';\nimport { format } from 'date-fns';\nimport { it } from 'date-fns/locale';\n\ninterface LegacySettingsInfo {\n  file_type: string;\n  file_path: string;\n  created_at: string;\n  file_size: number;\n}\n\ninterface LegacySettingsMigrationResult {\n  migrated_files: string[];\n  failed_files: [string, string][];\n  migrated_settings: string[];\n  total_migrated: number;\n  total_failed: number;\n  migrated_at: string;\n}\n\ninterface SettingsMigrationWizardProps {\n  isOpen: boolean;\n  onClose: () => void;\n  onComplete: () => void;\n}\n\nexport function SettingsMigrationWizard({ isOpen, onClose, onComplete }: SettingsMigrationWizardProps) {\n  const [step, setStep] = useState(0);\n  const [isLoading, setIsLoading] = useState(false);\n  const [hasLegacySettings, setHasLegacySettings] = useState(false);\n  const [legacyInfo, setLegacyInfo] = useState<LegacySettingsInfo[]>([]);\n  const [createBackup, setCreateBackup] = useState(true);\n  const [migrationResult, setMigrationResult] = useState<LegacySettingsMigrationResult | null>(null);\n  const [backupPaths, setBackupPaths] = useState<string[]>([]);\n  const [progress, setProgress] = useState(0);\n\n  const steps = [\n    'Verifica impostazioni legacy',\n    'Configurazione migrazione',\n    'Esecuzione migrazione',\n    'Completamento'\n  ];\n\n  // Verifica impostazioni legacy all'apertura\n  useEffect(() => {\n    if (isOpen) {\n      checkLegacySettings();\n    }\n  }, [isOpen]);\n\n  const checkLegacySettings = async () => {\n    setIsLoading(true);\n    try {\n      const hasLegacy = await invoke<any>('check_legacy_settings');\n      if (hasLegacy.success && hasLegacy.data) {\n        setHasLegacySettings(true);\n        \n        // Ottieni informazioni dettagliate\n        const info = await invoke<any>('get_legacy_settings_info');\n        if (info.success) {\n          setLegacyInfo(info.data || []);\n        }\n      } else {\n        setHasLegacySettings(false);\n      }\n    } catch (error) {\n      console.error('Errore verifica impostazioni legacy:', error);\n      toast.error('Errore durante la verifica delle impostazioni legacy');\n    } finally {\n      setIsLoading(false);\n    }\n  };\n\n  const nextStep = () => {\n    if (step < steps.length - 1) {\n      setStep(step + 1);\n      setProgress(((step + 1) / steps.length) * 100);\n    }\n  };\n\n  const prevStep = () => {\n    if (step > 0) {\n      setStep(step - 1);\n      setProgress((step / steps.length) * 100);\n    }\n  };\n\n  const executeMigration = async () => {\n    setIsLoading(true);\n    try {\n      // Step 1: Crea backup se richiesto\n      if (createBackup) {\n        const backupResult = await invoke<any>('backup_legacy_settings');\n        if (backupResult.success) {\n          setBackupPaths(backupResult.data || []);\n          toast.success('Backup delle impostazioni creato');\n        } else {\n          toast.error(`Errore backup: ${backupResult.error}`);\n          // Continua comunque con la migrazione\n        }\n      }\n\n      // Step 2: Esegui migrazione\n      const result = await invoke<any>('migrate_legacy_settings_to_profile');\n\n      if (result.success) {\n        setMigrationResult(result.data);\n        toast.success('Migrazione impostazioni completata con successo!');\n        nextStep();\n      } else {\n        toast.error(`Errore durante la migrazione: ${result.error}`);\n      }\n    } catch (error) {\n      console.error('Errore migrazione:', error);\n      toast.error('Errore durante la migrazione delle impostazioni');\n    } finally {\n      setIsLoading(false);\n    }\n  };\n\n  const handleClose = () => {\n    setStep(0);\n    setProgress(0);\n    setMigrationResult(null);\n    setBackupPaths([]);\n    onClose();\n  };\n\n  const handleComplete = () => {\n    onComplete();\n    handleClose();\n  };\n\n  const renderStepContent = () => {\n    switch (step) {\n      case 0: // Verifica impostazioni legacy\n        return (\n          <div className=\"space-y-4\">\n            {isLoading ? (\n              <div className=\"flex items-center justify-center py-8\">\n                <Loader2 className=\"h-8 w-8 animate-spin\" />\n                <span className=\"ml-2\">Verifica impostazioni legacy...</span>\n              </div>\n            ) : hasLegacySettings ? (\n              <div className=\"space-y-4\">\n                <Alert>\n                  <CheckCircle className=\"h-4 w-4\" />\n                  <AlertDescription>\n                    Trovate impostazioni legacy da migrare!\n                  </AlertDescription>\n                </Alert>\n                \n                <div className=\"space-y-2\">\n                  <h4 className=\"font-medium\">Impostazioni trovate:</h4>\n                  {legacyInfo.map((info, index) => (\n                    <div key={index} className=\"flex items-center justify-between p-3 border rounded-md\">\n                      <div className=\"flex items-center\">\n                        <FileText className=\"h-4 w-4 mr-2 text-blue-500\" />\n                        <div>\n                          <p className=\"font-medium\">{info.file_type}</p>\n                          <p className=\"text-sm text-muted-foreground\">\n                            Creato: {format(new Date(info.created_at), 'PPpp', { locale: it })}\n                          </p>\n                        </div>\n                      </div>\n                      <div className=\"text-sm text-muted-foreground\">\n                        {(info.file_size / 1024).toFixed(1)} KB\n                      </div>\n                    </div>\n                  ))}\n                </div>\n              </div>\n            ) : (\n              <Alert>\n                <AlertTriangle className=\"h-4 w-4\" />\n                <AlertDescription>\n                  Nessuna impostazione legacy trovata. La migrazione non è necessaria.\n                </AlertDescription>\n              </Alert>\n            )}\n          </div>\n        );\n\n      case 1: // Configurazione migrazione\n        return (\n          <div className=\"space-y-4\">\n            <div className=\"space-y-4\">\n              <h4 className=\"font-medium\">Opzioni migrazione impostazioni</h4>\n              \n              <div className=\"flex items-center space-x-2\">\n                <Checkbox \n                  id=\"backup-settings\" \n                  checked={createBackup} \n                  onCheckedChange={(checked) => setCreateBackup(checked as boolean)}\n                />\n                <label htmlFor=\"backup-settings\" className=\"text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70\">\n                  Crea backup delle impostazioni legacy prima della migrazione\n                </label>\n              </div>\n              \n              {createBackup && (\n                <Alert>\n                  <Shield className=\"h-4 w-4\" />\n                  <AlertDescription>\n                    Le impostazioni legacy verranno salvate in un file di backup prima di essere migrate.\n                  </AlertDescription>\n                </Alert>\n              )}\n            </div>\n            \n            <Alert>\n              <AlertTriangle className=\"h-4 w-4\" />\n              <AlertDescription>\n                <strong>Importante:</strong> Dopo la migrazione, le impostazioni legacy verranno rimosse dal sistema.\n                Le nuove impostazioni saranno associate al profilo attivo.\n              </AlertDescription>\n            </Alert>\n          </div>\n        );\n\n      case 2: // Esecuzione migrazione\n        return (\n          <div className=\"space-y-4\">\n            {isLoading ? (\n              <div className=\"space-y-4\">\n                <div className=\"flex items-center justify-center py-4\">\n                  <Loader2 className=\"h-8 w-8 animate-spin\" />\n                  <span className=\"ml-2\">Migrazione impostazioni in corso...</span>\n                </div>\n                <Progress value={progress} className=\"w-full\" />\n              </div>\n            ) : migrationResult ? (\n              <div className=\"space-y-4\">\n                <Alert>\n                  <CheckCircle className=\"h-4 w-4\" />\n                  <AlertDescription>\n                    Migrazione impostazioni completata!\n                  </AlertDescription>\n                </Alert>\n                \n                <div className=\"space-y-2\">\n                  <h4 className=\"font-medium\">File migrati:</h4>\n                  {migrationResult.migrated_files.map((file, index) => (\n                    <div key={index} className=\"flex items-center text-sm\">\n                      <CheckCircle className=\"h-4 w-4 mr-2 text-green-500\" />\n                      {file.split('\\\\').pop() || file}\n                    </div>\n                  ))}\n                  \n                  {migrationResult.migrated_settings.length > 0 && (\n                    <div className=\"space-y-1\">\n                      <h5 className=\"font-medium\">Impostazioni migrate:</h5>\n                      {migrationResult.migrated_settings.map((setting, index) => (\n                        <div key={index} className=\"text-sm text-muted-foreground ml-4\">\n                          • {setting}\n                        </div>\n                      ))}\n                    </div>\n                  )}\n                  \n                  {migrationResult.failed_files.length > 0 && (\n                    <div className=\"space-y-1\">\n                      <h5 className=\"font-medium text-red-600\">Errori:</h5>\n                      {migrationResult.failed_files.map(([file, error], index) => (\n                        <div key={index} className=\"flex items-center text-sm text-red-600\">\n                          <AlertTriangle className=\"h-4 w-4 mr-2\" />\n                          {file.split('\\\\').pop() || file}: {error}\n                        </div>\n                      ))}\n                    </div>\n                  )}\n                </div>\n              </div>\n            ) : (\n              <div className=\"text-center py-4\">\n                <Button onClick={executeMigration} disabled={isLoading}>\n                  Avvia migrazione impostazioni\n                </Button>\n              </div>\n            )}\n          </div>\n        );\n\n      case 3: // Completamento\n        return (\n          <div className=\"space-y-4 text-center\">\n            <CheckCircle className=\"h-16 w-16 mx-auto text-green-500\" />\n            <h3 className=\"text-lg font-medium\">Migrazione impostazioni completata!</h3>\n            \n            {migrationResult && (\n              <div className=\"space-y-2\">\n                <p className=\"text-sm text-muted-foreground\">\n                  {migrationResult.total_migrated} file di impostazioni migrati con successo\n                </p>\n                \n                {backupPaths.length > 0 && (\n                  <div className=\"text-xs text-muted-foreground\">\n                    <p>Backup salvati in:</p>\n                    {backupPaths.map((path, index) => (\n                      <p key={index} className=\"font-mono\">{path}</p>\n                    ))}\n                  </div>\n                )}\n              </div>\n            )}\n            \n            <p className=\"text-sm text-muted-foreground\">\n              Le tue impostazioni sono ora associate al profilo attivo.\n            </p>\n          </div>\n        );\n\n      default:\n        return null;\n    }\n  };\n\n  return (\n    <Dialog open={isOpen} onOpenChange={handleClose}>\n      <DialogContent className=\"max-w-2xl\">\n        <DialogHeader>\n          <DialogTitle>Migrazione Impostazioni Legacy</DialogTitle>\n          <DialogDescription>\n            Migra le impostazioni esistenti al sistema di profili\n          </DialogDescription>\n        </DialogHeader>\n        \n        <div className=\"space-y-6\">\n          {/* Progress indicator */}\n          <div className=\"space-y-2\">\n            <div className=\"flex justify-between text-sm\">\n              <span>Passo {step + 1} di {steps.length}</span>\n              <span>{steps[step]}</span>\n            </div>\n            <Progress value={progress} className=\"w-full\" />\n          </div>\n          \n          {/* Step content */}\n          <div className=\"min-h-[300px]\">\n            {renderStepContent()}\n          </div>\n        </div>\n        \n        <DialogFooter>\n          <div className=\"flex justify-between w-full\">\n            <Button \n              variant=\"outline\" \n              onClick={prevStep} \n              disabled={step === 0 || isLoading}\n            >\n              Indietro\n            </Button>\n            \n            <div className=\"space-x-2\">\n              <Button variant=\"outline\" onClick={handleClose}>\n                {step === steps.length - 1 ? 'Chiudi' : 'Annulla'}\n              </Button>\n              \n              {step < steps.length - 1 ? (\n                <Button \n                  onClick={nextStep} \n                  disabled={isLoading || (step === 0 && !hasLegacySettings)}\n                >\n                  Avanti\n                </Button>\n              ) : (\n                <Button onClick={handleComplete}>\n                  Completa\n                </Button>\n              )}\n            </div>\n          </div>\n        </DialogFooter>\n      </DialogContent>\n    </Dialog>\n  );\n}"