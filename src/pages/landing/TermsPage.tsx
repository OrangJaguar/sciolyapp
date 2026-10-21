import { LegalLayout } from '../../components/landing/LegalLayout'
import { termsSections } from '../../lib/legalCopy'

export function TermsPage() {
  return (
    <LegalLayout
      title="Terms"
      lede="The rules for using scioly.app — a student-built practice tool, not an official Science Olympiad product."
      sections={termsSections}
    />
  )
}
