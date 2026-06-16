import { Field } from "./ui/Field.jsx";
import { Input } from "./ui/Input.jsx";
import { Button } from "./ui/Button.jsx";
import { Alert } from "./ui/Alert.jsx";
import styles from "./PlaceholderForm.module.css";

export function PlaceholderForm({
  fields,
  actionLabel,
  values = {},
  onChange,
  onSubmit,
  isSubmitting = false,
  error = "",
  success = ""
}) {
  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <div className={styles.fields}>
        {fields.map((field) => (
          <Field key={field.name ?? field} label={field.label ?? field} required={field.required ?? true}>
            <Input
              type={field.type ?? "text"}
              name={field.name ?? field}
              value={values[field.name ?? field] ?? ""}
              onChange={onChange}
              placeholder={field.placeholder ?? `Введіть ${(field.label ?? field).toLowerCase()}`}
              autoComplete={field.autoComplete}
              required={field.required ?? true}
            />
          </Field>
        ))}
      </div>
      {error ? <Alert variant="error">{error}</Alert> : null}
      {success ? <Alert variant="success">{success}</Alert> : null}
      <Button type="submit" variant="primary" size="md" isLoading={isSubmitting}>
        {actionLabel}
      </Button>
    </form>
  );
}
