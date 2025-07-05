'use client';

import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button, Container, Title, Text, Group, Stack, Card, Code, Textarea, TextInput, Select } from '@mantine/core';

export default function TestCommandsPage() {
  const [results, setResults] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const testCommand = async (commandName: string, args: any = {}) => {
    setLoading(prev => ({ ...prev, [commandName]: true }));
    try {
      const result = await invoke(commandName, args);
      setResults(prev => ({ ...prev, [commandName]: { success: true, data: result } }));
      console.log(`✅ ${commandName}:`, result);
    } catch (error) {
      setResults(prev => ({ ...prev, [commandName]: { success: false, error: error } }));
      console.error(`❌ ${commandName}:`, error);
    } finally {
      setLoading(prev => ({ ...prev, [commandName]: false }));
    }
  };

  const testAllCommands = async () => {
    console.log('🧪 Avvio test completo di tutti i comandi Tauri...');
    
    // Test Steam Commands
    await testCommand('auto_detect_steam_config');
    await testCommand('get_steam_games', { 
      apiKey: 'demo_key', 
      steamId: 'demo_id', 
      forceRefresh: false 
    });
    await testCommand('get_game_details', { appid: '730' }); // Counter-Strike 2
    
    // Test Library Commands
    await testCommand('get_library_games');
    await testCommand('get_game_path', { gameId: 'test_game' });
    await testCommand('read_game_file', { filePath: 'test.txt' });
    await testCommand('scan_game_files', { gamePath: 'C:\\Games\\TestGame' });
    
    // Test Games Commands
    await testCommand('get_games');
    await testCommand('get_game_by_id', { gameId: 'test_game_id' });
    await testCommand('scan_games');
    
    // Test Utilities Commands
    await testCommand('get_howlongtobeat_info', { gameName: 'Cyberpunk 2077' });
    await testCommand('get_steamgriddb_artwork', { appId: '730', artworkType: 'grid' });
    await testCommand('get_preferences');
    await testCommand('get_cache_stats');
    
    // Test Patches Commands
    await testCommand('get_patches', { patchId: null });
    await testCommand('translate_text', { 
      text: 'Hello World', 
      provider: 'openai', 
      apiKey: 'test_key', 
      targetLang: 'it' 
    });
    await testCommand('get_translation_suggestions', { 
      text: 'New Game', 
      context: 'menu' 
    });
    
    // Test Injekt Commands
    await testCommand('test_injection');
    await testCommand('get_processes');
    await testCommand('get_injection_stats', { processId: null });
    
    console.log('✅ Test completo terminato!');
  };

  const renderResult = (commandName: string) => {
    const result = results[commandName];
    const isLoading = loading[commandName];
    
    if (isLoading) {
      return <Text c="blue">⏳ Caricamento...</Text>;
    }
    
    if (!result) {
      return <Text c="gray">Non testato</Text>;
    }
    
    if (result.success) {
      return (
        <div>
          <Text c="green">✅ Successo</Text>
          <Code block mt="xs" style={{ maxHeight: '200px', overflow: 'auto' }}>
            {JSON.stringify(result.data, null, 2)}
          </Code>
        </div>
      );
    } else {
      return (
        <div>
          <Text c="red">❌ Errore</Text>
          <Code block mt="xs" c="red">
            {String(result.error)}
          </Code>
        </div>
      );
    }
  };

  const steamCommands = [
    'auto_detect_steam_config',
    'get_steam_games', 
    'get_game_details',
    'fix_steam_id'
  ];

  const libraryCommands = [
    'get_library_games',
    'get_game_path',
    'read_game_file',
    'scan_game_files'
  ];

  const gamesCommands = [
    'get_games',
    'get_game_by_id',
    'scan_games'
  ];

  const utilitiesCommands = [
    'get_howlongtobeat_info',
    'get_steamgriddb_artwork',
    'get_preferences',
    'update_preferences',
    'clear_cache',
    'get_cache_stats'
  ];

  const patchesCommands = [
    'get_patches',
    'create_patch',
    'update_patch',
    'export_patch',
    'translate_text',
    'get_translation_suggestions',
    'export_translations',
    'import_translations'
  ];

  const injektCommands = [
    'start_injection',
    'stop_injection',
    'get_injection_stats',
    'test_injection',
    'get_processes',
    'get_process_info',
    'inject_translation',
    'scan_process_memory'
  ];

  return (
    <Container size="xl" py="xl">
      <Title order={1} mb="xl">🧪 Test Comandi Tauri</Title>
      
      <Group mb="xl">
        <Button 
          onClick={testAllCommands}
          size="lg"
          loading={Object.values(loading).some(Boolean)}
        >
          🚀 Test Tutti i Comandi
        </Button>
        <Button 
          variant="outline" 
          onClick={() => {
            setResults({});
            console.clear();
          }}
        >
          🧹 Pulisci Risultati
        </Button>
      </Group>

      <Stack gap="xl">
        {/* Steam Commands */}
        <Card withBorder>
          <Title order={2} mb="md">🎮 Steam Commands</Title>
          <Stack gap="md">
            {steamCommands.map(cmd => (
              <div key={cmd}>
                <Group justify="space-between" mb="xs">
                  <Text fw={500}>{cmd}</Text>
                  <Button 
                    size="xs" 
                    onClick={() => {
                      if (cmd === 'get_steam_games') {
                        testCommand(cmd, { apiKey: 'demo_key', steamId: 'demo_id', forceRefresh: false });
                      } else if (cmd === 'get_game_details') {
                        testCommand(cmd, { appid: '730' });
                      } else if (cmd === 'fix_steam_id') {
                        testCommand(cmd, { newSteamId: 'new_demo_id' });
                      } else {
                        testCommand(cmd);
                      }
                    }}
                    loading={loading[cmd]}
                  >
                    Test
                  </Button>
                </Group>
                {renderResult(cmd)}
              </div>
            ))}
          </Stack>
        </Card>

        {/* Library Commands */}
        <Card withBorder>
          <Title order={2} mb="md">📚 Library Commands</Title>
          <Stack gap="md">
            {libraryCommands.map(cmd => (
              <div key={cmd}>
                <Group justify="space-between" mb="xs">
                  <Text fw={500}>{cmd}</Text>
                  <Button 
                    size="xs" 
                    onClick={() => {
                      if (cmd === 'get_game_path') {
                        testCommand(cmd, { gameId: 'test_game' });
                      } else if (cmd === 'read_game_file') {
                        testCommand(cmd, { filePath: 'test.txt' });
                      } else if (cmd === 'scan_game_files') {
                        testCommand(cmd, { gamePath: 'C:\\Games\\TestGame' });
                      } else {
                        testCommand(cmd);
                      }
                    }}
                    loading={loading[cmd]}
                  >
                    Test
                  </Button>
                </Group>
                {renderResult(cmd)}
              </div>
            ))}
          </Stack>
        </Card>

        {/* Games Commands */}
        <Card withBorder>
          <Title order={2} mb="md">🎯 Games Commands</Title>
          <Stack gap="md">
            {gamesCommands.map(cmd => (
              <div key={cmd}>
                <Group justify="space-between" mb="xs">
                  <Text fw={500}>{cmd}</Text>
                  <Button 
                    size="xs" 
                    onClick={() => {
                      if (cmd === 'get_game_by_id') {
                        testCommand(cmd, { gameId: 'test_game_id' });
                      } else {
                        testCommand(cmd);
                      }
                    }}
                    loading={loading[cmd]}
                  >
                    Test
                  </Button>
                </Group>
                {renderResult(cmd)}
              </div>
            ))}
          </Stack>
        </Card>

        {/* Utilities Commands */}
        <Card withBorder>
          <Title order={2} mb="md">🔧 Utilities Commands</Title>
          <Stack gap="md">
            {utilitiesCommands.map(cmd => (
              <div key={cmd}>
                <Group justify="space-between" mb="xs">
                  <Text fw={500}>{cmd}</Text>
                  <Button 
                    size="xs" 
                    onClick={() => {
                      if (cmd === 'get_howlongtobeat_info') {
                        testCommand(cmd, { gameName: 'Cyberpunk 2077' });
                      } else if (cmd === 'get_steamgriddb_artwork') {
                        testCommand(cmd, { appId: '730', artworkType: 'grid' });
                      } else if (cmd === 'update_preferences') {
                        testCommand(cmd, { preferences: { theme: 'dark', language: 'it' } });
                      } else {
                        testCommand(cmd);
                      }
                    }}
                    loading={loading[cmd]}
                  >
                    Test
                  </Button>
                </Group>
                {renderResult(cmd)}
              </div>
            ))}
          </Stack>
        </Card>

        {/* Patches Commands */}
        <Card withBorder>
          <Title order={2} mb="md">🔨 Patches Commands</Title>
          <Stack gap="md">
            {patchesCommands.map(cmd => (
              <div key={cmd}>
                <Group justify="space-between" mb="xs">
                  <Text fw={500}>{cmd}</Text>
                  <Button 
                    size="xs" 
                    onClick={() => {
                      if (cmd === 'get_patches') {
                        testCommand(cmd, { patchId: null });
                      } else if (cmd === 'translate_text') {
                        testCommand(cmd, { 
                          text: 'Hello World', 
                          provider: 'openai', 
                          apiKey: 'test_key', 
                          targetLang: 'it' 
                        });
                      } else if (cmd === 'get_translation_suggestions') {
                        testCommand(cmd, { text: 'New Game', context: 'menu' });
                      } else if (cmd === 'create_patch') {
                        testCommand(cmd, { 
                          options: { name: 'Test Patch' }, 
                          translations: [{ original: 'Hello', translated: 'Ciao' }] 
                        });
                      } else if (cmd === 'export_translations') {
                        testCommand(cmd, { format: 'json', filter: null });
                      } else if (cmd === 'import_translations') {
                        testCommand(cmd, { filePath: 'test.json', format: 'json' });
                      } else {
                        testCommand(cmd);
                      }
                    }}
                    loading={loading[cmd]}
                  >
                    Test
                  </Button>
                </Group>
                {renderResult(cmd)}
              </div>
            ))}
          </Stack>
        </Card>

        {/* Injekt Commands */}
        <Card withBorder>
          <Title order={2} mb="md">💉 Injekt Commands</Title>
          <Stack gap="md">
            {injektCommands.map(cmd => (
              <div key={cmd}>
                <Group justify="space-between" mb="xs">
                  <Text fw={500}>{cmd}</Text>
                  <Button 
                    size="xs" 
                    onClick={() => {
                      if (cmd === 'start_injection') {
                        testCommand(cmd, { 
                          processId: 1234, 
                          processName: 'test.exe', 
                          config: { enabled: true } 
                        });
                      } else if (cmd === 'stop_injection') {
                        testCommand(cmd, { processId: 1234 });
                      } else if (cmd === 'get_injection_stats') {
                        testCommand(cmd, { processId: null });
                      } else if (cmd === 'get_process_info') {
                        testCommand(cmd, { processId: 1234 });
                      } else if (cmd === 'inject_translation') {
                        testCommand(cmd, { 
                          processId: 1234, 
                          originalText: 'Hello', 
                          translatedText: 'Ciao',
                          position: null 
                        });
                      } else if (cmd === 'scan_process_memory') {
                        testCommand(cmd, { processId: 1234, pattern: 'test_pattern' });
                      } else {
                        testCommand(cmd);
                      }
                    }}
                    loading={loading[cmd]}
                  >
                    Test
                  </Button>
                </Group>
                {renderResult(cmd)}
              </div>
            ))}
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}
