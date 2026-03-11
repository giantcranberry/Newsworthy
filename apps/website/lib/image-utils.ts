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
  const portraitClasses = "object-contain bg-gray-100";
  const landscapeClasses = "object-cover";

  switch (aspectRatio) {
    case "portrait":
      return `${baseClasses} ${portraitClasses}`;
    case "landscape":
    case "square":
    default:
      return `${baseClasses} ${landscapeClasses}`;
  }
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
