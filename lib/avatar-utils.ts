// Utility per gestione avatar con gradienti

export const AVATAR_GRADIENTS = [
  { id: 'gradient-1', gradient: 'from-blue-500 to-purple-600', name: 'Blu-Viola' },
  { id: 'gradient-2', gradient: 'from-green-500 to-blue-600', name: 'Verde-Blu' },
  { id: 'gradient-3', gradient: 'from-purple-500 to-pink-600', name: 'Viola-Rosa' },
  { id: 'gradient-4', gradient: 'from-orange-500 to-red-600', name: 'Arancio-Rosso' },
  { id: 'gradient-5', gradient: 'from-teal-500 to-cyan-600', name: 'Teal-Ciano' },
  { id: 'gradient-6', gradient: 'from-indigo-500 to-purple-600', name: 'Indaco-Viola' },
];

export function getAvatarGradient(avatarPath: string | null | undefined): string {
  if (!avatarPath) {
    return 'from-blue-500 to-purple-600'; // Default gradient
  }
  
  const gradient = AVATAR_GRADIENTS.find(g => g.id === avatarPath);
  return gradient ? gradient.gradient : 'from-blue-500 to-purple-600';
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}