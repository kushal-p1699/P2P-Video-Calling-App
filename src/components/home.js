import React, { Component } from "react";

import io from "socket.io-client";

import Video from "./video";
import Videos from "./videos";

import Chat from "./chat";

import Draggable from "./draggable";
import CallEndIcon from "@material-ui/icons/CallEnd";
import IconButton from "@material-ui/core/IconButton";

class Home extends Component {
  constructor(props) {
    super(props);

    this.state = {
      localStream: null, // used to hold local stream object 
      remoteStream: null, // used to hold remote stream object 

      remoteStreams: [], 
      peerConnections: {}, 
      selectedVideo: null,

      status: "Please wait...", // initial status

      pc_config: {
        iceServers: [
          {
            urls: "stun:stun.l.google.com:19302",
          },
        ],
      },

      sdpConstraints: {
        mandatory: {
          OfferToReceiveAudio: true,
          OfferToReceiveVideo: true,
        },
      },

      messages: [],
      sendChannels: [],
      disconnected: false,
    };

    // url
    this.serviceIP = "/webrtcPeer";

    this.socket = null;
    // this.candidates = []
  }

  getLocalStream = () => {
    
    const success = (stream) => {
      window.localStream = stream;
      this.setState({
        localStream: stream,
      });
      this.whoisOnline();
    };

    const failure = (e) => {
      console.log("getUserMedia Error: ", e);
    };

    const constraints = {
      audio: true,
      video: true,
      options: {
        mirror: true,
      },
    };

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then(success)
      .catch(failure);
  };

  whoisOnline = () => {
    this.sendToPeer("onlinePeers", null, { local: this.socket.id });
  };

  sendToPeer = (messageType, payload, socketID) => {
    this.socket.emit(messageType, {
      socketID,
      payload,
    });
  };

  createPeerConnection = (socketID, callback) => {
    try {
      let pc = new RTCPeerConnection(this.state.pc_config);

      // add pc to peerConnections object
      const peerConnections = { ...this.state.peerConnections, [socketID]: pc };
      this.setState({
        peerConnections,
      });

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          this.sendToPeer("candidate", e.candidate, {
            local: this.socket.id,
            remote: socketID,
          });
        }
      };

      pc.oniceconnectionstatechange = (e) => {
      };

      pc.ontrack = (e) => {
        let _remoteStream = null;
        let remoteStreams = this.state.remoteStreams;
        let remoteVideo = {};

        // check if stream already exists in remoteStreams
        const rVideos = this.state.remoteStreams.filter(
          (stream) => stream.id === socketID
        );

        // if it does exist then add track
        if (rVideos.length) {
          _remoteStream = rVideos[0].stream;
          _remoteStream.addTrack(e.track, _remoteStream);

          remoteVideo = {
            ...rVideos[0],
            stream: _remoteStream,
          };
          remoteStreams = this.state.remoteStreams.map((_remoteVideo) => {
            return (
              (_remoteVideo.id === remoteVideo.id && remoteVideo) ||
              _remoteVideo
            );
          });
        } else {
          // 3. if not, then create new stream and add track
          _remoteStream = new MediaStream();
          _remoteStream.addTrack(e.track, _remoteStream);

          remoteVideo = {
            id: socketID,
            name: socketID,
            stream: _remoteStream,
          };
          remoteStreams = [...this.state.remoteStreams, remoteVideo];
        }

        this.setState((prevState) => {
          // If we already have a stream in display let it stay the same, otherwise use the latest stream
          const remoteStream =
            prevState.remoteStreams.length > 0
              ? {}
              : { remoteStream: _remoteStream };

          // get currently selected video
          let selectedVideo = prevState.remoteStreams.filter(
            (stream) => stream.id === prevState.selectedVideo.id
          );
          // if the video is still in the list, then do nothing, otherwise set to new video stream
          selectedVideo = selectedVideo.length
            ? {}
            : { selectedVideo: remoteVideo };

          return {
            ...selectedVideo,
            ...remoteStream,
            remoteStreams, 
          };
        });
      };

      pc.close = () => {
        // alert('closed')
        console.log("pc closed");
      };

      if (this.state.localStream)
        this.state.localStream.getTracks().forEach((track) => {
          pc.addTrack(track, this.state.localStream);
        });

