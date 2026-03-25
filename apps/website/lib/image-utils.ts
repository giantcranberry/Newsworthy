/**
 * Utility functions for handling image aspect ratios
 */

export const getImageAspectRatio = (
  width: number,
  height: number
): "portrait" | "landscape" | "square" => {
  const ratio = width / height;

  if (ratio < 0.9) {
    return "portrait";
  } else if (ratio > 1.1) {
    return "landscape";
  } else {
    return "square";
  }
};

export const getImageClasses = (
  aspectRatio: "portrait" | "landscape" | "square",
  baseClasses: string = ""
) => {
  return `${baseClasses} object-cover object-center`;
};

/**
 * Calculate scaled dimensions for portrait images to match card height
 */
export const getScaledPortraitDimensions = (
  originalWidth: number,
  originalHeight: number,
  targetHeight: number = 192
) => {
  const aspectRatio = originalWidth / originalHeight;
  const scaledWidth = Math.round(targetHeight * aspectRatio);
  return {
    width: scaledWidth,
    height: targetHeight,
  };
};
