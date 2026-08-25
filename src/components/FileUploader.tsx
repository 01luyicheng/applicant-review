import { useState, useId } from 'react';
import { useTranslation } from 'react-i18next';

interface FileUploaderProps {
  onLoad: (file: File) => Promise<void>;
  loading: boolean;
  acceptedTypes?: string[];
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // M2: 10MB 限制

export default function FileUploader({ onLoad, loading, acceptedTypes = ['.xlsx', '.xls', '.csv'] }: FileUploaderProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const [localError, setLocalError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragInvalid, setDragInvalid] = useState(false);

  const validateFile = (file: File): string | null => {
    const lower = file.name.toLowerCase();
    const okType = acceptedTypes.some(ext => lower.endsWith(ext.toLowerCase()));
    if (!okType) return t('upload.invalidType', { file: file.name, types: acceptedTypes.join(', ') });
    if (file.size > MAX_FILE_SIZE) return t('upload.fileTooLarge', { size: (file.size / 1024 / 1024).toFixed(1) });
    return null;
  };

  const isValidType = (name: string) => acceptedTypes.some(ext => name.toLowerCase().endsWith(ext.toLowerCase()));

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
    if (e.dataTransfer.files.length > 0) {
      setDragInvalid(!isValidType(e.dataTransfer.files[0].name));
    } else {
      setDragInvalid(false);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setDragInvalid(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setDragInvalid(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const err = validateFile(file);
    if (err) {
      setLocalError(err);
      console.warn(err);
      return;
    }
    setLocalError(null);
    onLoad(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateFile(file);
    if (err) {
      setLocalError(err);
      console.warn(err);
      e.target.value = '';
      return;
    }
    setLocalError(null);
    onLoad(file);
    e.target.value = '';
  };

  const borderClass = dragInvalid
    ? 'border-red-400 bg-red-50'
    : isDragging
      ? 'border-blue-400 bg-blue-50'
      : 'border-gray-300';

  return (
    <div
      className={`border-2 border-dashed rounded p-8 text-center transition-colors ${borderClass}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept={acceptedTypes.join(',')}
        onChange={handleChange}
        className="hidden"
        id={inputId}
        disabled={loading}
      />
      <label htmlFor={inputId} className="cursor-pointer">
        <div className="text-gray-500 mb-2">{t('upload.dragHint')} <code className="bg-gray-100 px-1 rounded">{acceptedTypes.join(', ')}</code></div>
        <div className="text-sm text-gray-400">{t('upload.hint')}</div>
        {loading && <div className="mt-2 text-sm text-gray-500">{t('upload.loading')}</div>}
        {localError && <div className="mt-2 text-sm text-red-600">{localError}</div>}
      </label>
      {dragInvalid && (
        <div className="mt-3 text-sm text-red-600 bg-red-100 border border-red-200 rounded px-3 py-2">
          {t('upload.dragInvalid', { types: acceptedTypes.join(' / ') })}
        </div>
      )}
    </div>
  );
}
