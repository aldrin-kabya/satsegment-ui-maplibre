import React from 'react';

const CLASSES = [
  { id: 1, name: 'Forest', color: 'rgba(0, 255, 255, 1)' }, // Cyan
  { id: 2, name: 'Urban', color: 'rgba(255, 0, 0, 1)' },    // Red
  { id: 3, name: 'Water', color: 'rgba(0, 0, 255, 1)' },    // Blue
  { id: 4, name: 'Farmland', color: 'rgba(0, 255, 0, 1)' }, // Green
  { id: 5, name: 'Meadow', color: 'rgba(255, 255, 0, 1)' }, // Yellow
];

const Legend = ({ activeClasses, onToggle }) => {
  return (
    <div className="absolute top-4 right-4 bg-white p-4 rounded shadow-lg z-20 max-w-xs border border-gray-200">
      <h3 className="font-bold mb-3 text-black border-b pb-2">LULC Classes</h3>
      <div className="space-y-2">
        {CLASSES.map((cls) => (
          <div key={cls.id} className="flex items-center justify-between group cursor-pointer" onClick={() => onToggle(cls.id)}>
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={activeClasses[cls.id]}
                onChange={() => {}} // Handled by parent div click
                className="mr-2 cursor-pointer"
              />
              <span
                className="w-4 h-4 inline-block mr-2 rounded border border-gray-400"
                style={{ backgroundColor: cls.color }}
              ></span>
              <span className="text-sm text-gray-800 select-none">{cls.name}</span>
            </div>
            {/* Percentage Placeholder */}
            <span className="text-xs text-gray-400 font-mono">--%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Legend;