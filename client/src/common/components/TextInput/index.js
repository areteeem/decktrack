import styles from "./TextInput.module.css";

const TextInput = ({
  label,
  helperText,
  multiline,
  rows = 5,
  state,
  setState,
  className,
  ...props
}) => {
  const FieldTag = multiline ? "textarea" : "input";

  return (
    <label className={styles.field}>
      {label && <span className={styles.label}>{label}</span>}
      <FieldTag
        {...props}
        rows={multiline ? rows : undefined}
        className={`${styles.input} ${multiline ? styles.multiline : ""}${className ? ` ${className}` : ""}`}
        value={state}
        onChange={(event) => {
          setState(event.target.value);
        }}
      />
      {helperText && <span className={styles.helper}>{helperText}</span>}
    </label>
  );
};

export default TextInput;
