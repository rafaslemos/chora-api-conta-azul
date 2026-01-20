import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

export interface DropdownMenuItem {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'destructive';
}

export interface DropdownMenuProps {
  items: DropdownMenuItem[];
  trigger: React.ReactNode;
  align?: 'left' | 'right';
}

const DropdownMenu: React.FC<DropdownMenuProps> = ({ items, trigger, align = 'right' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        triggerRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen && triggerRef.current) {
      // Calcular posição do trigger
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
      
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  const handleItemClick = (item: DropdownMenuItem) => {
    if (!item.disabled) {
      item.onClick();
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      <div ref={triggerRef} onClick={() => setIsOpen(!isOpen)}>
        {trigger}
      </div>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100]"
            onClick={() => setIsOpen(false)}
          />
          <motion.div
            key="menu"
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15 }}
            className="fixed z-[101] w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1"
            style={{
              top: `${position.top}px`,
              right: align === 'right' ? `${position.right}px` : 'auto',
              left: align === 'left' ? `${window.innerWidth - position.right - 192}px` : 'auto',
              visibility: position.top > 0 ? 'visible' : 'hidden',
            }}
          >
            {items.map((item, index) => {
              // Separador
              if (item.label === '---') {
                return (
                  <div key={`separator-${index}`} className="my-1 border-t border-gray-200" />
                );
              }

              const Icon = item.icon;
              const isDestructive = item.variant === 'destructive';

              return (
                <button
                  key={index}
                  onClick={() => handleItemClick(item)}
                  disabled={item.disabled}
                  className={`w-full px-4 py-2 text-sm flex items-center gap-3 transition-colors ${
                    isDestructive
                      ? 'text-red-600 hover:bg-red-50'
                      : 'text-gray-700 hover:bg-gray-50'
                  } ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {Icon && <Icon size={16} className="flex-shrink-0" />}
                  <span className="flex-1 text-left">{item.label}</span>
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

export default DropdownMenu;

