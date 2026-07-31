import { NextRequest, NextResponse } from 'next/server';

// 推送更新服务端已废弃（博客已替代其功能），保留此代理仅作历史兼容
const PUSH_SERVER_URL = process.env.PUSH_SERVER_URL || 'http://127.0.0.1:23525';

async function proxyRequest(request: NextRequest, path: string) {
  const url = new URL(request.url);
  const targetUrl = `${PUSH_SERVER_URL}/api/${path}${url.search}`;

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'host') {
      headers[key] = value;
    }
  });

  let body: BodyInit | undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      body = await request.formData();
    } else {
      body = await request.text();
    }
  }

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      // @ts-ignore
      duplex: 'half',
    });

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'content-encoding') {
        responseHeaders[key] = value;
      }
    });

    const responseBody = await response.arrayBuffer();

    return new NextResponse(responseBody, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Push proxy error:', error);
    return NextResponse.json(
      { ok: false, error: '推送服务未运行或连接失败' },
      { status: 503 }
    );
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyRequest(request, path.join('/'));
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyRequest(request, path.join('/'));
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyRequest(request, path.join('/'));
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyRequest(request, path.join('/'));
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyRequest(request, path.join('/'));
}
