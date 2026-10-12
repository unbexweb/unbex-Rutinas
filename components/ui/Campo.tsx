import styles from "./Campo.module.css";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "name"> & {
  name: string;
  label: string;
  error?: string;
  ayuda?: string;
};

export function Campo({ name, label, error, ayuda, ...input }: Props) {
  const idError = `${name}-error`;
  const idAyuda = `${name}-ayuda`;
  const describedBy = [error && idError, ayuda && idAyuda].filter(Boolean).join(" ") || undefined;

  return (
    <div className={styles.campo}>
      <label htmlFor={name} className={styles.label}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        className={styles.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...input}
      />
      {ayuda && (
        <p id={idAyuda} className={styles.ayuda}>
          {ayuda}
        </p>
      )}
      {error && (
        <p id={idError} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
