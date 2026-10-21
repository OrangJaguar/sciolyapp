/**
 * Process BadgeSymbols/*.jpg → public/badges|avatars/*.png
 * - Remove dark backgrounds; keep white glyphs
 * - Crop to content, pad, export 256×256 PNG
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = process.cwd()
const SRC = path.join(ROOT, 'BadgeSymbols')
const OUT_BADGES = path.join(ROOT, 'public', 'badges')
const OUT_AVATARS = path.join(ROOT, 'public', 'avatars')
const SIZE = 256
const INNER = Math.round(SIZE * 0.86) // content fits inside ~86% of frame

const MAP = [
  ['Atom_with_three_orbit_rings', 'avatars', 'default_atom.png'],
  ['DNA_double_helix_glyph', 'avatars', 'default_dna.png'],
  ['Erlenmeyer_flask_with_bubbles', 'avatars', 'default_flask.png'],
  ['Microscope_emblem_glyph', 'avatars', 'default_microscope.png'],
  ['Minimalist_brain_emblem', 'avatars', 'default_brain.png'],
  ['Simple_rocket_vector_glyph', 'avatars', 'default_rocket.png'],
  ['Chevron_with_dot_icon_', 'badges', 'first_blood.png'],
  ['Square_segments_in_circular_ring', 'badges', 'week_streak.png'],
  ['Simple_hourglass_icon_vector', 'badges', 'timed_survivor.png'],
  ['Minimalist_anchor_badge_icon', 'badges', 'team_anchor.png'],
  ['Vector_target_badge_icon', 'badges', 'mission_runner.png'],
  ['Medical_cross_pulse_icon', 'badges', 'clinic_graduate.png'],
  ['Five-point_star_with_inner_circle', 'badges', 'event_specialist.png'],
  ['Binder_icon_with_rings', 'badges', 'binder_initiate.png'],
  ['Minimalist_centurion_helmet', 'badges', 'centurion.png'],
  ['Three_linked_chain_links_badge', 'badges', 'iron_streak.png'],
  ['Checkmark_inside_circle', 'badges', 'flawless_operator.png'],
  ['Lightning_bolt_crossing_circle', 'badges', 'blackout.png'],
  ['Simple_geometric_cube_badge', 'badges', 'black_box_veteran.png'],
  ['Laurel_wreath_badge_icon', 'badges', 'event_authority.png'],
  ['Three_interlocking_circles_emblem', 'badges', 'event_generalist.png'],
  ['Building_outline_with_medical_cross', 'badges', 'clinic_resident.png'],
  ['Radar_dish_signal_icon', 'badges', 'field_agent.png'],
  ['Three_stacked_binders_badge', 'badges', 'binder_ready.png'],
  ['Minimalist_Roman_shield', 'badges', 'praetorian.png'],
  ['Simple_flame_icon', 'badges', 'season_streak.png'],
  ['Snowflake_icon_vector_badge', 'badges', 'whiteout.png'],
  ['Terminal_window_icon', 'badges', 'black_box_operator.png'],
  ['Minimalist_crown_vector_badge_icon', 'badges', 'event_dominator.png'],
  ['Seven-pointed_star_badge_icon', 'badges', 'event_polymath.png'],
  ['Stethoscope_icon_vector_design', 'badges', 'clinic_chief.png'],
  ['Crossed_flags_vector_badge_icon', 'badges', 'unit_operator.png'],
  ['Abstract_eagle_badge_icon', 'badges', 'national_vanguard.png'],
  ['Vector_badge_icon_with_ring', 'badges', 'unbroken.png'],
  ['Globe_vector_badge_icon', 'badges', 'event_omnivore.png'],
  ['Three_lightning_bolts_emblem', 'badges', 'blackout_protocol.png'],
  ['Minimalist_vector_badge_icon_design', 'badges', 'hidden_sleeper_cell.png'],
  ['Vertical_line_inside_circle', 'badges', 'hidden_ghost_in_the_machine.png'],
  ['Three_stacked_horizontal_bars', 'badges', 'hidden_autodidact.png'],
  ['Circular_emblem_with_dash_and', 'badges', 'classified.png'],
]

function findSource(prefix) {
  const files = fs.readdirSync(SRC)
  const hit = files.find((f) => f.startsWith(prefix))
  return hit ? path.join(SRC, hit) : null
}

async function processOne(srcPath, outPath) {
  const { data, info } = await sharp(srcPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info
  const out = Buffer.alloc(width * height * 4)

  for (let i = 0; i < width * height; i++) {
    const s = i * channels
    const d = i * 4
    const r = data[s]
    const g = data[s + 1]
    const b = data[s + 2]
    const a = channels === 4 ? data[s + 3] : 255
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b

    let alpha
    if (a < 8) alpha = 0
    else if (lum < 40) alpha = 0
    else if (lum > 210) alpha = 255
    else alpha = Math.round(((lum - 40) / 170) * 255)

    alpha = Math.round((alpha * a) / 255)
    out[d] = 255
    out[d + 1] = 255
    out[d + 2] = 255
    out[d + 3] = alpha
  }

  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (out[(y * width + x) * 4 + 3] > 16) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }

  let glyph = sharp(out, { raw: { width, height, channels: 4 } })
  if (maxX >= minX && maxY >= minY) {
    glyph = glyph.extract({
      left: minX,
      top: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    })
  }

  const glyphBuf = await glyph
    .resize(INNER, INNER, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  const left = Math.round((SIZE - INNER) / 2)
  const top = Math.round((SIZE - INNER) / 2)

  await sharp({
    create: {
      width: SIZE,
      height: SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: glyphBuf, left, top }])
    .png({ compressionLevel: 9 })
    .toFile(outPath)
}

async function main() {
  fs.mkdirSync(OUT_BADGES, { recursive: true })
  fs.mkdirSync(OUT_AVATARS, { recursive: true })

  let ok = 0
  let miss = 0
  for (const [prefix, kind, filename] of MAP) {
    const src = findSource(prefix)
    if (!src) {
      console.warn('MISSING', prefix, '→', filename)
      miss += 1
      continue
    }
    const outDir = kind === 'avatars' ? OUT_AVATARS : OUT_BADGES
    const outPath = path.join(outDir, filename)
    await processOne(src, outPath)
    ok += 1
    console.log('OK', path.basename(src), '→', `${kind}/${filename}`)
  }
  console.log(`\nDone: ${ok} written, ${miss} missing`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
