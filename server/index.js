const { WebSocketServer } = require("ws")
const secret = require("./secret.js")

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

    if (PEER_CONFIGURATION && secret.PEER_CONFIGURATION.iceServers) {
        // static turn server

        console.log("using static stun/turn")
        ws.send(JSON.stringify({
            "type": "init",
            "data": {
                "id": id,
                "ice_server": secret.PEER_CONFIGURATION.iceServers
            }
        }))

    } else {
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