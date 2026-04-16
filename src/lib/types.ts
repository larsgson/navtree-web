export interface ImageConfig {
  base_url: string
}

export interface TemplateStory {
  id: string
  image: string
}

export interface TemplateCategory {
  id: string
  image: string
  audioUrl: string
  audioHqUrl: string
  stories: TemplateStory[]
}

export interface BookStructure {
  id: string
  coverImage: string
  imageConfig: ImageConfig | null
  categories: TemplateCategory[]
}

export interface CategoryMeta {
  title: string
  description: string
}

export interface StoryMeta {
  title: string
  description: string
}

export interface LocaleData {
  bookTitle: string
  topLevel: Record<string, string>
  categories: Record<string, CategoryMeta>
  categoryExtras: Record<string, Record<string, string>>
  stories: Record<string, StoryMeta>
  sections: Record<string, Record<string, string>>
}

export interface PageTiming {
  segments: number[]
  words: number[][]
}

export interface PageBlock {
  type: "image" | "text" | "heading" | "description"
  content: string
  paragraphIndex?: number
}

export interface ParsedPage {
  title: string
  description: string
  blocks: PageBlock[]
}

export interface Section {
  imageUrls: string[]
  text: string
  heading?: string
  description?: string
  paragraphIndices: number[]
}

export interface ParsedMarkdown {
  title: string
  sections: Section[]
}
