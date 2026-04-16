import type { ImageConfig } from "../lib/types"
import { resolveImageUrl } from "../lib/image-utils"

interface BookInfo {
  id: string
  title: string
  description: string
  coverImage: string
  categoryCount: number
  pageCount: number
  imageConfig: ImageConfig | null
}

interface Props {
  books: BookInfo[]
}

export default function BookGridIsland({ books }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {books.map((book) => (
        <a
          key={book.id}
          href={`/${book.id}/`}
          className="group block rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow"
        >
          <div className="bg-gray-100 dark:bg-gray-800 relative overflow-hidden">
            <img
              src={resolveImageUrl(book.coverImage, book.imageConfig)}
              alt={book.title}
              className="w-full group-hover:scale-105 transition-transform"
              onError={(e) => {
                ;(e.target as HTMLImageElement).style.display = "none"
              }}
            />
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-4">
              <h2 className="text-white text-lg font-semibold">
                {book.title}
              </h2>
              {book.pageCount > 1 && (
                <p className="text-white/80 text-sm">
                  {book.pageCount} pages
                </p>
              )}
            </div>
          </div>
        </a>
      ))}
    </div>
  )
}
