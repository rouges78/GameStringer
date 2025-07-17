'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Shield, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Key,
  Copy,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { useLogging } from '@/hooks/useLogging';
import { toast } from 'sonner';

interface SecretInfo {
  key: string;
  description: string;
  isRequired: boolean;
  isConfigured: boolean;
}

interface SecretsStatus {
  total: number;
  configured: number;
  required: number;
  requiredConfigured: number;
  missing: string[];
  invalid: string[];
}

interface SecretsData {
  summary: SecretsStatus;
  secrets: SecretInfo[];
  isProduction: boolean;
  timestamp: string;
}

export function SecretsDashboard() {
  const [data, setData] = useState<SecretsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSecret, setSelectedSecret] = useState<string | null>(null);
  const [testValue, setTestValue] = useState('');
  const [showTestValue, setShowTestValue] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ isValid: boolean; message: string } | null>(null);
  const [generatedKey, setGeneratedKey] = useState('');

  const { logUserAction } = useLogging({ component: 'SECRETS_DASHBOARD' });

  const fetchSecretsStatus = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/secrets/status');
      if (!response.ok) {
        throw new Error('Failed to fetch secrets status');
      }
      const result = await response.json();
      setData(result.data);
    } catch (error) {
      console.error('Error fetching secrets status:', error);
      toast.error('Failed to load secrets status');
    } finally {
      setIsLoading(false);
    }
  };

  const validateSecret = async (key: string, value: string) => {
    setIsValidating(true);
    setValidationResult(null);
    
    try {
      const response = await fetch('/api/secrets/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'validate',
          key,
          value
        })
      });

      if (!response.ok) {
        throw new Error('Failed to validate secret');
      }

      const result = await response.json();
      setValidationResult(result.data);
      logUserAction('validate_secret', { key });
    } catch (error) {
      console.error('Error validating secret:', error);
      toast.error('Failed to validate secret');
    } finally {
      setIsValidating(false);
    }
  };

  const generateSecretKey = async (length: number = 32) => {
    try {
      const response = await fetch('/api/secrets/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'generate',
          length
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate secret key');
      }

      const result = await response.json();
      setGeneratedKey(result.data.generatedKey);
      logUserAction('generate_secret_key', { length });
      toast.success('Secret key generated successfully');
    } catch (error) {
      console.error('Error generating secret key:', error);
      toast.error('Failed to generate secret key');
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      toast.error('Failed to copy to clipboard');
    }
  };

  const getSecretStatusColor = (secret: SecretInfo) => {
    if (secret.isRequired && !secret.isConfigured) {
      return 'bg-red-100 text-red-800';
    }
    if (secret.isConfigured) {
      return 'bg-green-100 text-green-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  const getSecretStatusIcon = (secret: SecretInfo) => {
    if (secret.isRequired && !secret.isConfigured) {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    if (secret.isConfigured) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
  };

  const getApiDocumentationLink = (key: string) => {
    const links: Record<string, string> = {
      STEAM_API_KEY: 'https://steamcommunity.com/dev/apikey',
      STEAMGRIDDB_API_KEY: 'https://www.steamgriddb.com/profile/preferences/api',
      EPIC_CLIENT_ID: 'https://dev.epicgames.com/portal/',
      ITCHIO_CLIENT_ID: 'https://itch.io/user/settings/api-keys',
      OPENAI_API_KEY: 'https://platform.openai.com/api-keys',
      ABACUSAI_API_KEY: 'https://abacus.ai/app/profile/api-keys'
    };
    return links[key];
  };

  useEffect(() => {
    fetchSecretsStatus();
  }, []);

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Secrets Management</h1>
          <p className="text-muted-foreground">Manage API keys and secure configuration</p>
        </div>
        <Button onClick={fetchSecretsStatus} disabled={isLoading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {data && (
        <>
          {/* Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Secrets</CardTitle>
                <Key className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.summary.total}</div>
                <p className="text-xs text-muted-foreground">
                  {data.summary.configured} configured
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Required</CardTitle>
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.summary.required}</div>
                <p className="text-xs text-muted-foreground">
                  {data.summary.requiredConfigured} configured
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Missing</CardTitle>
                <XCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{data.summary.missing.length}</div>
                <p className="text-xs text-muted-foreground">
                  Required secrets missing
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Environment</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.isProduction ? 'PROD' : 'DEV'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {data.isProduction ? 'Production' : 'Development'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Missing Secrets Alert */}
          {data.summary.missing.length > 0 && (
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong>Missing Required Secrets:</strong> {data.summary.missing.join(', ')}
                <br />
                The application may not function properly without these secrets.
              </AlertDescription>
            </Alert>
          )}

          {/* Invalid Secrets Alert */}
          {data.summary.invalid.length > 0 && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                <strong>Invalid Secrets:</strong> {data.summary.invalid.join(', ')}
                <br />
                These secrets have invalid formats and should be updated.
              </AlertDescription>
            </Alert>
          )}

          {/* Tabs */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="validator">Validator</TabsTrigger>
              <TabsTrigger value="generator">Generator</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Secrets Configuration</CardTitle>
                  <CardDescription>
                    Current status of all configured secrets
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4">
                      {data.secrets.map((secret) => (
                        <div
                          key={secret.key}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50"
                        >
                          <div className="flex items-center space-x-3">
                            {getSecretStatusIcon(secret)}
                            <div>
                              <div className="font-medium">{secret.key}</div>
                              <div className="text-sm text-muted-foreground">
                                {secret.description}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge className={getSecretStatusColor(secret)}>
                              {secret.isRequired ? 'Required' : 'Optional'}
                            </Badge>
                            <Badge variant={secret.isConfigured ? 'default' : 'secondary'}>
                              {secret.isConfigured ? 'Configured' : 'Not Set'}
                            </Badge>
                            {getApiDocumentationLink(secret.key) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(getApiDocumentationLink(secret.key), '_blank')}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="validator" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Secret Validator</CardTitle>
                  <CardDescription>
                    Validate secret formats before adding them to your environment
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="secret-key">Secret Key</Label>
                      <select
                        id="secret-key"
                        value={selectedSecret || ''}
                        onChange={(e) => setSelectedSecret(e.target.value)}
                        className="w-full p-2 border rounded-md"
                      >
                        <option value="">Select a secret...</option>
                        {data.secrets.map((secret) => (
                          <option key={secret.key} value={secret.key}>
                            {secret.key} - {secret.description}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="secret-value">Secret Value</Label>
                      <div className="relative">
                        <Input
                          id="secret-value"
                          type={showTestValue ? 'text' : 'password'}
                          value={testValue}
                          onChange={(e) => setTestValue(e.target.value)}
                          placeholder="Enter secret value to validate..."
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute right-2 top-1/2 transform -translate-y-1/2"
                          onClick={() => setShowTestValue(!showTestValue)}
                        >
                          {showTestValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    onClick={() => selectedSecret && validateSecret(selectedSecret, testValue)}
                    disabled={!selectedSecret || !testValue || isValidating}
                    className="w-full"
                  >
                    {isValidating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Validating...
                      </>
                    ) : (
                      'Validate Secret'
                    )}
                  </Button>
                  
                  {validationResult && (
                    <Alert className={validationResult.isValid ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                      {validationResult.isValid ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <AlertDescription className={validationResult.isValid ? 'text-green-800' : 'text-red-800'}>
                        {validationResult.message}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="generator" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Secret Generator</CardTitle>
                  <CardDescription>
                    Generate secure random keys for your application
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Button onClick={() => generateSecretKey(32)}>
                      Generate 32-char Key
                    </Button>
                    <Button onClick={() => generateSecretKey(64)} variant="outline">
                      Generate 64-char Key
                    </Button>
                  </div>
                  
                  {generatedKey && (
                    <div className="space-y-2">
                      <Label>Generated Key</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          value={generatedKey}
                          readOnly
                          className="font-mono text-sm"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(generatedKey)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <Alert className="border-blue-200 bg-blue-50">
                        <AlertTriangle className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="text-blue-800">
                          Copy this key to your .env.local file. It will not be shown again.
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}