import { AlertCircle } from 'lucide-react';

/**
 * Labelled form control wrappers.
 *
 * Every input in the system goes through one of these so that labels,
 * required markers, hints and validation messages are consistent.
 */

export const Field = ({ label, htmlFor, required, hint, error, children, full = false }) => (
  <div className={`field${full ? ' field--full' : ''}`}>
    {label && (
      <label className="field__label" htmlFor={htmlFor}>
        {label}
        {required && <span className="req" aria-hidden="true">*</span>}
        {required && <span className="sr-only"> (required)</span>}
      </label>
    )}
    {children}
    {error ? (
      <span className="field__error" role="alert">
        <AlertCircle size={12} />
        {error}
      </span>
    ) : (
      hint && <span className="field__hint">{hint}</span>
    )}
  </div>
);

export const TextField = ({
  id,
  label,
  required,
  hint,
  error,
  full,
  icon: Icon,
  ...inputProps
}) => (
  <Field label={label} htmlFor={id} required={required} hint={hint} error={error} full={full}>
    {Icon ? (
      <span className="input-group">
        <span className="input-group__icon">
          <Icon size={15} />
        </span>
        <input
          id={id}
          className={`input${error ? ' is-invalid' : ''}`}
          aria-invalid={Boolean(error)}
          {...inputProps}
        />
      </span>
    ) : (
      <input
        id={id}
        className={`input${error ? ' is-invalid' : ''}`}
        aria-invalid={Boolean(error)}
        {...inputProps}
      />
    )}
  </Field>
);

export const SelectField = ({
  id,
  label,
  required,
  hint,
  error,
  full,
  options = [],
  placeholder,
  ...selectProps
}) => (
  <Field label={label} htmlFor={id} required={required} hint={hint} error={error} full={full}>
    <select
      id={id}
      className={`select${error ? ' is-invalid' : ''}`}
      aria-invalid={Boolean(error)}
      {...selectProps}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((option) => {
        const value = typeof option === 'string' ? option : option.value;
        const text = typeof option === 'string' ? option : option.label;
        return (
          <option key={value} value={value}>
            {text}
          </option>
        );
      })}
    </select>
  </Field>
);

export const TextAreaField = ({ id, label, required, hint, error, full, ...areaProps }) => (
  <Field label={label} htmlFor={id} required={required} hint={hint} error={error} full={full}>
    <textarea
      id={id}
      className={`textarea${error ? ' is-invalid' : ''}`}
      aria-invalid={Boolean(error)}
      {...areaProps}
    />
  </Field>
);

export default Field;
