import type { IconDefinition } from "@fortawesome/fontawesome-common-types"

interface FaIconProps {
  icon: IconDefinition
  className?: string
}

export function FaIcon({ icon, className = "" }: FaIconProps) {
  const [width, height, , , pathData] = icon.icon
  const paths = Array.isArray(pathData) ? pathData : [pathData]
  const isDuotone = icon.prefix.startsWith("fad")

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          opacity={isDuotone && i === 0 ? 0.4 : 1}
        />
      ))}
    </svg>
  )
}
