const { WebSocketServer } = require("ws")
const secret = require("./secret.js")
const { createHmac } = require('node:crypto');

console.log("voice chat server")

const wss = new WebSocketServer({
    port: 8000,
    perMessageDeflate: false,
    host: "127.0.0.1"
})


const clients = new Map()

let n = 1;

wss.on("connection", (ws) => {
    const id = "user" + n
    n += 1
    clients.set(id, ws)

    console.log("new connection", id)

    if (secret.TURN === "coturn") {
        // static turn server

        console.log("using static stun/turn")

        const username = Math.floor(+new Date() / 1000 + 60 * 60) + ":" + id;
        const credential = createHmac("sha1", secret.COTURN_SECRET).update(username).digest("base64");

        ws.send(JSON.stringify({
            "type": "init",
            "data": {
                "id": id,
                "ice_server": [
                    {
                        "urls": [
                            "stun:turn.cloudflare.com",
                            "stun:stun.miwifi.com",
                            "stun:stun.chat.bilibili.com",
                            "stun:stun1.l.google.com",
                            "stun:stun2.l.google.com",
                            "stun:stun3.l.google.com",
                            "stun:stun4.l.google.com"
                        ]
                    },
                    {
                        "urls": secret.COTURN_SERVER,
                        "username": username,
                        "credential": credential
                    }
                ]
            }
        }))

    } else if (secret.TURN === "cloudflare") {
        // cloudflare turn server
        fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${secret.CF_TOKEN_ID}/credentials/generate`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + secret.CF_API_TOKEN
            },
            body: "{\"ttl\": 3600}"
        })
            .then(r => r.json())
            .then(r => {
                if (r.error) {
                    console.error("cloudflare turn", r);
                    return;
                }
                console.log("using cloudflare stun/turn")
                ws.send(JSON.stringify({
                    "type": "init",
                    "data": {
                        "id": id,
                        "ice_server": r["iceServers"]
                    }
                }))
            })
    } else {
        throw new Error("bad `secret.TURN`");
    }

    

    for (let [k, v] of clients.entries()) {
        if (k === id) continue;
        v.send(JSON.stringify({
            "type": "connect",
            "data": id,
            "from": "server",
            "to": k
        }))
    }


    ws.on("close", () => {
        console.log("connection closed", id)
        clients.delete(id);
        for (let [k, v] of clients.entries()) {
            v.send(JSON.stringify({
                "type": "disconnect",
                "data": id,
                "from": "server",
                "to": k
            }))
        }
    })

    ws.on("message", (data) => {
        const msg = JSON.parse(data.toString())

        if (msg.from !== id) {
            return
        }

        if (msg.type === "list") {
            let ids = [...clients.keys()]
            ids = ids.filter((v) => v !== id)
            ws.send(JSON.stringify({
                "type": "list",
                "data": ids
            }))
            return
        }

        if (msg.type === "ping") {
            ws.send(JSON.stringify({
                "type": "pong",
                "from": "server",
                "to": id
            }))
            return
        }

        if (!clients.has(msg.to)) {
            console.log("receiver does not exist", msg.to, id)
            return
        }
        clients.get(msg.to).send(JSON.stringify(msg))

    })

    ws.on("error", (e) => {
        console.error(e)
    })

})