import {
  forwardRef,
  useId,
  useMemo,
  useState,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react"
import "./components.css"

export interface SearchableSelectOption {
  value: string
  label: string
}

export interface SearchableSelectProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "children"
> {
  label: ReactNode
  options: readonly SearchableSelectOption[]
  emptyLabel: string
  action?: ReactNode
  error?: ReactNode
  searchPlaceholder?: string
}

export const SearchableSelect = forwardRef<
  HTMLSelectElement,
  SearchableSelectProps
>(function SearchableSelect(
  {
    label,
    options,
    emptyLabel,
    action,
    error,
    searchPlaceholder = "Typ om de lijst te filteren",
    id,
    value,
    defaultValue,
    onChange,
    onFocus,
    ...selectProps
  },
  ref,
) {
  const generatedId = useId()
  const selectId = id ?? `searchable-select-${generatedId}`
  const [query, setQuery] = useState("")
  const [internalValue, setInternalValue] = useState(String(defaultValue ?? ""))
  const normalizedQuery = query.trim().toLocaleLowerCase("nl")
  const selectedValue = String(value ?? internalValue)
  const visibleOptions = useMemo(
    () =>
      options.filter(
        (option) =>
          !normalizedQuery ||
          option.value === selectedValue ||
          option.label.toLocaleLowerCase("nl").includes(normalizedQuery),
      ),
    [normalizedQuery, options, selectedValue],
  )

  return (
    <div className="searchable-select">
      <div className="searchable-select__heading">
        <label htmlFor={selectId}>{label}</label>
        {action}
      </div>
      <input
        className="searchable-select__search"
        type="search"
        value={query}
        aria-label="Keuzelijst filteren"
        placeholder={searchPlaceholder}
        onChange={(event) => setQuery(event.target.value)}
      />
      <select
        {...selectProps}
        id={selectId}
        ref={ref}
        {...(value !== undefined ? { value } : {})}
        {...(defaultValue !== undefined ? { defaultValue } : {})}
        onFocus={(event) => {
          setInternalValue(event.currentTarget.value)
          onFocus?.(event)
        }}
        onChange={(event) => {
          setInternalValue(event.currentTarget.value)
          onChange?.(event)
        }}
      >
        <option value="">{emptyLabel}</option>
        {visibleOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {normalizedQuery && !visibleOptions.length ? (
        <small className="searchable-select__empty">
          Geen overeenkomsten. Wis de zoekterm of maak een nieuw record.
        </small>
      ) : null}
      {error}
    </div>
  )
})
