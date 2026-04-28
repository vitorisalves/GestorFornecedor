import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2 } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'info';
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger'
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[250] flex items-center justify-center p-4" onClick={onClose}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="bg-white w-full max-w-md p-8 rounded-[2.5rem] shadow-2xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`w-20 h-20 ${variant === 'danger' ? 'bg-red-50 text-red-500' : 'bg-indigo-50 text-indigo-500'} rounded-3xl flex items-center justify-center mx-auto mb-6`}>
              <Trash2 className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">{title}</h3>
            <p className="text-slate-500 font-medium mb-8">{message}</p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={onClose}
                className="py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl transition-all"
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                className={`py-4 ${variant === 'danger' ? 'bg-red-500 shadow-red-100 hover:bg-red-600' : 'bg-indigo-500 shadow-indigo-100 hover:bg-indigo-600'} text-white rounded-2xl font-bold shadow-lg transition-all`}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
