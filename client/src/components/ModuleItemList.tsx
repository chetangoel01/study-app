import { useId } from 'react';
import type { CurriculumItem, ItemType } from '../types.js';

interface Props {
  items: CurriculumItem[];
  moduleId: string;
  isCompleted: (moduleId: string, itemId: string) => boolean;
  onToggle: (moduleId: string, itemId: string, type: ItemType) => void;
  filter?: ItemType[];
}

export function ModuleItemList({
  items,
  moduleId,
  isCompleted,
  onToggle,
  filter,
}: Props) {
  const idPrefix = useId();
  const list = filter ? items.filter((item) => filter.includes(item.type)) : items;
  if (list.length === 0) {
    return <p className="markdown-empty">Nothing here yet.</p>;
  }

  return (
    <ul className="item-list">
      {list.map((item) => {
        const done = isCompleted(moduleId, item.id);
        const inputId = `${idPrefix}-${moduleId}-${item.id}`;
        const isDoItem = item.type === 'do';
        const isCheckItem = item.type === 'check';

        return (
          <li key={item.id} className={`item-row item-${item.type}${done ? ' done' : ''}`}>
            {isDoItem ? (
              <div className="item-do-card">
                <input
                  id={inputId}
                  type="checkbox"
                  checked={done}
                  onChange={() => onToggle(moduleId, item.id, item.type)}
                />
                <div className="item-do-body">
                  <span className="item-do-kicker">Assignment</span>
                  {item.url
                    ? (
                        <a href={item.url} target="_blank" rel="noreferrer">
                          {item.label}
                        </a>
                      )
                    : <label htmlFor={inputId}>{item.label}</label>}
                </div>
              </div>
            ) : (
              <div className={isCheckItem ? 'item-check-row' : 'item-row-content'}>
                <input
                  id={inputId}
                  type="checkbox"
                  checked={done}
                  onChange={() => onToggle(moduleId, item.id, item.type)}
                />
                {item.url
                  ? (
                      <a href={item.url} target="_blank" rel="noreferrer">
                        {item.label}
                      </a>
                    )
                  : <label htmlFor={inputId}>{item.label}</label>}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
