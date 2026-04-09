import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurriculum } from '../hooks/useCurriculum.js';

interface Props {
  onClose: () => void;
}

const STORAGE_KEY = 'me-recent-searches';

function getRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]').slice(0, 5);
  } catch {
    return [];
  }
}

function addRecent(query: string) {
  const previous = getRecent().filter((entry) => entry !== query);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([query, ...previous].slice(0, 5)));
}

export function SearchOverlay({ onClose }: Props) {
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<string[]>(getRecent);
  const [selectedTrack, setSelectedTrack] = useState<string>('all');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { data } = useCurriculum();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const normalizedQuery = query.trim().toLowerCase();
  const trackOptions = useMemo(() => {
    return [{ id: 'all', label: 'All Tracks' }, ...(data?.tracks ?? [])];
  }, [data?.tracks]);

  const trackLabels = useMemo(() => {
    return new Map((data?.tracks ?? []).map((track) => [track.id, track.label]));
  }, [data?.tracks]);

  const results = useMemo(() => {
    if (normalizedQuery.length <= 1) return [];

    return (data?.modules ?? [])
      .filter((module) => selectedTrack === 'all' || module.track === selectedTrack)
      .filter((module) => {
        return module.title.toLowerCase().includes(normalizedQuery)
          || module.summary.toLowerCase().includes(normalizedQuery);
      })
      .slice(0, 6);
  }, [data?.modules, normalizedQuery, selectedTrack]);

  const goToModule = (moduleId: string, trackId: string, label: string) => {
    addRecent(label);
    setRecent(getRecent());
    navigate(`/track/${trackId}/module/${moduleId}`);
    onClose();
  };

  return (
    <div
      className="modal-backdrop search-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="search-panel" onClick={(event) => event.stopPropagation()}>
        <div className="search-input-row">
          <svg
            className="search-icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            className="search-input"
            placeholder="Search modules by title or summary..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search"
          />
          <kbd className="search-esc" aria-label="Press Escape to close">ESC</kbd>
        </div>

        <div className="search-section">
          <p className="search-section-label">Tracks</p>
          <div className="search-filters">
            {trackOptions.map((track) => (
              <button
                key={track.id}
                type="button"
                className={`search-filter-pill${selectedTrack === track.id ? ' active' : ''}`}
                aria-pressed={selectedTrack === track.id}
                onClick={() => setSelectedTrack(track.id)}
              >
                {track.label}
              </button>
            ))}
          </div>
        </div>

        {normalizedQuery.length > 1 && results.length > 0 ? (
          <div className="search-results">
            {results.map((module) => (
              <button
                key={module.id}
                type="button"
                className="search-result-item"
                onClick={() => goToModule(module.id, module.track, module.title)}
              >
                <span className="search-result-title">{module.title}</span>
                <span className="search-result-track">{trackLabels.get(module.track) ?? module.track}</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            {recent.length > 0 && (
              <div className="search-section">
                <p className="search-section-label">Recent Searches</p>
                {recent.map((entry) => (
                  <button
                    key={entry}
                    type="button"
                    className="search-recent-item"
                    onClick={() => setQuery(entry)}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="1 4 1 10 7 10" />
                      <path d="M3.51 15a9 9 0 1 0 .49-3.5" />
                    </svg>
                    {entry}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
