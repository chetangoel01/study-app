import { useId, useState } from 'react';
import type { CurriculumItem, ItemType } from '../types.js';
import { ExternalLinkModal } from './ExternalLinkModal.js';

const ITEM_KICKERS: Record<ItemType, string> = {
  read: 'Read',
  do: 'Assignment',
  check: 'Checkpoint',
};

interface Props {
  items: CurriculumItem[];
  moduleId: string;
  isCompleted: (moduleId: string, itemId: string) => boolean;
  isPending?: (moduleId: string, itemId: string) => boolean;
  onToggle: (moduleId: string, itemId: string, type: ItemType, label: string) => void;
  filter?: ItemType[];
}

export function ModuleItemList({
  items,
  moduleId,
  isCompleted,
  isPending = () => false,
  onToggle,
  filter,
}: Props) {
  const idPrefix = useId();
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const list = filter ? items.filter((item) => filter.includes(item.type)) : items;
  if (list.length === 0) {
    return <p className="markdown-empty">Nothing here yet.</p>;
  }

  return (
    <>
      <ul className="item-list">
        {list.map((item) => {
          const done = isCompleted(moduleId, item.id);
          const inputId = `${idPrefix}-${moduleId}-${item.id}`;
          const labelId = `${inputId}-label`;
          const metaId = `${inputId}-meta`;
          const pending = isPending(moduleId, item.id);

          return (
            <li
              key={item.id}
              className={`item-row item-${item.type}${done ? ' done' : ''}${pending ? ' pending' : ''}`}
            >
              <div className="item-card" aria-busy={pending}>
                <input
                  id={inputId}
                  type="checkbox"
                  checked={done}
                  onChange={() => onToggle(moduleId, item.id, item.type, item.label)}
                  className="item-checkbox"
                  aria-labelledby={labelId}
                  aria-describedby={metaId}
                  disabled={pending}
                />
                <div className="item-body">
                  <div className="item-topline">
                    <span className="item-kicker">{ITEM_KICKERS[item.type]}</span>
                    <span id={metaId} className="item-link-meta">
                      {pending ? 'Saving...' : item.url ? 'External resource' : 'Checklist item'}
                    </span>
                  </div>
                  {item.url ? (
                    <button
                      id={labelId}
                      type="button"
                      className="item-title item-link-btn"
                      onClick={() => setPendingUrl(item.url)}
                    >
                      {item.label}
                    </button>
                  ) : (
                    <label id={labelId} htmlFor={inputId} className="item-title">{item.label}</label>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {pendingUrl && (
        <ExternalLinkModal
          url={pendingUrl}
          onConfirm={() => setPendingUrl(null)}
          onCancel={() => setPendingUrl(null)}
        />
      )}
    </>
  );
}
