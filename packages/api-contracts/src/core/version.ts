import { z } from 'zod'

export const API_VERSION = 'v1' as const
export const CONTRACT_VERSION = '1.0.0' as const
export const SUPPORTED_MAJOR_VERSION = 1

const SEMVER_REGEX = /^(\d+)\.(\d+)\.(\d+)$/

export interface SemanticVersion {
  major: number
  minor: number
  patch: number
}

export function parseSemanticVersion(value: string): SemanticVersion {
  const match = value.match(SEMVER_REGEX)
  if (!match) {
    throw new Error(`Invalid semantic version: "${value}"`)
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  }
}

export function isSupportedMajorVersion(version: string): boolean {
  try {
    const parsed = parseSemanticVersion(version)
    return parsed.major === SUPPORTED_MAJOR_VERSION
  } catch {
    return false
  }
}

export function formatContractVersion(major: number, minor: number, patch: number): string {
  return `${major}.${minor}.${patch}`
}

export const SemanticVersionSchema = z.string().regex(SEMVER_REGEX, 'Must be a valid semantic version')

export const ApiVersionSchema = z.literal('v1')
