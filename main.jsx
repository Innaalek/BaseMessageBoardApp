import React from "react";
import ReactDOM from "react-dom/client";
import MessageBoard from "./components/MessageBoard.jsx";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <MessageBoard />
  </React.StrictMode>
);
