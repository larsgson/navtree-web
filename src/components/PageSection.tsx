import type { Section, ImageConfig } from "../lib/types"
import { resolveImageUrl } from "../lib/image-utils"

interface Props {
  section: Section
  sectionIndex: number
  sectionAnchorId?: string
  onSectionClick: (index: number) => void
  imageConfig: ImageConfig | null
  isClickable: boolean
}

export default function PageSection({
  section,
  sectionIndex,
  sectionAnchorId,
  onSectionClick,
  imageConfig,
  isClickable,
}: Props) {
  const hasImages = section.imageUrls.length > 0

  return (
    <div
      id={sectionAnchorId || `section-${sectionIndex}`}
      data-section-idx={sectionIndex}
      className={`listen-verse-card rounded-lg overflow-hidden border ${
        isClickable ? "cursor-pointer hover:shadow-md" : ""
      }`}
      style={{ scrollMarginTop: "0" }}
      {...(isClickable ? {
        onClick: () => onSectionClick(sectionIndex),
        role: "button",
        tabIndex: 0,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onSectionClick(sectionIndex)
          }
        },
      } : {})}
    >
      {hasImages && (
        <div className="listen-verse-images">
          {section.imageUrls.map((url, imgIdx) => (
            <img
              key={imgIdx}
              src={resolveImageUrl(url, imageConfig)}
              alt={`Section ${sectionIndex + 1}`}
              className="w-full"
              loading={sectionIndex < 3 ? "eager" : "lazy"}
              onError={(e) => {
                ;(e.target as HTMLImageElement).style.display = "none"
              }}
            />
          ))}
        </div>
      )}

      {section.heading && (
        <div className={hasImages ? "relative z-10" : "px-3 pt-3"}>
          <h3 className={`text-base font-semibold ${hasImages ? "px-3 pt-3" : ""}`}>
            {section.heading}
          </h3>
        </div>
      )}

      {section.description && (
        <div className="px-3 pt-1 text-sm text-gray-500 dark:text-gray-400 italic">
          {section.description}
        </div>
      )}

      {section.text.trim() && (
        <div className={`listen-verse-text-primary${hasImages ? " has-images" : ""}`}>
          {section.text.split("\n").map((line, pIdx) => {
            const trimmed = line.trim()
            if (!trimmed) return null
            return <p key={pIdx} className="mb-1">{trimmed}</p>
          })}
        </div>
      )}
    </div>
  )
}
