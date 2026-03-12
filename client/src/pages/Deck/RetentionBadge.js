import Badge from "../../common/components/Badge";

const RetentionBadge = ({ retention, fontSize, children }) => {
  return (
    <Badge style={{ fontSize }}>
      {retention}% {children}
    </Badge>
  );
};

export default RetentionBadge;
