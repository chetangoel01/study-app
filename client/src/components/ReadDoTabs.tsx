import { useState } from 'react';
import type { ReactNode } from 'react';

interface Props {
  readContent: ReactNode;
  doContent: ReactNode;
}

export function ReadDoTabs({ readContent, doContent }: Props) {
  const [active, setActive] = useState<'read' | 'do'>('read');

  return (
    <div className="read-do-tabs">
      <div className="tab-bar">
        <button
          type="button"
          className={`tab-btn${active === 'read' ? ' active' : ''}`}
          onClick={() => setActive('read')}
        >
          Read
        </button>
        <button
          type="button"
          className={`tab-btn${active === 'do' ? ' active' : ''}`}
          onClick={() => setActive('do')}
        >
          Do
        </button>
      </div>
      {active === 'read' ? readContent : doContent}
    </div>
  );
}
