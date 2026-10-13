import { useSyncExternalStore } from 'react';
import type { DesignSettings, EnergySettings, Project, Settings } from '../types';
import { DEFAULT_SETTINGS, defaultDesign, defaultEnergy, withComputed } from './defaults';
import { buildSeedProjects } from './seed';

export { DEFAULT_SETTINGS };

const PROJECTS_KEY = 'doktersolar.projects.v1';
const SETTINGS_KEY = 'doktersolar.settings.v1';

/* ------------------------------------------------------------------ */
/* tiny external store over localStorage                               */
/* ------------------------------------------------------------------ */

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('DokterSolar: could not save to localStorage', err);
    alert('Could not save — browser storage may be full (try a smaller logo).');
  }
}

let settings: Settings = { ...DEFAULT_SETTINGS, ...(read<Partial<Settings>>(SETTINGS_KEY) ?? {}) };
let projects: Project[] = read<Project[]>(PROJECTS_KEY) ?? buildSeedProjects(settings);
if (!localStorage.getItem(PROJECTS_KEY)) write(PROJECTS_KEY, projects);

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

// keep multiple tabs in sync
window.addEventListener('storage', (e) => {
  if (e.key === PROJECTS_KEY) projects = read<Project[]>(PROJECTS_KEY) ?? [];
  if (e.key === SETTINGS_KEY) settings = { ...DEFAULT_SETTINGS, ...(read<Partial<Settings>>(SETTINGS_KEY) ?? {}) };
  emit();
});

function commitProjects(next: Project[]) {
  projects = next;
  write(PROJECTS_KEY, projects);
  emit();
}

export function useProjects(): Project[] {
  return useSyncExternalStore(subscribe, () => projects);
}

export function useProject(id: string | undefined): Project | undefined {
  return useSyncExternalStore(subscribe, () => projects.find((p) => p.id === id));
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, () => settings);
}

export function getSettings(): Settings {
  return settings;
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export type NewProjectInput = Pick<Project, 'customerName' | 'email' | 'phone' | 'address' | 'monthlyBill'> & {
  lat: number | null;
  lng: number | null;
};

export function createProject(input: NewProjectInput): Project {
  const now = new Date().toISOString();
  const p: Project = {
    id: newId(),
    ...input,
    status: 'Lead',
    notes: '',
    createdAt: now,
    updatedAt: now,
    design: defaultDesign(settings),
    energy: defaultEnergy(settings),
    panelCount: 0,
    systemKw: 0,
    proposalSentAt: null,
  };
  commitProjects([p, ...projects]);
  return p;
}

export function updateProject(id: string, patch: Partial<Project> | ((p: Project) => Partial<Project>)): void {
  commitProjects(
    projects.map((p) => {
      if (p.id !== id) return p;
      const changes = typeof patch === 'function' ? patch(p) : patch;
      let next: Project = { ...p, ...changes, updatedAt: new Date().toISOString() };
      if (changes.design) next = withComputed(next);
      if (changes.status === 'Proposal Sent' && !next.proposalSentAt) next.proposalSentAt = next.updatedAt;
      return next;
    }),
  );
}

export function updateDesign(id: string, patch: Partial<DesignSettings>): void {
  updateProject(id, (p) => ({ design: { ...p.design, ...patch } }));
}

export function updateEnergy(id: string, patch: Partial<EnergySettings>): void {
  updateProject(id, (p) => ({ energy: { ...p.energy, ...patch } }));
}

export function deleteProject(id: string): void {
  commitProjects(projects.filter((p) => p.id !== id));
}

export function updateSettings(patch: Partial<Settings>): void {
  settings = { ...settings, ...patch };
  write(SETTINGS_KEY, settings);
  emit();
}

export function resetDemoData(): void {
  settings = { ...DEFAULT_SETTINGS };
  write(SETTINGS_KEY, settings);
  commitProjects(buildSeedProjects(settings));
}
