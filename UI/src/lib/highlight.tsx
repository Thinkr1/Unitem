import type { ReactNode } from 'react'

// Tiny regex tokenizer for the two languages Unitem displays. Line-based so it
// composes cleanly with line numbers, flag tints, and the pulse animation.

const SWIFT_KEYWORDS = new Set([
  'import', 'struct', 'class', 'enum', 'extension', 'protocol', 'func', 'var',
  'let', 'private', 'public', 'internal', 'static', 'some', 'return', 'in',
  'if', 'else', 'guard', 'switch', 'case', 'true', 'false', 'nil', 'self',
  'body', 'weight', 'value', 'action',
])

const DART_KEYWORDS = new Set([
  'import', 'class', 'extends', 'implements', 'with', 'final', 'const', 'var',
  'void', 'bool', 'int', 'double', 'return', 'super', 'this', 'new', 'if',
  'else', 'switch', 'case', 'true', 'false', 'null', 'required', 'late',
  'child', 'children', 'style', 'body',
])

const TOKEN_PATTERN =
  /(\/\/.*)|("(?:[^"\\]|\\.)*"?)|('(?:[^'\\]|\\.)*'?)|(@\w+)|(\b\d+(?:\.\d+)?\b)|(\$?[A-Za-z_][A-Za-z0-9_]*)|(\s+)|(.)/g

function classify(word: string, language: 'swift' | 'dart' | 'kotlin'): string | null {
  const keywords = language === 'swift' ? SWIFT_KEYWORDS : DART_KEYWORDS // kotlin shares most Dart keywords for display purposes
  if (keywords.has(word)) return 'tok-kw'
  if (word.startsWith('$') || word.startsWith('_')) return 'tok-var'
  if (/^[A-Z]/.test(word)) return 'tok-type'
  return null
}

export function highlightLine(
  line: string,
  language: 'swift' | 'dart' | 'kotlin',
): ReactNode[] {
  const nodes: ReactNode[] = []
  let match: RegExpExecArray | null
  let key = 0
  TOKEN_PATTERN.lastIndex = 0

  while ((match = TOKEN_PATTERN.exec(line)) !== null) {
    const [text, comment, dquote, squote, attr, num, word] = match
    let cls: string | null = null
    if (comment) cls = 'tok-comment'
    else if (dquote || squote) cls = 'tok-str'
    else if (attr) cls = 'tok-attr'
    else if (num) cls = 'tok-num'
    else if (word) cls = classify(word, language)

    nodes.push(
      cls ? (
        <span key={key++} className={cls}>
          {text}
        </span>
      ) : (
        <span key={key++}>{text}</span>
      ),
    )
  }
  return nodes
}
