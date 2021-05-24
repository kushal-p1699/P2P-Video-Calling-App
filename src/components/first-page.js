import React, { Component } from "react";
import Button from "@material-ui/core/Button";
import VideocamIcon from "@material-ui/icons/Videocam";
class FirstPage extends Component {
  on_click = () => {
    this.props.history.push("/home");
  };

  render() {
    return (
      <div>
        <div>
          <div
            style={{
              overflow: "hidden",
              backgroundColor: "black",
              position: "fixed",
              top: 0,
              width: "100%",
              overflow: "auto",
            }}
          >
            <h2
              style={{
                color: "white",
                marginLeft: 30,
                margin: "14px",
              }}
            >
              P2P VIDEO CALL
            </h2>
          </div>
          <div>
            <img
              style={{
                width: "100vw",
                height: "100vh",
                backgroundSize: "100% 100%",
                backgroundRepeat: "no-repeat",
                position: "static",
              }}
              src={require("./../components/video-bg.jpg")}
              alt="pic"
            />
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 30,
            left: "40%",
          }}
        >
          {/* <button style={{}} onClick={this.on_click}>
            Enter
          </button> */}
          <Button
            style={{
              fontSize: "20px",
            }}
            variant="contained"
            color="primary"
            size="large"
            startIcon={<VideocamIcon />}
            onClick={this.on_click}
          >
            Start Video Call
          </Button>
        </div>
      </div>
    );
  }
}

export default FirstPage;
