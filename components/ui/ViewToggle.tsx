import React from 'react';
import { LayoutGrid, List } from 'lucide-react';

export type ViewMode = 'grid' | 'list';

export interface ViewToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

const ViewToggle: React.FC<ViewToggleProps> = ({ value, onChange }) => {
  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
      <button
        onClick={() => onChange('grid')}
        className={`p-2 rounded-md transition-colors ${
          value === 'grid'
            ? 'bg-white text-primary shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
        title="Visualização em cartões"
      >
        <LayoutGrid size={18} />
      </button>
      <button
        onClick={() => onChange('list')}
        className={`p-2 rounded-md transition-colors ${
          value === 'list'
            ? 'bg-white text-primary shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
        title="Visualização em lista"
      >
        <List size={18} />
      </button>
    </div>
  );
};

export default ViewToggle;