      callback(pc);
    } catch (e) {
      console.log("Something went wrong! pc not created!!", e);
      callback(null);
    }
  };

  componentDidMount = () => {
    this.socket = io.connect(this.serviceIP, {
      path: "/io/webrtc",
      query: {
        room: window.location.pathname,
      },
    });

    this.socket.on("connection-success", (data) => {
      this.getLocalStream();
      // console.log(data.success)
      const status =
        data.peerCount > 1
          ? "Two peers are connected"
          : "Waiting for other peers to connect";

      this.setState({
        status: status,
        messages: data.messages,
      });
    });

    this.socket.on("joined-peers", (data) => {
      this.setState({
        status:
          data.peerCount > 1
            ? "Two peers are connected"
            : "Waiting for other peers to connect",
      });
    });
    this.socket.on("peer-disconnected", (data) => {
      // close peer-connection with this peer
      this.state.peerConnections[data.socketID].close();

      // get and stop remote audio and video tracks of the disconnected peer
      const rVideo = this.state.remoteStreams.filter(
        (stream) => stream.id === data.socketID
      );
      rVideo && this.stopTracks(rVideo[0].stream);

      // filter out the disconnected peer stream
      const remoteStreams = this.state.remoteStreams.filter(
        (stream) => stream.id !== data.socketID
      );

      this.setState((prevState) => {
        // check if disconnected peer is the selected video and if there still connected peers, then select the first
        const selectedVideo =
          prevState.selectedVideo.id === data.socketID && remoteStreams.length
            ? { selectedVideo: remoteStreams[0] }
            : null;

        return {  
          remoteStreams,
          ...selectedVideo,
          status:
            data.peerCount > 1
              ? "Two peers are connected"
              : "Waiting for other peers to connect",
        };
      });
    });

    this.socket.on("online-peer", (socketID) => {
      // Create new pc
      this.createPeerConnection(socketID, (pc) => {
        //Create Offer
        if (pc) {
          // Send Channel
          const handleSendChannelStatusChange = (event) => {
            console.log(
              "send channel status: " + this.state.sendChannels[0].readyState
            );
          };

          const sendChannel = pc.createDataChannel("sendChannel");
          sendChannel.onopen = handleSendChannelStatusChange;
          sendChannel.onclose = handleSendChannelStatusChange;

          this.setState((prevState) => {
            return {
              sendChannels: [...prevState.sendChannels, sendChannel],
            };
          });

          // Receive Channels
          const handleReceiveMessage = (event) => {
            const message = JSON.parse(event.data);
            // console.log(message)
            this.setState((prevState) => {
              return {
                messages: [...prevState.messages, message],
              };
            });
          };

          const handleReceiveChannelStatusChange = (event) => {
            if (this.receiveChannel) {
              console.log(
                "receive channel's status has changed to " +
                  this.receiveChannel.readyState
              );
            }
          };

          const receiveChannelCallback = (event) => {
            const receiveChannel = event.channel;
            receiveChannel.onmessage = handleReceiveMessage;
            receiveChannel.onopen = handleReceiveChannelStatusChange;
            receiveChannel.onclose = handleReceiveChannelStatusChange;
          };

          pc.ondatachannel = receiveChannelCallback;

          pc.createOffer(this.state.sdpConstraints).then((sdp) => {
            pc.setLocalDescription(sdp);

            this.sendToPeer("offer", sdp, {
              local: this.socket.id,
              remote: socketID,
            });
          });
        }
      });
    });

    this.socket.on("offer", (data) => {
      this.createPeerConnection(data.socketID, (pc) => {
        pc.addStream(this.state.localStream);

        // Send Channel
        const handleSendChannelStatusChange = (event) => {
          console.log(
            "send channel status: " + this.state.sendChannels[0].readyState
          );
        };

        const sendChannel = pc.createDataChannel("sendChannel");
        sendChannel.onopen = handleSendChannelStatusChange;
        sendChannel.onclose = handleSendChannelStatusChange;

        this.setState((prevState) => {
          return {
            sendChannels: [...prevState.sendChannels, sendChannel],
          };
        });

        // Receive Channels
        const handleReceiveMessage = (event) => {
          const message = JSON.parse(event.data);
          // console.log(message)
          this.setState((prevState) => {
            return {
              messages: [...prevState.messages, message],
            };
          });
        };

        const handleReceiveChannelStatusChange = (event) => {
          if (this.receiveChannel) {
            console.log(
              "receive channel's status has changed to " +
                this.receiveChannel.readyState
            );
          }
        };

        const receiveChannelCallback = (event) => {
          const receiveChannel = event.channel;
          receiveChannel.onmessage = handleReceiveMessage;
          receiveChannel.onopen = handleReceiveChannelStatusChange;
          receiveChannel.onclose = handleReceiveChannelStatusChange;
        };

        pc.ondatachannel = receiveChannelCallback;

        pc.setRemoteDescription(new RTCSessionDescription(data.sdp)).then(
          () => {
            // 2. Create Answer
            pc.createAnswer(this.state.sdpConstraints).then((sdp) => {
              pc.setLocalDescription(sdp);

              this.sendToPeer("answer", sdp, {
                local: this.socket.id,
                remote: data.socketID,
              });
            });
          }
        );
      });
    });

    this.socket.on("answer", (data) => {
      // get remote's peerConnection
      const pc = this.state.peerConnections[data.socketID];
      // console.log(data.sdp)
      pc.setRemoteDescription(
        new RTCSessionDescription(data.sdp)
      ).then(() => {});
    });

    this.socket.on("candidate", (data) => {
      // get remote's peerConnection
      const pc = this.state.peerConnections[data.socketID];

      if (pc) pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    });
    
    // this.pc.onicecandidate = (e) => {
    //   // send the candidates to the remote peer
    //   // see addCandidate below to be triggered on the remote peer
    //   if (e.candidate) {
    //     // console.log(JSON.stringify(e.candidate))
    //     this.sendToPeer('candidate', e.candidate)
    //   }
    // }
  };

  disconnectSocket = (socketToDisconnect) => {
    this.sendToPeer("socket-to-disconnect", null, {
      local: this.socket.id,
      remote: socketToDisconnect,
    });
  };

  mutecamera = (e) => {
    const stream = this.video.srcObject.getTracks().filter(track => track.kind === 'video')
    this.setState(prevState => {
      if (stream) stream[0].enabled = !prevState.camera
      return {camera: !prevState.camera}
    })
  }

  switchVideo = (_video) => {
    // console.log(_video)
    this.setState({
      selectedVideo: _video,
    });
  };
  stopTracks = (stream) => {
    stream.getTracks().forEach((track) => track.stop());
  };

  render() {
    const {
      status,
      messages,
      disconnected,
      localStream,
      peerConnections,
      remoteStreams,
    } = this.state;

    if (disconnected) {
      // disconnect socket
      this.socket.close();
      // stop local audio & video tracks
      this.stopTracks(localStream);

      // stop all remote audio & video tracks
      remoteStreams.forEach((rVideo) => this.stopTracks(rVideo.stream));

      // stop all remote peerconnections
      peerConnections &&
        Object.values(peerConnections).forEach((pc) => pc.close());
        this.props.history.push("/");
      return <div>You have successfully Disconnected</div>;
    }

    const statusText = (
      <div style={{ color: "yellow", padding: 5 }}>{status}</div>
    );

    return (
      <div>
        <Draggable
          style={{
            zIndex: 101,
            position: "absolute",
            right: 0,
            cursor: "move",
          }}
        >
          <Video
            videoType="localVideo"
            videoStyles={{
              width: 200,
            }}
            frameStyle={{
              width: 200,
              margin: 5,
              borderRadius: 5,
              backgroundColor: "black",
            }}
            showMuteControls={true}
            // ref={this.localVideoref}
            videoStream={localStream}
            autoPlay
            muted
          ></Video>
        </Draggable>
        {/* <Video
          frameStyle={{
            zIndex: 1,
            position: 'fixed',
            bottom: 0,
            minWidth: '100%', minHeight: '100%',
            backgroundColor: 'black'
          }}
         */}
        <br />
        <div
          style={{
            zIndex: 3,
            position: "absolute",
            // margin: 10,
          }}
        >
          <div
            style={{
              margin: 10,
              backgroundColor: "#cdc4ff4f",
              padding: 10,
              borderRadius: 5,
            }}
          >
            {statusText}
          </div>
        </div>

        <div
          style={{
            zIndex: 2,
            margin: 10,
            backgroundColor: "white",
            padding: 10,
            borderRadius: 50,
            position: "absolute",
            bottom: 0,
            left: "45%",
          }}
        >
          <IconButton
            onClick={(e) => {
              this.setState({ disconnected: true });
              var alertResponse = window.confirm(
                "Are you sure want to END CALL ? "
              );
              if (alertResponse) {
                this.mutecamera(e)
                this.setState({ disconnected: true });
                // this.props.history.push("/");
              }
            }}
          >
            <CallEndIcon
              style={{
                color: "red",
                fontSize: "36px",
              }}
            ></CallEndIcon>
          </IconButton>
        </div>

        <div>
          <Videos
            switchVideo={this.switchVideo}
            remoteStreams={remoteStreams}
          ></Videos>
        </div>
        <br />

        <Chat
          user={{
            uid: (this.socket && this.socket.id) || "",
          }}
          messages={messages}
          sendMessage={(message) => {
            this.setState((prevState) => {
              return { messages: [...prevState.messages, message] };
            });
            this.state.sendChannels.map((sendChannel) => {
              sendChannel.readyState === "open" &&
                sendChannel.send(JSON.stringify(message));
            });
            this.sendToPeer("new-message", JSON.stringify(message), {
              local: this.socket.id,
            });
          }}
        />
      </div>
    );
  }
}

export default Home;
