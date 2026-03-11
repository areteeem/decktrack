import styles from "./Button.module.css";
import PropTypes from "prop-types";

const Button = (props) => {
  const inlineStyle = {
    ...(props.bgcolor ? { backgroundColor: props.bgcolor } : {}),
    ...(props.color ? { color: props.color } : {}),
    ...(props.style || {}),
  };

  return (
    <button
      type={props.type || "button"}
      className={`${styles.button}${props.className ? ` ${props.className}` : ""}`}
      style={inlineStyle}
      disabled={props.disabled}
      onClick={props.callback}
      title={props.title}
    >
      {props.children || "Submit"}
    </button>
  );
};

Button.propTypes = {
  callback: PropTypes.func,
  children: PropTypes.node,
  bgcolor: PropTypes.string,
  className: PropTypes.string,
  color: PropTypes.string,
  disabled: PropTypes.bool,
  style: PropTypes.object,
  type: PropTypes.string,
};

export default Button;
