const WebSocket = require('ws');
const url = process.argv[2];
const ws = new WebSocket(url);
let id = 1;
const send = (method, params) => new Promise((res, rej) => {
    const myId = id++;
    const handler = (data) => {
        const msg = JSON.parse(data);
        if (msg.id === myId) {
            ws.off('message', handler);
            if (msg.error) rej(msg.error); else res(msg.result);
        }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({id: myId, method, params}));
});

const logs = [];
let isOpen = false;
ws.on('message', (data) => {
    const m = JSON.parse(data);
    if (m.method === 'Runtime.consoleAPICalled') {
        const args = (m.params.args || []).map(a => a.value !== undefined ? a.value : (a.description || JSON.stringify(a))).join(' ');
        console.log('[CONSOLE.' + m.params.type + ']', args);
    } else if (m.method === 'Runtime.exceptionThrown') {
        console.log('[EXCEPTION]', m.params.exceptionDetails.text);
        console.log('  URL:', m.params.exceptionDetails.url);
        if (m.params.exceptionDetails.exception) {
            console.log('  Desc:', m.params.exceptionDetails.exception.description);
        }
        if (m.params.exceptionDetails.stackTrace) {
            m.params.exceptionDetails.stackTrace.callFrames.slice(0, 5).forEach(f => {
                console.log('  at:', f.functionName || '<anon>', f.url, ':' + f.lineNumber + ':' + f.columnNumber);
            });
        }
    } else if (m.method === 'Log.entryAdded') {
        console.log('[LOG.' + m.params.entry.level + ']', m.params.entry.text);
    } else if (m.method === 'Page.frameNavigated') {
        console.log('[NAV]', m.params.frame.url);
    }
});

ws.on('open', async () => {
    isOpen = true;
    console.log('WS opened');
    await send('Runtime.enable');
    await send('Log.enable');
    await send('Page.enable');
    await send('Page.reload', { ignoreCache: true });
    setTimeout(() => { console.log('=== Test done ==='); ws.close(); process.exit(0); }, 10000);
});
ws.on('error', (e) => { console.log('WS error:', e.message); process.exit(1); });
ws.on('close', () => { console.log('WS closed'); process.exit(0); });
