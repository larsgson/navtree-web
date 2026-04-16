import type { Section, ParsedMarkdown, LocaleData } from "./types"

function resolveLocaleKey(
  keyPath: string,
  localeData: LocaleData | null,
  currentCategoryId?: string,
): string | null {
  if (!localeData) return null
  const parts = keyPath.split(".")

  if (parts.length === 1) {
    if (keyPath === "title") return localeData.bookTitle || null
    if (localeData.topLevel?.[keyPath]) return localeData.topLevel[keyPath]
    if (currentCategoryId && localeData.categoryExtras?.[currentCategoryId]?.[keyPath]) {
      return localeData.categoryExtras[currentCategoryId][keyPath]
    }
    for (const catId of Object.keys(localeData.categoryExtras || {})) {
      if (localeData.categoryExtras[catId][keyPath]) {
        return localeData.categoryExtras[catId][keyPath]
      }
    }
    return null
  }

  if (parts.length === 2) {
    return localeData.categories?.[parts[0]]?.[parts[1] as keyof typeof localeData.categories[string]] || null
  }

  if (parts.length === 3) {
    const storyKey = `${parts[0]}.${parts[1]}`
    const key = parts[2]
    if (key === "title" || key === "description") {
      return localeData.stories?.[storyKey]?.[key] || null
    }
    return localeData.sections?.[storyKey]?.[key] || null
  }

  return null
}

function replaceLocaleMarkers(
  text: string,
  localeData: LocaleData | null,
  currentCategoryId?: string,
): string {
  if (!text || !localeData) return text
  return text.replace(/\[\[t:([^\]]+)\]\]/g, (fullMatch, keyPath: string) => {
    return resolveLocaleKey(keyPath, localeData, currentCategoryId) || fullMatch
  })
}

function isParagraphKey(key: string): boolean {
  return /^p\d+$/.test(key)
}

export function parseMarkdownIntoSections(
  markdown: string,
  localeData: LocaleData | null = null,
  categoryId?: string,
): ParsedMarkdown {
  if (!markdown) return { title: "", sections: [] }

  const sections: Section[] = []
  const lines = markdown.split("\n")
  let currentSection: Section | null = { imageUrls: [], text: "", paragraphIndices: [] }
  let storyTitle = ""
  let paragraphCounter = 0

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (trimmed.startsWith("# ") && !storyTitle) {
      let titleText = trimmed.substring(2).trim()
      if (titleText.includes("[[t:")) {
        titleText = replaceLocaleMarkers(titleText, localeData, categoryId)
      }
      storyTitle = titleText
      continue
    }

    if (trimmed.startsWith("## ") && trimmed.includes("[[t:")) {
      const resolved = replaceLocaleMarkers(trimmed.substring(3).trim(), localeData, categoryId)
      if (currentSection) {
        currentSection.heading = resolved
      }
      continue
    }

    const imageMatch = trimmed.match(/!\[.*?\]\((.*?)\)/)
    if (imageMatch) {
      if (currentSection && !currentSection.text.trim() && !currentSection.heading) {
        currentSection.imageUrls.push(imageMatch[1])
      } else {
        if (currentSection && (currentSection.text.trim() || currentSection.imageUrls.length > 0 || currentSection.heading)) {
          sections.push(currentSection)
        }
        currentSection = {
          imageUrls: [imageMatch[1]],
          text: "",
          paragraphIndices: [],
        }
      }
      continue
    }

    if (trimmed.includes("[[t:")) {
      const localeKeyMatch = trimmed.match(/\[\[t:([^\]]+)\]\]/)
      if (localeKeyMatch) {
        const keyPath = localeKeyMatch[1]
        const parts = keyPath.split(".")
        const lastPart = parts[parts.length - 1]

        if (lastPart === "description") {
          const resolved = resolveLocaleKey(keyPath, localeData, categoryId)
          if (resolved && currentSection) {
            currentSection.description = resolved
          }
          continue
        }

        if (isParagraphKey(lastPart)) {
          const resolved = resolveLocaleKey(keyPath, localeData, categoryId)
          if (resolved && currentSection) {
            currentSection.text += (currentSection.text ? "\n" : "") + resolved
            currentSection.paragraphIndices.push(paragraphCounter)
            paragraphCounter++
          }
          continue
        }
      }

      const resolved = replaceLocaleMarkers(trimmed, localeData, categoryId)
      if (resolved.trim() && currentSection) {
        currentSection.text += (currentSection.text ? "\n" : "") + resolved.trim()
      }
      continue
    }

    if (currentSection && trimmed) {
      currentSection.text += (currentSection.text ? "\n" : "") + trimmed
    }
  }

  if (currentSection && (currentSection.text.trim() || currentSection.imageUrls.length > 0 || currentSection.heading)) {
    sections.push(currentSection)
  }

  return { title: storyTitle, sections }
}

export interface SectionTocEntry {
  id: string
  title: string
  image: string
  sectionIndex: number
}

export function extractSectionToc(
  parsed: ParsedMarkdown,
): SectionTocEntry[] {
  const entries: SectionTocEntry[] = []
  let counter = 0
  for (let i = 0; i < parsed.sections.length; i++) {
    const section = parsed.sections[i]
    if (section.heading) {
      counter++
      const image = section.imageUrls[0] || ""
      entries.push({
        id: `section-heading-${counter}`,
        title: section.heading,
        image,
        sectionIndex: i,
      })
    }
  }
  return entries
}
