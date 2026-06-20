import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type Props = { children: string }

// Renders the guide markdown with bold/headers/lists/code/blockquote/img.
// Blockquotes that start with an emoji (⚠️ 🛑 ℹ️) get styled as callout boxes.
export function GuideMarkdown({ children }: Props) {
  return (
    <div className="prose-guide">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mt-2 mb-3" {...props} />,
          h2: ({ node, ...props }) => <h2 className="text-lg font-bold mt-5 mb-2 border-b border-border pb-1" {...props} />,
          h3: ({ node, ...props }) => <h3 className="text-base font-semibold mt-4 mb-2" {...props} />,
          p: ({ node, ...props }) => <p className="text-sm leading-relaxed my-2" {...props} />,
          ul: ({ node, ...props }) => <ul className="list-disc pl-5 my-2 space-y-1 text-sm" {...props} />,
          ol: ({ node, ...props }) => <ol className="list-decimal pl-5 my-2 space-y-2 text-sm" {...props} />,
          li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
          strong: ({ node, ...props }) => <strong className="font-bold" {...props} />,
          em: ({ node, ...props }) => <em className="italic" {...props} />,
          code: ({ node, className, children, ...props }: any) => {
            const isBlock = className?.includes('language-')
            if (isBlock) {
              return (
                <pre className="rounded-md bg-muted/40 p-3 text-xs overflow-x-auto my-2">
                  <code {...props}>{children}</code>
                </pre>
              )
            }
            return <code className="px-1 py-0.5 rounded bg-muted/40 text-[0.9em] font-mono" {...props}>{children}</code>
          },
          blockquote: ({ node, children, ...props }: any) => {
            // Detect callout style from first text content
            const text = extractText(children)
            let cls = 'border-l-4 border-border bg-card/40 pl-3 pr-3 py-2 my-3 rounded-r-md text-sm'
            if (/^[\s>]*⚠️|^WARNING/i.test(text)) {
              cls = 'border-l-4 border-amber-500 bg-amber-950/30 pl-3 pr-3 py-2 my-3 rounded-r-md text-sm'
            } else if (/^[\s>]*🛑|^STOP/i.test(text)) {
              cls = 'border-l-4 border-red-500 bg-red-950/30 pl-3 pr-3 py-2 my-3 rounded-r-md text-sm'
            } else if (/^[\s>]*ℹ️|^NOTE/i.test(text)) {
              cls = 'border-l-4 border-blue-500 bg-blue-950/30 pl-3 pr-3 py-2 my-3 rounded-r-md text-sm'
            }
            return <blockquote className={cls} {...props}>{children}</blockquote>
          },
          img: ({ node, alt, src, ...props }: any) => (
            <span className="block my-3">
              <img
                src={src}
                alt={alt || ''}
                referrerPolicy="no-referrer"
                className="w-full max-h-[480px] object-contain rounded-lg border border-border bg-black/30"
                {...props}
              />
              {alt && <span className="block text-xs text-muted-foreground mt-1 text-center">{alt}</span>}
            </span>
          ),
          a: ({ node, ...props }) => <a className="text-primary underline" target="_blank" rel="noreferrer" {...props} />,
          hr: () => <hr className="my-4 border-border" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}

function extractText(node: any): string {
  if (!node) return ''
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (node?.props?.children) return extractText(node.props.children)
  return ''
}
