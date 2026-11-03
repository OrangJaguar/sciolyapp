/** Build events from the 2027 Division C list. They are not question banks. */
export const BUILD_EVENT_IDS = new Set([
  'boomilever',
  'electric_vehicle',
  'mission_possible',
  'ping_pong_parachute',
  'wright_stuff',
])

export function isStudyableEvent(event: { id: string; studyable?: boolean }): boolean {
  if (BUILD_EVENT_IDS.has(event.id)) return false
  return event.studyable !== false
}
