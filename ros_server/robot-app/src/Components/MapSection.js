import React, { useState, useEffect, useRef } from "react";
import "../style/MapSection.scss";
import MyImage from "./MyImage";
import io from "socket.io-client";
import { Fragment } from "react";

const ENDPOINT = "http://192.168.1.16:8000";
const socket = io(ENDPOINT);

function MapSection() {
  return <Fragment>{<MyImage socket={socket} x={0} y={0} />}</Fragment>;
}
export default MapSection;
