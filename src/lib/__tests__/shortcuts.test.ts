import { describe, it, expect, vi } from 'vitest'
import { isTypingTarget, matchesShortcut, type ShortcutDefinition } from '@/hooks/use-shortcuts'

describe('use-shortcuts utility functions', () => {
  describe('isTypingTarget', () => {
    it('detects input, textarea, and select elements', () => {
      const input = { tagName: 'INPUT' } as unknown as EventTarget
      const textarea = { tagName: 'TEXTAREA' } as unknown as EventTarget
      const select = { tagName: 'SELECT' } as unknown as EventTarget
      const div = { tagName: 'DIV' } as unknown as EventTarget
      const editableDiv = { tagName: 'DIV', isContentEditable: true } as unknown as EventTarget

      expect(isTypingTarget(input)).toBe(true)
      expect(isTypingTarget(textarea)).toBe(true)
      expect(isTypingTarget(select)).toBe(true)
      expect(isTypingTarget(editableDiv)).toBe(true)
      expect(isTypingTarget(div)).toBe(false)
      expect(isTypingTarget(null)).toBe(false)
    })
  })

  describe('matchesShortcut', () => {
    it('matches single keys like Space and Enter', () => {
      const spaceSc: ShortcutDefinition = {
        key: ' ',
        description: 'Space action',
        action: vi.fn(),
      }
      const enterSc: ShortcutDefinition = {
        key: 'Enter',
        description: 'Enter action',
        action: vi.fn(),
      }

      const spaceEvent = { key: ' ', code: 'Space', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false } as KeyboardEvent
      const enterEvent = { key: 'Enter', code: 'Enter', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false } as KeyboardEvent
      const rEvent = { key: 'r', code: 'KeyR', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false } as KeyboardEvent

      expect(matchesShortcut(spaceEvent, spaceSc)).toBe(true)
      expect(matchesShortcut(rEvent, spaceSc)).toBe(false)
      expect(matchesShortcut(enterEvent, enterSc)).toBe(true)
    })

    it('matches modifier keys like Alt+R or Ctrl+Space', () => {
      const altRSc: ShortcutDefinition = {
        key: 'r',
        modifiers: ['alt'],
        description: 'Replay audio',
        action: vi.fn(),
      }

      const altREvent = { key: 'r', code: 'KeyR', altKey: true, ctrlKey: false, metaKey: false, shiftKey: false } as KeyboardEvent
      const plainREvent = { key: 'r', code: 'KeyR', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false } as KeyboardEvent
      const ctrlREvent = { key: 'r', code: 'KeyR', altKey: false, ctrlKey: true, metaKey: false, shiftKey: false } as KeyboardEvent

      expect(matchesShortcut(altREvent, altRSc)).toBe(true)
      expect(matchesShortcut(plainREvent, altRSc)).toBe(false)
      expect(matchesShortcut(ctrlREvent, altRSc)).toBe(false)
    })
  })
})
