import fs from 'fs'
import path from 'path'
import type { Router } from './types'

export function generatedFilePaths(router: Router, extension: string): string[] {
  return router === 'pages'
    ? [
        `editable.config.${extension}`,
        `pages/api/editable/content.${extension}`,
        `pages/api/editable/upload.${extension}`,
      ]
    : [
        `editable.config.${extension}`,
        `app/api/editable/content/route.${extension}`,
        `app/api/editable/upload/route.${extension}`,
      ]
}

export function findConflictingFiles(
  files: string[],
  exists: (file: string) => boolean = file => fs.existsSync(path.resolve(file))
): string[] {
  return files.filter(exists)
}

export function normalizeAuthOptionsPath(input: string): string | undefined {
  let value = input.trim().replace(/\\/g, '/')
  if (!value) return undefined
  if (!value.startsWith('./')) value = `./${value}`
  value = value.replace(/\.(?:[cm]?[jt]sx?)$/i, '')
  const segments = value.slice(2).split('/')
  if (segments.some(segment => {
    const name = segment.startsWith('[') && segment.endsWith(']') ? segment.slice(1, -1) : segment
    return !name || name === '.' || name === '..' || !/^[A-Za-z0-9_$.-]+$/.test(name)
  })) {
    return undefined
  }
  return value
}

export function mergeEnvExample(existing: string, generated: string): string {
  const keys = new Set(existing.split(/\r?\n/).map(line => /^([A-Za-z_][A-Za-z\d_]*)=/.exec(line)?.[1]).filter(Boolean))
  const additions = generated.split(/\r?\n/).filter(line => {
    const key = /^([A-Za-z_][A-Za-z\d_]*)=/.exec(line)?.[1]
    if (!key || keys.has(key)) return false
    keys.add(key)
    return true
  })
  if (additions.length === 0) return existing

  const header = generated.split(/\r?\n/).filter(line => line.startsWith('#') && !existing.split(/\r?\n/).includes(line))
  const suffix = [...header, ...additions].join('\n')
  return `${existing.replace(/\s*$/, '')}${existing.trim() ? '\n' : ''}${suffix}\n`
}
