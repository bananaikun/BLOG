import { NextResponse } from 'next/server';
import * as os from 'os';

export async function GET() {
  try {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    // 计算 CPU 使用率
    let totalIdle = 0;
    let totalTick = 0;
    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += (cpu.times as any)[type];
      }
      totalIdle += cpu.times.idle;
    }
    const cpuUsage = totalTick > 0 ? ((1 - totalIdle / totalTick) * 100) : 0;

    return NextResponse.json({
      cpu: Math.max(0, Math.min(100, cpuUsage)),
      memory: {
        total: totalMem,
        used: totalMem - freeMem,
        free: freeMem,
        percent: totalMem > 0 ? ((totalMem - freeMem) / totalMem) * 100 : 0,
      },
      uptime: os.uptime(),
      loadAvg: os.loadavg(),
      platform: os.platform(),
      hostname: os.hostname(),
      nodeVersion: process.version,
      cpuCount: cpus.length,
      cpuModel: cpus[0]?.model || 'Unknown',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
