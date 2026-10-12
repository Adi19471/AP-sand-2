import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';

/**
 * Debounced search input.
 *
 * Typing does not fire a Firestore query on every keystroke - the value is
 * held locally and pushed up after a short pause.
 */
const SearchBar = ({
  value = '',
  onChange,
  placeholder = 'Search…',
  delay = 350,
  id = 'search',
  ariaLabel = 'Search',
}) => {
  const [local, setLocal] = useState(value);

  // Keep in step when the parent clears the filters.
  useEffect(() => {
    setLocal(value);
  }, [value]);

  useEffect(() => {
    if (local === value) return undefined;
    const timer = setTimeout(() => onChange(local), delay);
    return () => clearTimeout(timer);
    // `value` is intentionally excluded: including it would cancel the debounce
    // as soon as the parent echoes the new value back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local, delay]);

  return (
    <div className="search-box">
      <span className="search-box__icon">
        <Search size={15} />
      </span>
      <input
        id={id}
        type="search"
        className="input"
        value={local}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(event) => setLocal(event.target.value)}
      />
      {local && (
        <button
          type="button"
          className="search-box__clear"
          aria-label="Clear search"
          onClick={() => {
            setLocal('');
            onChange('');
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};

export default SearchBar;
