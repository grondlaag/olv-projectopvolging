import { useEffect } from "react"

const focusableSelector = [
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "a[href]",
  "[tabindex]:not([tabindex='-1'])",
].join(",")

function dialogs(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[role="dialog"]')]
}

export function useDialogFocusManagement(): void {
  useEffect(() => {
    const returnFocus = new WeakMap<HTMLElement, HTMLElement>()
    let known = new Set<HTMLElement>()

    function synchronize() {
      const current = dialogs()
      const currentSet = new Set(current)
      for (const dialog of current) {
        if (known.has(dialog)) continue
        const opener = document.activeElement
        if (opener instanceof HTMLElement) returnFocus.set(dialog, opener)
        window.requestAnimationFrame(() => {
          const preferred = dialog.querySelector<HTMLElement>("[autofocus]")
          const first =
            preferred ?? dialog.querySelector<HTMLElement>(focusableSelector)
          ;(first ?? dialog).focus()
        })
      }
      for (const dialog of known) {
        if (currentSet.has(dialog)) continue
        const opener = returnFocus.get(dialog)
        if (opener?.isConnected) opener.focus()
      }
      known = currentSet
    }

    function trapTab(event: KeyboardEvent) {
      if (event.key !== "Tab") return
      const dialog = dialogs().at(-1)
      if (!dialog) return
      const focusable = [
        ...dialog.querySelectorAll<HTMLElement>(focusableSelector),
      ]
      if (!focusable.length) return
      const first = focusable[0]!
      const last = focusable.at(-1)!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    const observer = new MutationObserver(synchronize)
    observer.observe(document.body, { childList: true, subtree: true })
    document.addEventListener("keydown", trapTab)
    synchronize()
    return () => {
      observer.disconnect()
      document.removeEventListener("keydown", trapTab)
    }
  }, [])
}
