import type { RunUpgradeOffer } from '../systems/upgrades/upgradePool.ts'

export type RoomUpgradePickerHandle = {
  show: (
    offers: RunUpgradeOffer[],
    onPick: (offer: RunUpgradeOffer) => void,
  ) => void
  hide: () => void
}

/**
 * Single overlay in the DOM (`#room-upgrade-overlay`); no duplicate roots.
 */
export function mountRoomUpgradePicker(root: HTMLElement): RoomUpgradePickerHandle {
  const cardsEl = root.querySelector<HTMLElement>('#room-upgrade-cards')
  if (!cardsEl) {
    throw new Error('room upgrade: #room-upgrade-cards missing')
  }

  let lastHandler: ((e: Event) => void) | null = null

  return {
    show(offers, onPick) {
      cardsEl.replaceChildren()
      if (lastHandler) {
        cardsEl.removeEventListener('click', lastHandler)
        lastHandler = null
      }

      const handler = (e: Event) => {
        const t = (e.target as HTMLElement).closest<HTMLElement>(
          '[data-offer-id]',
        )
        if (!t) return
        const id = t.dataset.offerId
        const offer = offers.find((o) => o.id === id)
        if (!offer) return
        onPick(offer)
      }
      lastHandler = handler
      cardsEl.addEventListener('click', handler)

      for (const o of offers) {
        const card = document.createElement('button')
        card.type = 'button'
        card.className = 'room-upgrade-card'
        card.dataset.offerId = o.id
        card.setAttribute('aria-label', `${o.title}. ${o.description}`)

        const title = document.createElement('div')
        title.className = 'room-upgrade-card__title'
        title.textContent = o.title

        const desc = document.createElement('div')
        desc.className = 'room-upgrade-card__desc'
        desc.textContent = o.description

        card.append(title, desc)
        cardsEl.appendChild(card)
      }

      root.classList.remove('hidden')
      root.setAttribute('aria-hidden', 'false')
      cardsEl.querySelector<HTMLElement>('button')?.focus()
    },

    hide() {
      cardsEl.replaceChildren()
      if (lastHandler) {
        cardsEl.removeEventListener('click', lastHandler)
        lastHandler = null
      }
      root.classList.add('hidden')
      root.setAttribute('aria-hidden', 'true')
    },
  }
}
