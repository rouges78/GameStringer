import React from 'react';
import { Clock, PlusSquare, CheckSquare } from 'lucide-react';
import { HowLongToBeatData } from '@/lib/types';

interface HowLongToBeatDisplayProps {
  data: HowLongToBeatData | undefined;
}

const HowLongToBeatDisplay: React.FC<HowLongToBeatDisplayProps> = ({ data }) => {
  if (!data || (data.main === 0 && data.mainExtra === 0 && data.completionist === 0)) {
    return (
      <div className="text-xs text-gray-500 mt-2 flex items-center">
        <Clock className="h-4 w-4 mr-1.5 flex-shrink-0" />
        <span>Durata non disponibile</span>
      </div>
    );
  }

  const formatHours = (hours: number) => {
    if (hours <= 0) return null;
    return `${Math.round(hours)}h`;
  };

  return (
    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
      <div className="flex justify-around text-xs text-gray-600 dark:text-gray-400">
        {data.main > 0 && (
          <div className="flex flex-col items-center" title="Storia Principale">
            <Clock className="h-4 w-4 mb-1" />
            <span className="font-semibold">{formatHours(data.main)}</span>
          </div>
        )}
        {data.mainExtra > 0 && (
          <div className="flex flex-col items-center" title="Storia + Extra">
            <PlusSquare className="h-4 w-4 mb-1" />
            <span className="font-semibold">{formatHours(data.mainExtra)}</span>
          </div>
        )}
        {data.completionist > 0 && (
          <div className="flex flex-col items-center" title="Completista">
            <CheckSquare className="h-4 w-4 mb-1" />
            <span className="font-semibold">{formatHours(data.completionist)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default HowLongToBeatDisplay;
