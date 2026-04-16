import { useState, useEffect, useCallback } from "react"
import type { BookStructure, LocaleData, ImageConfig } from "../lib/types"
import type { SectionTocEntry } from "../lib/markdown-parser"
import { resolveImageUrl } from "../lib/image-utils"

interface Props {
  bookId: string
  structure: BookStructure
  localeData: LocaleData | null
  imageConfig: ImageConfig | null
  defaultCategoryId?: string | null
  sectionToc?: SectionTocEntry[]
}

export default function PageNavigationIsland({
  bookId,
  structure,
  localeData,
  imageConfig,
  defaultCategoryId = null,
  sectionToc = [],
}: Props) {
  const [openCatId, setOpenCatId] = useState<string | null>(null)
  const singleCategory = structure.categories.length === 1
  const singleStory = singleCategory && structure.categories[0].stories.length === 1
  const hasSectionToc = singleStory && sectionToc.length > 1

  useEffect(() => {
    if (singleCategory) {
      setOpenCatId(structure.categories[0].id)
      return
    }
    if (defaultCategoryId) {
      setOpenCatId(defaultCategoryId)
      return
    }
    setOpenCatId(structure.categories[0]?.id || null)
  }, [bookId, structure.categories, defaultCategoryId, singleCategory])

  const getCategoryTitle = (catId: string) =>
    localeData?.categories?.[catId]?.title || `Category ${catId}`

  const getCategoryDesc = (catId: string) =>
    localeData?.categories?.[catId]?.description || ""

  const getPageTitle = (catId: string, pageId: string) => {
    const key = `${catId}.${pageId}`
    return localeData?.stories?.[key]?.title || `Page ${pageId}`
  }

  const toggleAccordion = useCallback((catId: string) => {
    setOpenCatId((prev) => (prev === catId ? null : catId))
  }, [])

  const bookTitle = localeData?.bookTitle || bookId

  return (
    <div className="chapter-picker">
      <div className="flex items-center gap-3 mb-4">
        <a href="/" className="text-lg font-bold" style={{ color: "var(--text)" }}>&larr;</a>
        <h1 className="text-xl font-bold">{bookTitle}</h1>
      </div>

      {hasSectionToc ? (
        <div className="chapter-grid">
          {sectionToc.map((entry) => {
            const cat = structure.categories[0]
            const story = cat.stories[0]
            return (
              <a
                key={entry.id}
                href={`/${bookId}/${cat.id}/${story.id}#${entry.id}`}
                className="chapter-card"
              >
                {entry.image ? (
                  <img
                    className="chapter-card-img"
                    src={resolveImageUrl(entry.image, imageConfig)}
                    alt=""
                    loading="lazy"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).style.display = "none"
                    }}
                  />
                ) : (
                  <div
                    className="chapter-card-img"
                    style={{ background: "var(--bg-surface)" }}
                  />
                )}
                <div className="chapter-card-info">
                  <span className="chapter-card-num">
                    {entry.title}
                  </span>
                </div>
              </a>
            )
          })}
        </div>
      ) : singleCategory ? (
        <div className="chapter-grid">
          {structure.categories[0].stories.map((page) => (
            <a
              key={page.id}
              href={`/${bookId}/${structure.categories[0].id}/${page.id}`}
              className="chapter-card"
            >
              {page.image ? (
                <img
                  className="chapter-card-img"
                  src={resolveImageUrl(page.image, imageConfig)}
                  alt=""
                  loading="lazy"
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).style.display = "none"
                  }}
                />
              ) : (
                <div
                  className="chapter-card-img"
                  style={{ background: "var(--bg-surface)" }}
                />
              )}
              <div className="chapter-card-info">
                <span className="chapter-card-num">
                  {getPageTitle(structure.categories[0].id, page.id)}
                </span>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div>
          {structure.categories.map((cat) => {
            const isOpen = openCatId === cat.id
            const thumbSrc = cat.image
              ? resolveImageUrl(cat.image, imageConfig)
              : cat.stories[0]?.image
                ? resolveImageUrl(cat.stories[0].image, imageConfig)
                : null

            return (
              <div
                key={cat.id}
                className={`accordion-item${isOpen ? " open" : ""}`}
              >
                <button
                  className="accordion-header"
                  onClick={() => toggleAccordion(cat.id)}
                >
                  {thumbSrc && (
                    <img
                      className="accordion-thumb"
                      src={thumbSrc}
                      alt=""
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).style.display = "none"
                      }}
                    />
                  )}
                  <div className="accordion-info">
                    <span className="accordion-title">
                      {getCategoryTitle(cat.id)}
                    </span>
                    {getCategoryDesc(cat.id) && (
                      <span className="accordion-desc">
                        {getCategoryDesc(cat.id)}
                      </span>
                    )}
                  </div>
                  <span className="accordion-chevron">&#x25B8;</span>
                </button>
                <div className="accordion-body">
                  <div className="accordion-body-inner">
                    <div className="chapter-grid">
                      {cat.stories.map((page) => (
                        <a
                          key={page.id}
                          href={`/${bookId}/${cat.id}/${page.id}`}
                          className="chapter-card"
                        >
                          {page.image ? (
                            <img
                              className="chapter-card-img"
                              src={resolveImageUrl(page.image, imageConfig)}
                              alt=""
                              loading="lazy"
                              onError={(e) => {
                                ;(e.target as HTMLImageElement).style.display = "none"
                              }}
                            />
                          ) : (
                            <div
                              className="chapter-card-img"
                              style={{ background: "var(--bg-surface)" }}
                            />
                          )}
                          <div className="chapter-card-info">
                            <span className="chapter-card-num">
                              {getPageTitle(cat.id, page.id)}
                            </span>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
