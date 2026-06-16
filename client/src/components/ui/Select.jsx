import {
  Children,
  forwardRef,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useLayoutEffect,
  useRef,
  useState
} from "react";
import styles from "./Select.module.css";

function extractOptions(children) {
  const options = [];

  const visit = (nodes) => {
    Children.forEach(nodes, (child) => {
      if (!isValidElement(child)) {
        return;
      }

      if (child.type === "option") {
        options.push({
          value: child.props.value ?? "",
          label: Children.toArray(child.props.children).join(""),
          disabled: Boolean(child.props.disabled)
        });
        return;
      }

      if (child.props?.children) {
        visit(child.props.children);
      }
    });
  };

  visit(children);
  return options;
}

export const Select = forwardRef(function Select(
  {
    children,
    className = "",
    disabled = false,
    invalid = false,
    name,
    onBlur,
    onChange,
    onFocus,
    placeholder,
    required = false,
    value = "",
    ...rest
  },
  ref
) {
  const selectId = useId();
  const wrapperRef = useRef(null);
  const buttonRef = useRef(null);
  const listboxRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const options = useMemo(() => extractOptions(children), [children]);
  const selectedIndex = options.findIndex((option) => String(option.value) === String(value));
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null;
  const displayLabel =
    selectedOption?.label || placeholder || options.find((option) => option.value === "")?.label || "";

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (selectedIndex >= 0 && !options[selectedIndex]?.disabled) {
      setFocusedIndex(selectedIndex);
      return;
    }

    setFocusedIndex(options.findIndex((option) => !option.disabled));
  }, [isOpen, options, selectedIndex]);

  useLayoutEffect(() => {
    if (isOpen) {
      listboxRef.current?.focus();
    }
  }, [isOpen]);

  const closeListbox = () => {
    setIsOpen(false);
    setFocusedIndex(-1);
  };

  const commitValue = (nextValue) => {
    if (disabled) {
      return;
    }

    onChange?.({
      target: { name, value: nextValue },
      currentTarget: { name, value: nextValue }
    });
    closeListbox();
    buttonRef.current?.focus();
  };

  const moveFocus = (direction) => {
    if (!options.length) {
      return;
    }

    let nextIndex = focusedIndex;

    for (let step = 0; step < options.length; step += 1) {
      nextIndex = (nextIndex + direction + options.length) % options.length;
      if (!options[nextIndex].disabled) {
        setFocusedIndex(nextIndex);
        return;
      }
    }
  };

  const handleButtonKeyDown = (event) => {
    if (disabled) {
      return;
    }

    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          moveFocus(event.key === "ArrowDown" ? 1 : -1);
        }
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        setIsOpen((current) => !current);
        break;
      case "Escape":
        if (isOpen) {
          event.preventDefault();
          closeListbox();
        }
        break;
      default:
        break;
    }
  };

  const handleListboxKeyDown = (event) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveFocus(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveFocus(-1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (focusedIndex >= 0) {
          commitValue(String(options[focusedIndex].value));
        }
        break;
      case "Escape":
        event.preventDefault();
        closeListbox();
        buttonRef.current?.focus();
        break;
      case "Tab":
        closeListbox();
        break;
      default:
        break;
    }
  };

  return (
    <div
      ref={wrapperRef}
      className={[
        styles.wrapper,
        invalid ? styles.invalid : "",
        disabled ? styles.disabled : "",
        isOpen ? styles.open : "",
        className
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <select
        {...rest}
        ref={ref}
        name={name}
        value={value}
        disabled={disabled}
        required={required}
        onChange={onChange}
        tabIndex={-1}
        aria-hidden="true"
        className={styles.native}
      >
        {children}
      </select>

      <button
        ref={buttonRef}
        type="button"
        className={styles.trigger}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${selectId}-listbox`}
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={handleButtonKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        <span className={!selectedOption?.value ? styles.placeholder : ""}>{displayLabel}</span>
        <span className={styles.icon} aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>

      {isOpen ? (
        <div
          id={`${selectId}-listbox`}
          ref={listboxRef}
          className={styles.listbox}
          role="listbox"
          aria-disabled={disabled}
          aria-activedescendant={focusedIndex >= 0 ? `${selectId}-option-${focusedIndex}` : undefined}
          tabIndex={-1}
          onKeyDown={handleListboxKeyDown}
        >
          {options.map((option, index) => {
            const isSelected = String(option.value) === String(value);
            const isFocused = index === focusedIndex;

            return (
              <div
                key={`${option.value}-${index}`}
                id={`${selectId}-option-${index}`}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled}
                className={[
                  styles.option,
                  isSelected ? styles.optionSelected : "",
                  isFocused ? styles.optionFocused : "",
                  option.disabled ? styles.optionDisabled : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
                onMouseEnter={() => {
                  if (!option.disabled) {
                    setFocusedIndex(index);
                  }
                }}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  if (!option.disabled) {
                    commitValue(String(option.value));
                  }
                }}
              >
                <span>{option.label}</span>
                {isSelected ? <span className={styles.check}>*</span> : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
});

