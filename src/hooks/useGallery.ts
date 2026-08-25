// SPDX-License-Identifier: MIT
import { useCallback } from 'react';
import type { ViewConfig } from '../types';
import { saveConfig, validateConfig, getConfigValidationErrors } from '../config';
import { reportError } from '../utils/logger';
import { useTranslation } from 'react-i18next';
import { usePersistence } from './usePersistence';

export const GALLERY_OPTIONS = [
  { value: 'generic', path: '/config-examples/generic.json', labelKey: 'gallery.generic', descKey: 'gallery.descGeneric' },
  { value: 'hackathon', path: '/config-examples/hackathon.json', labelKey: 'gallery.hackathon', descKey: 'gallery.descHackathon' },
  { value: 'campus-recruit', path: '/config-examples/campus-recruit.json', labelKey: 'gallery.campus', descKey: 'gallery.descCampus' },
  { value: 'scholarship', path: '/config-examples/scholarship.json', labelKey: 'gallery.scholarship', descKey: 'gallery.descScholarship' },
  { value: 'vendor', path: '/config-examples/vendor.json', labelKey: 'gallery.vendor', descKey: 'gallery.descVendor' },
] as const;

export function useGallery(opts: {
  setConfig: React.Dispatch<React.SetStateAction<ViewConfig>>;
  setConfigError: React.Dispatch<React.SetStateAction<string | null>>;
  setConfigLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setApplicants: React.Dispatch<React.SetStateAction<import('../types').Applicant[]>>;
  setSelectedApplicant: React.Dispatch<React.SetStateAction<import('../types').Applicant | null>>;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  showToast: (m: string) => void;
}) {
  const { t } = useTranslation();
  const { clear } = usePersistence();
  const { setConfig, setConfigError, setConfigLoading, setApplicants, setSelectedApplicant, setCurrentPage, showToast } = opts;

  const handleConfigLoad = useCallback(async (file: File) => {
    setConfigLoading(true); setConfigError(null);
    try {
      const text = await file.text(); const parsed = JSON.parse(text);
      const errors = getConfigValidationErrors(parsed);
      if (errors.length) throw new Error(t('error.invalidConfigDetails', { details: errors.join('；') }));
      if (!validateConfig(parsed)) throw new Error(t('error.invalidConfig'));
      setConfig(parsed); saveConfig(parsed);
      setApplicants([]); setSelectedApplicant(null); setCurrentPage(1); clear();
    } catch (err) {
      setConfigError(t('error.configLoadFailed', { message: (err as Error).message }));
      reportError(err, { source: 'handleConfigLoad' });
    } finally { setConfigLoading(false); }
  }, [setConfig, setConfigError, setConfigLoading, setApplicants, setSelectedApplicant, setCurrentPage, clear, t]);

  const handleLoadExample = useCallback(async (path: string) => {
    if (!path) return;
    setConfigLoading(true); setConfigError(null);
    try {
      const res = await fetch(path, { cache: 'no-cache' });
      if (!res.ok) throw new Error(t('error.fetchFailed', { status: res.status, statusText: res.statusText }));
      const json = await res.json();
      const errors = getConfigValidationErrors(json);
      if (errors.length) throw new Error(t('error.exampleInvalidDetails', { details: errors.join('；') }));
      if (!validateConfig(json)) throw new Error(t('error.exampleInvalid'));
      setConfig(json as ViewConfig); saveConfig(json as ViewConfig); clear();
      setApplicants([]); setSelectedApplicant(null); setCurrentPage(1);
      showToast(t('toast.configSwitched', { title: (json as ViewConfig).title }));
    } catch (err) {
      setConfigError(t('error.exampleLoadFailed', { message: (err as Error).message }));
      reportError(err, { source: 'handleLoadExample', configUrl: path });
    } finally { setConfigLoading(false); }
  }, [showToast, setConfig, setConfigError, setConfigLoading, setCurrentPage, setApplicants, setSelectedApplicant, clear, t]);

  const handleClearCache = useCallback((): boolean => {
    if (!confirm(t('confirm.clearCache'))) return false;
    try { clear(); } catch {}
    setApplicants([]); setSelectedApplicant(null); setCurrentPage(1);
    return true;
  }, [clear, setApplicants, setSelectedApplicant, setCurrentPage, t]);

  return { GALLERY_OPTIONS, handleConfigLoad, handleLoadExample, handleClearCache };
}
