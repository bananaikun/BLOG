import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DATA_FILE = path.join(process.cwd(), 'data', 'urge_server.json')

interface UrgeRecord {
  count: number
  lastUrgedAt?: string
  history: Array<{ at: string; userFingerprint?: string }>
}

async function loadRecord(): Promise<UrgeRecord> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8')
    const data = JSON.parse(raw)
    if (typeof data.count === 'number') return data
  } catch {}
  return { count: 0, history: [] }
}

async function saveRecord(rec: UrgeRecord) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true })
  await fs.writeFile(DATA_FILE, JSON.stringify(rec, null, 2), 'utf8')
}

export async function GET() {
  const rec = await loadRecord()
  return NextResponse.json({
    success: true,
    count: rec.count,
    lastUrgedAt: rec.lastUrgedAt,
  })
}

export async function POST(request: NextRequest) {
  const rec = await loadRecord()
  const fp = request.headers.get('x-urge-fp') || undefined
  rec.count += 1
  rec.lastUrgedAt = new Date().toISOString()
  rec.history.push({ at: rec.lastUrgedAt, userFingerprint: fp })
  // 只保留最近 50 条
  if (rec.history.length > 50) rec.history = rec.history.slice(-50)
  await saveRecord(rec)
  return NextResponse.json({
    success: true,
    count: rec.count,
    lastUrgedAt: rec.lastUrgedAt,
  })
}
