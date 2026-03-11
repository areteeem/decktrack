const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const getAdaptiveTextStyle = (
  text,
  {
    max = 2,
    min = 1.15,
    softThreshold = 32,
    hardThreshold = 180,
    minLineHeight = 1.2,
    maxLineHeight = 1.42,
  } = {}
) => {
  const length = String(text || '').trim().length;

  if (!length) {
    return {
      fontSize: `${max}rem`,
      lineHeight: minLineHeight,
    };
  }

  if (length <= softThreshold) {
    return {
      fontSize: `${max}rem`,
      lineHeight: minLineHeight,
    };
  }

  const ratio = clamp(
    (length - softThreshold) / Math.max(hardThreshold - softThreshold, 1),
    0,
    1
  );

  const fontSize = max - (max - min) * ratio;
  const lineHeight = minLineHeight + (maxLineHeight - minLineHeight) * ratio;

  return {
    fontSize: `${fontSize.toFixed(2)}rem`,
    lineHeight: Number(lineHeight.toFixed(2)),
  };
};
