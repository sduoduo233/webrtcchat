
// Create your api token at https://dash.cloudflare.com/?to=/:account/calls

module.exports = {
    TURN: "coturn", // "coturn" or "cloudflare"

    CF_TOKEN_ID: "",
    CF_API_TOKEN: "",

    COTURN_SERVER: [
        "turn:example.com:3478?transport=udp",
        "turn:example.com:3478?transport=tcp"
    ],
    COTURN_SECRET: "example"
}