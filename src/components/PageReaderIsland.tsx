import { useEffect, useRef, useCallback } from "react"
import {
  $segmentEntries,
  $focusMode,
  $audioPagePath,
  $audioPlayState,
  $audioToast,
  $currentSegmentIdx,
  $playerVisible,
  playSegment,
  setAudioForCategory,
  unlockAudio,
  preloadAudio,
} from "../stores/audio-store"
import type { SegmentEntry } from "../stores/audio-store"
import { parseMarkdownIntoSections, extractSectionToc } from "../lib/markdown-parser"
import PageSection from "./PageSection"
import type { LocaleData, ImageConfig, PageTiming } from "../lib/types"

interface Props {
  bookId: string
  categoryId: string
  pageId: string
  markdownContent: string
  localeData: LocaleData | null
  imageConfig: ImageConfig | null
  audioUrl: string
  allTimings: Record<string, PageTiming>
  allPageIds: string[]
  prevPageUrl: string | null
  nextPageUrl: string | null
  currentPageNumber: number
  totalPages: number
}

export default function PageReaderIsland({
  bookId,
  categoryId,
  pageId,
  markdownContent,
  localeData,
  imageConfig,
  audioUrl,
  allTimings,
  allPageIds,
  prevPageUrl,
  nextPageUrl,
  currentPageNumber,
  totalPages,
}: Props) {
  const audioSetupDone = useRef(false)

  const parsed = parseMarkdownIntoSections(markdownContent, localeData, categoryId)
  const storyTitle = parsed.title || localeData?.stories?.[`${categoryId}.${pageId}`]?.title || ""

  const setupAudio = useCallback(() => {
    if (audioSetupDone.current) return
    audioSetupDone.current = true

    const entries: SegmentEntry[] = []
    let globalParagraphIdx = 0

    for (const pid of allPageIds) {
      const timing = allTimings[pid]
      if (!timing?.segments?.length) continue

      const pageMd = pid === pageId ? markdownContent : null
      const pageParsed = pageMd ? parseMarkdownIntoSections(pageMd, localeData, categoryId) : null

      for (let i = 0; i < timing.segments.length; i++) {
        const startTime = timing.segments[i]
        const endTime =
          i + 1 < timing.segments.length
            ? timing.segments[i + 1]
            : getNextPageFirstTimestamp(pid, allPageIds, allTimings)
                ?? startTime + 30

        let sectionIndex = 0
        let matchedParagraphIndex = globalParagraphIdx + i
        if (pageParsed) {
          for (let s = 0; s < pageParsed.sections.length; s++) {
            if (pageParsed.sections[s].paragraphIndices.includes(i)) {
              sectionIndex = s
              break
            }
          }
        }

        const imageUrl = pageParsed?.sections[sectionIndex]?.imageUrls?.[0]
          ? (imageConfig
            ? `${imageConfig.base_url}/${pageParsed.sections[sectionIndex].imageUrls[0]}`
            : pageParsed.sections[sectionIndex].imageUrls[0])
          : null

        entries.push({
          pageId: pid,
          paragraphIndex: i,
          startTime,
          endTime,
          sectionIndex: pid === pageId ? sectionIndex : -1,
          imageUrl,
        })
      }

      globalParagraphIdx += timing.segments.length
    }

    setAudioForCategory({
      bookId,
      categoryId,
      audioUrl,
      allTimings,
      entries,
    })
  }, [bookId, categoryId, audioUrl, allTimings, allPageIds, pageId, markdownContent, localeData, imageConfig])

  useEffect(() => {
    audioSetupDone.current = false
    if (audioUrl) preloadAudio(audioUrl)
  }, [bookId, categoryId, pageId, audioUrl])

  const handleSectionClick = (sectionIndex: number) => {
    unlockAudio()
    $audioPagePath.set(`${bookId}/${categoryId}/${pageId}`)

    setupAudio()

    const entries = $segmentEntries.get()
    const entryIdx = entries.findIndex(
      (e) => e.pageId === pageId && e.sectionIndex === sectionIndex && e.endTime > e.startTime,
    )

    if (entryIdx >= 0) {
      $focusMode.set(true)
      playSegment(entryIdx)
      requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent("focus-panel-refresh", { detail: { idx: entryIdx } }))
      })
    } else {
      $audioToast.set("No timing available for this section")
    }
  }

  useEffect(() => {
    const autoplaySection = sessionStorage.getItem("autoplay-section")
    if (autoplaySection !== null) {
      sessionStorage.removeItem("autoplay-section")
      const sectionIndex = parseInt(autoplaySection, 10)
      if (!isNaN(sectionIndex)) {
        $audioPagePath.set(`${bookId}/${categoryId}/${pageId}`)
        setupAudio()
        const entries = $segmentEntries.get()
        const entryIdx = entries.findIndex(
          (e) => e.pageId === pageId && e.sectionIndex === sectionIndex && e.endTime > e.startTime,
        )
        if (entryIdx >= 0) {
          $focusMode.set(true)
          playSegment(entryIdx).then(() => {
            requestAnimationFrame(() => {
              window.dispatchEvent(new CustomEvent("focus-panel-refresh", { detail: { idx: entryIdx } }))
            })
          }).catch(() => {
            // Autoplay blocked (iOS) — exit focus mode and pulse the section
            $focusMode.set(false)
            $audioPlayState.set("idle")
            $playerVisible.set(false)
            const card = document.querySelector(`[data-section-idx="${sectionIndex}"]`)
            if (card) {
              card.classList.add("autoplay-invite")
              setTimeout(() => card.classList.remove("autoplay-invite"), 3000)
            }
          })
        }
      }
    }
  }, [bookId, categoryId, pageId])

  const tocEntries = extractSectionToc(parsed)
  const sectionAnchorIds: Record<number, string> = {}
  for (const entry of tocEntries) {
    sectionAnchorIds[entry.sectionIndex] = entry.id
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <a
          href={`/${bookId}/`}
          className="text-lg font-bold"
          style={{ color: "var(--text)" }}
        >
          &larr;
        </a>
        <h1 className="text-xl font-bold flex-1">{storyTitle}</h1>
        {totalPages > 1 && (
          <span className="text-sm text-gray-500">
            {currentPageNumber} / {totalPages}
          </span>
        )}
      </div>

      <div className="space-y-4">
        {parsed.sections.map((section, index) => (
          <PageSection
            key={index}
            section={section}
            sectionIndex={index}
            sectionAnchorId={sectionAnchorIds[index]}
            onSectionClick={handleSectionClick}
            imageConfig={imageConfig}
            isClickable={section.paragraphIndices.length > 0}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-8 mb-4">
          {prevPageUrl ? (
            <a
              href={prevPageUrl}
              className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              &larr; Previous
            </a>
          ) : (
            <div />
          )}
          {nextPageUrl ? (
            <a
              href={nextPageUrl}
              className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Next &rarr;
            </a>
          ) : (
            <div />
          )}
        </div>
      )}
    </div>
  )
}

function getNextPageFirstTimestamp(
  currentPageId: string,
  allPageIds: string[],
  allTimings: Record<string, PageTiming>,
): number | null {
  const currentIdx = allPageIds.indexOf(currentPageId)
  if (currentIdx < 0) return null

  for (let i = currentIdx + 1; i < allPageIds.length; i++) {
    const timing = allTimings[allPageIds[i]]
    if (timing?.segments?.length) {
      return timing.segments[0]
    }
  }

  return null
}
