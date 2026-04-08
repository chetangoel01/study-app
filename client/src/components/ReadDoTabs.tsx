import { useEffect, useId, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

interface Props {
  readContent: ReactNode;
  doContent: ReactNode;
  readLabel?: string;
  doLabel?: string;
  defaultActive?: 'read' | 'do';
  ariaLabel?: string;
}

export function ReadDoTabs({
  readContent,
  doContent,
  readLabel = 'Read',
  doLabel = 'Do',
  defaultActive = 'read',
  ariaLabel = 'Module sections',
}: Props) {
  const [active, setActive] = useState<'read' | 'do'>(defaultActive);
  const baseId = useId();
  const tabs = [
    { id: 'read', label: readLabel, panelId: `${baseId}-read-panel`, tabId: `${baseId}-read-tab` },
    { id: 'do', label: doLabel, panelId: `${baseId}-do-panel`, tabId: `${baseId}-do-tab` },
  ] as const;

  useEffect(() => {
    setActive(defaultActive);
  }, [defaultActive]);

  const activateTab = (nextTabId: 'read' | 'do') => {
    const nextTab = tabs.find((tab) => tab.id === nextTabId);
    if (nextTab) {
      const nextButton = document.getElementById(nextTab.tabId);
      if (nextButton instanceof HTMLButtonElement) {
        nextButton.focus();
      }
    }
    setActive(nextTabId);
  };

  const handleKeyDown = (tabId: 'read' | 'do') => (event: KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = tabs.findIndex((tab) => tab.id === tabId);
    if (currentIndex < 0) return;

    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const offset = event.key === 'ArrowRight' ? 1 : -1;
      const nextIndex = (currentIndex + offset + tabs.length) % tabs.length;
      activateTab(tabs[nextIndex].id);
    }

    if (event.key === 'Home') {
      event.preventDefault();
      activateTab('read');
    }

    if (event.key === 'End') {
      event.preventDefault();
      activateTab('do');
    }
  };

  return (
    <div className="read-do-tabs">
      <div className="tab-bar" role="tablist" aria-label={ariaLabel}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={tab.tabId}
            type="button"
            role="tab"
            className={`tab-btn${active === tab.id ? ' active' : ''}`}
            aria-selected={active === tab.id}
            aria-controls={tab.panelId}
            tabIndex={active === tab.id ? 0 : -1}
            onClick={() => setActive(tab.id)}
            onKeyDown={handleKeyDown(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        id={tabs[0].panelId}
        role="tabpanel"
        aria-labelledby={tabs[0].tabId}
        hidden={active !== 'read'}
        className="tab-panel"
      >
        {readContent}
      </div>
      <div
        id={tabs[1].panelId}
        role="tabpanel"
        aria-labelledby={tabs[1].tabId}
        hidden={active !== 'do'}
        className="tab-panel"
      >
        {doContent}
      </div>
    </div>
  );
}
