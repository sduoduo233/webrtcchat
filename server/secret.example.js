
// Create your api token at https://dash.cloudflare.com/?to=/:account/calls

module.exports = {
    CF_TOKEN_ID: "",
    CF_API_TOKEN: "",
    PEER_CONFIGURATION: {
        "iceServers": [
            {
                "urls": [
                    "stun://example.com",
                    "turn://example.com?transport=udp",
                    "turns://example.com?transport=tcp"
                ],
                "username": "",
                "credential": ""
            }
        ]
    }
}
