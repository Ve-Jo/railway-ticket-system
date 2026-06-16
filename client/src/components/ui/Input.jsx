import { forwardRef } from "react";
import styles from "./Input.module.css";

export const Input = forwardRef(function Input(
  { className = "", invalid = false, ...rest },
  ref
) {
  return (
    <input
      ref={ref}
      className={`${styles.input} ${invalid ? styles.invalid : ""} ${className}`}
      {...rest}
    />
  );
});
