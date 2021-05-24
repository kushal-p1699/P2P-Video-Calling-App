import React, { Component } from "react";
import Home from "./components/home";
import FirstPage from "./components/first-page";
import { BrowserRouter as Router, Route, Link, Switch } from "react-router-dom";

class App extends Component {
  state = {};
  render() {
    return (
      <div>
        {/* <Home />
        <FirstPage /> */}
        <Router>
          <Switch>
            <Route exact path="/" component={FirstPage} />
            <Route exact path="/home" component={Home} />
          </Switch>
        </Router>
      </div>
    );
  }
}

export default App;
