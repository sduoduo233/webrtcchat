$(async function () {
  const WS = "ws://127.0.0.1:8000/"

  $("#btn-mute").hide()
  $("#connected").hide()

  /** @type {string | null} */
  let id = null

  /** @type {Map<string, RTCPeerConnection>} */
  let peerConnections = new Map()
  /** @type {Map<string, RTCDataChannel>} */
  let dataChannels = new Map()

  let pcConfiguration = {
    iceServers: []
  }

  /** 
   * initialize event listeners for pc
   * @param {RTCPeerConnection} pc 
   * @param {string} peerId
   */
  function initPC(pc, peerId) {

    // send ice icecandidate
    pc.addEventListener("icecandidate", (e) => {
      if (!e.candidate) return;
      console.log("icecandidate", peerId)
      send({ type: "icecandidate", "data": e.candidate }, peerId)
    })

    pc.addEventListener("connectionstatechange", (e) => {
      if (pc.connectionState === "connected") {
        console.log("peer connected", peerId)
      }
      pc.createDataChannel
    })

    // add html audio element
    pc.addEventListener("track", (e) => {
      console.log("track", peerId)
      let stream = new MediaStream([e.track])
      let element = $("<div class=\"peer\"><p></p><audio controls></audio></div>")

      element.attr("id", "audio-" + peerId)
      $("#audio").append(element)
      element.find("p").text(peerId)
      element.find("audio").get(0).srcObject = stream
      element.find("audio").get(0).play()
    })

  }

  // acquire audio input
  let mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: true
  })
  let audioTracks = mediaStream.getAudioTracks()

  // choose audio input device
  for (let i = 0; i < audioTracks.length; i++) {
    let option = $("<option></option>")
    option.attr("value", i)
    option.text(`${audioTracks[i].kind} - ${audioTracks[i].label}`)
    $("#audio-input").append(option)
  }

  let i = await (new Promise((resolve, reject) => {
    $("#btn-connect").one("click", function () {
      resolve(parseInt($("#audio-input").val()))
    })
  }))
  let audioTrack = audioTracks[i]

  console.log("audio track", audioTrack)

  $("#connected").show()
  $("#not-connected").remove()
  $("#audio-input").attr("disabled", true)
  $("#btn-connect").attr("disabled", true)

  // mute button
  $("#btn-mute").show()
  $("#btn-mute").on("click", function () {
    if ($("#btn-mute").text() === "Mute") {
      audioTrack.enabled = false
      $("#btn-mute").text("Unmute")
    } else {
      audioTrack.enabled = true
      $("#btn-mute").text("Mute")
    }
  })

  // chat
  $("#btn-send").on("click", function () {
    if (id === null) return
    let msg = $("#input-chat").val()
    dataChannels.forEach(c => {
      c.send(msg)
    })
    $("#chat").val($("#chat").val() + id + ": " + msg.replace("\n", " ") + "\n")
    $("#input-chat").val("")
  })

  // connect to websocket server
  const ws = new WebSocket(WS)

  /** send a message to another client */
  function send(msg, to) {
    msg["from"] = id
    msg["to"] = to
    ws.send(JSON.stringify(msg))
  }

  ws.addEventListener("error", (e) => {
    alert("WebSocket connection failed")
  })

  let keepAliveInterval = null;

  ws.addEventListener("open", () => {
    console.log("websocket connected")

    keepAliveInterval = setInterval(() => {
      send({ "type": "ping", "payload": crypto.randomUUID() }, "server")
    }, 5000);
  })

  ws.addEventListener("close", () => {
    alert("WebSocket connection closed")
    if (keepAliveInterval !== null) clearInterval(keepAliveInterval);
  })

  ws.addEventListener("message", async (e) => {
    let msg = JSON.parse(e.data)

    if (msg.type === "list") {

      // send offer to all other peers
      for (let peerId of msg.data) {
        console.log("send offer", peerId)

        let pc = new RTCPeerConnection(pcConfiguration)

        // audio track
        pc.addTrack(audioTrack)
        peerConnections.set(peerId, pc)
        // data channel
        let channel = pc.createDataChannel("chat")
        channel.addEventListener("message", function (e) {
          $("#chat").val($("#chat").val() + peerId + ": " + e.data + "\n")
        })
        dataChannels.set(peerId, channel)

        let offer = await pc.createOffer({
          offerToReceiveAudio: true
        })
        await pc.setLocalDescription(offer)

        initPC(pc, peerId)

        send({ "type": "offer", "data": offer }, peerId)
      }

    } else if (msg.type === "init") {

      id = msg.data.id
      pcConfiguration.iceServers.push(msg.data["ice_server"])
      console.log("id", id)
      console.log("ice servers", pcConfiguration.iceServers)

      // get a list of connected clients
      send({ "type": "list" }, "server")

    } else if (msg.type === "offer") {

      // reply to offers

      console.log("send answer", msg.from)

      let pc = new RTCPeerConnection(pcConfiguration)

      // audio track
      pc.addTrack(audioTrack)
      // data channel
      pc.addEventListener("datachannel", function (e) {
        let channel = e.channel;
        channel.addEventListener("message", function (e) {
          $("#chat").val($("#chat").val() + msg.from + ": " + e.data.replace("\n", " ") + "\n")
        })
        dataChannels.set(msg.from, channel)
      })

      peerConnections.set(msg.from, pc)

      initPC(pc, msg.from)

      await pc.setRemoteDescription(new RTCSessionDescription(msg.data))
      let answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      send({ "type": "answer", "data": answer }, msg.from)

    } else if (msg.type === "answer") {

      console.log("receive answer", msg.from)

      let pc = peerConnections.get(msg.from)
      await pc.setRemoteDescription(new RTCSessionDescription(msg.data))

    } else if (msg.type === "icecandidate") {

      console.log("add icecandidate", msg.from)
      let pc = peerConnections.get(msg.from)
      pc.addIceCandidate(msg.data)

    } else if (msg.type === "disconnect") {

      console.log("peer disconnected")
      if (!peerConnections.has(msg.data)) {
        return
      }
      // remove html audio element
      $("#audio-" + msg.data).remove()
      // close rtc peer connection
      dataChannels.get(msg.data).close()
      dataChannels.delete(msg.data)
      peerConnections.get(msg.data).close()
      peerConnections.delete(msg.data)

    } else if (msg.type === "pong") {

    } else {

      console.error("unknown message type", msg.type)

    }

  })

})