import { LegalLayout } from '../../components/landing/LegalLayout'
import { privacySections } from '../../lib/legalCopy'

export function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy"
      lede="What scioly.app stores, who on your team can see it, and which services help run the app."
      sections={privacySections}
    />
  )
}
