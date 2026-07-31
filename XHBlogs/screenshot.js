const WebSocket = require('ws');
const fs = require('fs');
const url = process.argv[2];
const outPath = process.argv[3];

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

ws.on('open', async () => {
    try {
        const r = await send('Page.captureScreenshot', {format: 'png'});
        console.log('base64 length:', r.data.length);
        const buf = Buffer.from(r.data, 'base64');
        fs.writeFileSync(outPath, buf);
        console.log('Saved:', outPath, 'size:', buf.length);
    } catch (e) {
        console.log('Error:', e.message || e);
    }
    ws.close();
    setTimeout(() => process.exit(0), 500);
});
ws.on('error', (e) => { console.log('WS error:', e.message); process.exit(1); });